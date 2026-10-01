"""SQL for the scanning stage."""
from psycopg.types.json import Jsonb
from app.store import normalize_codebase_id


def clear_stage(conn, stage_key: str, codebase_id=None) -> None:
    conn.execute("DELETE FROM analysis_runs WHERE stage_key = %s AND codebase_id = %s",
                 (stage_key, normalize_codebase_id(codebase_id)))  # scans, findings, artifacts cascade


def create_scan(conn, run_id, stage_key, scan_type, data, coverage, manifest) -> int:
    row = conn.execute(
        "INSERT INTO scans (run_id, stage_key, scan_type, data, coverage, manifest) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
        (run_id, stage_key, scan_type, Jsonb(data), Jsonb(coverage) if coverage else None,
         Jsonb(manifest) if manifest else None)).fetchone()
    sid = row["id"]
    if not data.get("scan_id"):
        conn.execute("UPDATE scans SET data = data || jsonb_build_object('scan_id', %s::text) WHERE id = %s",
                     (f"SCAN-{sid}", sid))
    return sid


def save_artifact(conn, run_id, scan_id, stage_key, u, artifact_type, codebase_id=None) -> int:
    row = conn.execute(
        "INSERT INTO artifacts (run_id, codebase_id, scan_id, stage_key, filename, kind, size_bytes, sha256, redacted, content) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
        (run_id, normalize_codebase_id(codebase_id), scan_id, stage_key, u.filename, artifact_type, u.size_bytes, u.sha256, u.redacted, u.text)).fetchone()
    return row["id"]


def add_finding(conn, scan_id, key, data) -> int:
    row = conn.execute(
        "INSERT INTO findings (scan_id, item_key, data) VALUES (%s,%s,%s) "
        "ON CONFLICT (scan_id, item_key) DO UPDATE SET data = EXCLUDED.data RETURNING id",
        (scan_id, key, Jsonb(data))).fetchone()
    return row["id"]


def add_evidence(conn, scan_id, finding_id, artifact_id, row) -> None:
    conn.execute(
        "INSERT INTO scan_evidence (scan_id, finding_id, artifact_id, origin, location, description, reference) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (scan_id, finding_id, artifact_id, row.get("origin"), row.get("location"), row.get("description"),
         Jsonb(row.get("reference")) if row.get("reference") else None))
