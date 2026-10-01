"""All SQL lives here."""
from psycopg.types.json import Jsonb

from app.mapper.fields import STAGES
from app.mapper.util import iter_refs, label_of, merge_record

CODEBASE_ROOT = "__codebases__"
DEFAULT_CODEBASE_ID = 1


def normalize_codebase_id(codebase_id) -> int:
    if codebase_id in (None, "", 0, "0"):
        return 0
    try:
        return int(codebase_id)
    except (TypeError, ValueError):
        return 0


def list_codebases(conn) -> list:
    return conn.execute(
        "SELECT c.id, c.name, c.created_at, c.updated_at, "
        "(SELECT count(*) FROM analysis_runs r WHERE r.codebase_id = c.id) AS run_count, "
        "(SELECT max(created_at) FROM analysis_runs r WHERE r.codebase_id = c.id) AS last_run_at "
        "FROM codebases c ORDER BY COALESCE((SELECT max(created_at) FROM analysis_runs r WHERE r.codebase_id = c.id), c.updated_at) DESC, c.id DESC"
    ).fetchall()


def get_or_create_codebase(conn, name: str | None = None, codebase_id=None) -> int:
    if codebase_id:
        row = conn.execute("SELECT id FROM codebases WHERE id = %s", (normalize_codebase_id(codebase_id),)).fetchone()
        if row:
            return row["id"]
    clean = " ".join((name or "").split()) or "Default codebase"
    row = conn.execute(
        "INSERT INTO codebases (name, updated_at) VALUES (%s, now()) "
        "ON CONFLICT (name) DO UPDATE SET updated_at = now() RETURNING id",
        (clean,),
    ).fetchone()
    return row["id"]


def delete_codebase(conn, codebase_id) -> None:
    cid = normalize_codebase_id(codebase_id)
    if cid <= 0:
        return
    conn.execute("DELETE FROM analysis_runs WHERE codebase_id = %s", (cid,))
    conn.execute("DELETE FROM artifacts WHERE codebase_id = %s", (cid,))
    conn.execute("DELETE FROM evidence WHERE codebase_id = %s", (cid,))
    for cfg in STAGES.values():
        row = load_singleton(conn, cfg["table"], raw=True)
        if row and CODEBASE_ROOT in row["data"]:
            data = dict(row["data"])
            root = dict(data.get(CODEBASE_ROOT) or {})
            root.pop(str(cid), None)
            data[CODEBASE_ROOT] = root
            conn.execute(f"UPDATE {cfg['table']} SET data = %s, updated_at = now() WHERE id = 1", (Jsonb(data),))
        for rs in cfg["records"].values():
            conn.execute(f"DELETE FROM {rs['table']} WHERE item_key LIKE %s", (f"cb{cid}:%",))
    conn.execute("DELETE FROM codebases WHERE id = %s", (cid,))


def _scoped_data(data: dict | None, codebase_id=None) -> dict:
    if not data:
        return {}
    cid = str(normalize_codebase_id(codebase_id))
    if CODEBASE_ROOT in data:
        return data.get(CODEBASE_ROOT, {}).get(cid, {})
    return data if normalize_codebase_id(codebase_id) == DEFAULT_CODEBASE_ID else {}


def _with_scoped_data(existing: dict | None, scoped: dict, codebase_id=None) -> dict:
    cid = str(normalize_codebase_id(codebase_id))
    if existing and CODEBASE_ROOT in existing:
        out = dict(existing)
        root = dict(out.get(CODEBASE_ROOT) or {})
    else:
        root = {}
        if existing:
            root[str(DEFAULT_CODEBASE_ID)] = existing
        out = {CODEBASE_ROOT: root}
    root[cid] = scoped
    out[CODEBASE_ROOT] = root
    return out


def scoped_key(item_key: str, codebase_id=None) -> str:
    return f"cb{normalize_codebase_id(codebase_id)}:{item_key}"


def unscoped_key(item_key: str, codebase_id=None) -> str:
    prefix = f"cb{normalize_codebase_id(codebase_id)}:"
    return item_key[len(prefix):] if str(item_key).startswith(prefix) else item_key


def clear_stage(conn, stage_key: str, codebase_id=None) -> None:
    cfg = STAGES[stage_key]
    cid = normalize_codebase_id(codebase_id)
    row = load_singleton(conn, cfg["table"], raw=True)
    if row:
        conn.execute(f"UPDATE {cfg['table']} SET data = %s, updated_at = now() WHERE id = 1",
                     (Jsonb(_with_scoped_data(row["data"], {}, cid)),))
    for rs in cfg["records"].values():
        conn.execute(f"DELETE FROM {rs['table']} WHERE item_key LIKE %s", (f"cb{cid}:%",))
        if cid == DEFAULT_CODEBASE_ID:
            conn.execute(f"DELETE FROM {rs['table']} WHERE item_key NOT LIKE 'cb%%:%%'")
    conn.execute("DELETE FROM evidence WHERE stage_key = %s AND codebase_id = %s", (stage_key, cid))
    conn.execute("DELETE FROM analysis_runs WHERE stage_key = %s AND codebase_id = %s", (stage_key, cid))  # artifacts cascade


def artifact_exists(conn, stage_key: str, sha256: str, codebase_id=None) -> bool:
    return conn.execute("SELECT 1 FROM artifacts WHERE stage_key = %s AND sha256 = %s AND codebase_id = %s LIMIT 1",
                        (stage_key, sha256, normalize_codebase_id(codebase_id))).fetchone() is not None


def create_run(conn, stage_key: str, file_count: int, counts: dict, warnings: list, codebase_id=None) -> int:
    row = conn.execute(
        "INSERT INTO analysis_runs (codebase_id, stage_key, file_count, counts, warnings) VALUES (%s,%s,%s,%s,%s) RETURNING id",
        (normalize_codebase_id(codebase_id), stage_key, file_count, Jsonb(counts), Jsonb(warnings))).fetchone()
    return row["id"]


def save_artifact(conn, run_id: int, stage_key: str, u, codebase_id=None) -> None:
    conn.execute(
        "INSERT INTO artifacts (run_id, codebase_id, stage_key, filename, kind, size_bytes, sha256, redacted, content) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (run_id, normalize_codebase_id(codebase_id), stage_key, u.filename, u.kind, u.size_bytes, u.sha256, u.redacted, u.text))


def load_singleton(conn, table: str, codebase_id=None, raw=False):
    row = conn.execute(f"SELECT data, updated_at FROM {table} WHERE id = 1").fetchone()
    if raw or not row:
        return row
    return {**row, "data": _scoped_data(row["data"], codebase_id)}


def save_singleton(conn, table: str, data: dict, codebase_id=None) -> None:
    existing = load_singleton(conn, table, raw=True)
    data = _with_scoped_data(existing["data"] if existing else None, data, codebase_id)
    conn.execute(
        f"INSERT INTO {table} (id, data, updated_at) VALUES (1, %s, now()) "
        f"ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()", (Jsonb(data),))


def upsert_items(conn, table: str, items: list, codebase_id=None) -> dict:
    """Adds new records. A record that already exists is completed with any missing details."""
    if not items:
        return {"added": 0, "already_known": 0}
    items = [(scoped_key(k, codebase_id), data) for k, data in items]
    keys = [k for k, _ in items]
    existing = {r["item_key"]: r["data"] for r in
                conn.execute(f"SELECT item_key, data FROM {table} WHERE item_key = ANY(%s)", (keys,)).fetchall()}
    added = known = 0
    for key, data in items:
        if key in existing:
            known += 1
            data = merge_record(existing[key], data)
        else:
            added += 1
        conn.execute(
            f"INSERT INTO {table} (item_key, data) VALUES (%s, %s) "
            f"ON CONFLICT (item_key) DO UPDATE SET data = EXCLUDED.data", (key, Jsonb(data)))
        existing[key] = data
    return {"added": added, "already_known": known}


def _with_item_key(row) -> dict:
    data = dict(row["data"] or {})
    data["_item_key"] = row["item_key"]
    return data


def list_items(conn, table: str, codebase_id=None) -> list:
    cid = normalize_codebase_id(codebase_id)
    if cid == DEFAULT_CODEBASE_ID:
        rows = conn.execute(f"SELECT item_key, data FROM {table} WHERE item_key LIKE %s OR item_key NOT LIKE 'cb%%:%%' ORDER BY id",
                            (f"cb{cid}:%",)).fetchall()
    else:
        rows = conn.execute(f"SELECT item_key, data FROM {table} WHERE item_key LIKE %s ORDER BY id", (f"cb{cid}:%",)).fetchall()
    return [_with_item_key(r) for r in rows]


def get_item(conn, table: str, item_key: str, codebase_id=None):
    cid = normalize_codebase_id(codebase_id)
    raw_key = str(item_key or "")
    if raw_key.startswith("cb") and not raw_key.startswith(f"cb{cid}:"):
        return None
    candidates = [raw_key] if raw_key.startswith("cb") else [scoped_key(raw_key, cid)]
    if cid == DEFAULT_CODEBASE_ID and raw_key not in candidates:
        candidates.append(raw_key)

    for candidate in candidates:
        row = conn.execute(f"SELECT item_key, data FROM {table} WHERE item_key = %s", (candidate,)).fetchone()
        if row:
            return _with_item_key(row)
    return None


def update_item(conn, table: str, item_key: str, updates: dict, codebase_id=None):
    cid = normalize_codebase_id(codebase_id)
    raw_key = str(item_key or "")
    if raw_key.startswith("cb") and not raw_key.startswith(f"cb{cid}:"):
        return None
    candidates = [raw_key] if raw_key.startswith("cb") else [scoped_key(raw_key, cid)]
    if cid == DEFAULT_CODEBASE_ID and raw_key not in candidates:
        candidates.append(raw_key)

    row = None
    for candidate in candidates:
        row = conn.execute(f"SELECT item_key, data FROM {table} WHERE item_key = %s", (candidate,)).fetchone()
        if row:
            break
    if not row:
        return None

    data = dict(row["data"] or {})
    for key, value in (updates or {}).items():
        if value is not None:
            data[key] = value
    conn.execute(f"UPDATE {table} SET data = %s WHERE item_key = %s", (Jsonb(data), row["item_key"]))
    return {**data, "_item_key": row["item_key"]}


def count_items(conn, table: str, codebase_id=None) -> int:
    cid = normalize_codebase_id(codebase_id)
    if cid == DEFAULT_CODEBASE_ID:
        return conn.execute(f"SELECT count(*) AS n FROM {table} WHERE item_key LIKE %s OR item_key NOT LIKE 'cb%%:%%'",
                            (f"cb{cid}:%",)).fetchone()["n"]
    return conn.execute(f"SELECT count(*) AS n FROM {table} WHERE item_key LIKE %s", (f"cb{cid}:%",)).fetchone()["n"]


def rebuild_evidence(conn, stage_key: str, codebase_id=None) -> int:
    cid = normalize_codebase_id(codebase_id)
    cfg = STAGES[stage_key]
    conn.execute("DELETE FROM evidence WHERE stage_key = %s AND codebase_id = %s", (stage_key, cid))
    rows = []
    row = load_singleton(conn, cfg["table"], cid)
    if row:
        rows += [(cfg["entity_type"], o, r) for o, r in iter_refs(row["data"], cfg["label"])]
    for rs in cfg["records"].values():
        for data in list_items(conn, rs["table"], cid):
            rows += [(rs["entity_type"], o if o != label_of(data) else label_of(data), r)
                     for o, r in iter_refs(data, label_of(data))]
    for entity_type, owner, ref in rows:
        conn.execute("INSERT INTO evidence (codebase_id, stage_key, entity_type, owner_label, reference) VALUES (%s,%s,%s,%s,%s)",
                     (cid, stage_key, entity_type, owner, Jsonb(ref)))
    return len(rows)
