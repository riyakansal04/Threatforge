from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool

from app import catalog, jira, store
from app.config import MAX_FILE_BYTES
from app.db import pool
from app.mapper.fields import STAGES
from app.mapper.ingest import ingest
from app.mapper.readers import clean_filename
from app.scanning import SCAN_STAGES
from app.scanning import store as scan_store
from app.scanning.ingest import ingest_scan

router = APIRouter(prefix="/api")


def _match_token(value) -> str:
    return "".join(ch for ch in str(value or "").lower() if ch.isalnum())


def _tokens(row: dict) -> set[str]:
    values = [
        row.get("finding_id"),
        row.get("logical_finding_id"),
        row.get("consolidated_finding_id"),
        row.get("remediation_id"),
        row.get("priority_id"),
        row.get("id"),
        row.get("title"),
    ]
    out = set()
    for value in values:
        if isinstance(value, (list, tuple, set)):
            parts = value
        else:
            parts = str(value or "").replace(",", " ").replace(";", " ").replace("/", " ").split()
        for part in parts:
            token = _match_token(part)
            if token:
                out.add(token)
    return out


def _with_priority_context(remediation: dict, priority_rows: list[dict]) -> dict:
    remediation_tokens = _tokens(remediation)
    match = next((row for row in priority_rows if remediation_tokens & _tokens(row)), None)
    if not match:
        return remediation
    merged = dict(match)
    merged.update({key: value for key, value in remediation.items() if value not in (None, "", [])})
    merged["priority_source"] = "ThreatForge priority queue"
    return merged


@router.get("/health")
def health():
    with pool.connection() as conn:
        conn.execute("SELECT 1")
    return {"status": "ok"}


@router.get("/jira/config")
def jira_config():
    return jira.config_status()


@router.post("/jira/remediations/{item_key:path}")
async def create_jira_remediation(item_key: str, codebase_id: int | None = None):
    cid = store.normalize_codebase_id(codebase_id)
    with pool.connection() as conn:
        row = store.get_item(conn, "remediations", item_key, cid)
        priority_rows = store.list_items(conn, STAGES["prioritization"]["records"]["priority_queue"]["table"], cid)
    if not row:
        raise HTTPException(404, "Remediation record not found.")
    jira_record = _with_priority_context(row, priority_rows)
    if row.get("jira_key"):
        try:
            issue = await run_in_threadpool(jira.update_issue_priority, row.get("jira_key"), jira_record)
        except RuntimeError as exc:
            raise HTTPException(400, str(exc)) from exc
        with pool.connection() as conn:
            updated = store.update_item(conn, "remediations", item_key, {
                "jira_priority": issue.get("priority"),
                "jira_status": "synced",
            }, cid)
        return {"issue": {**issue, "id": row.get("jira_id")}, "record": updated}

    try:
        issue = await run_in_threadpool(jira.create_issue, jira_record)
    except RuntimeError as exc:
        raise HTTPException(400, str(exc)) from exc

    with pool.connection() as conn:
        updated = store.update_item(conn, "remediations", item_key, {
            "jira_id": issue.get("id"),
            "jira_key": issue["key"],
            "jira_url": issue["url"],
            "jira_priority": issue.get("priority"),
            "jira_status": "created",
        }, cid)
    return {"issue": issue, "record": updated}


@router.get("/catalog")
def get_catalog():
    return {"phases": catalog.PHASES, "file_types": catalog.FILE_TYPES}


def _process(stages: dict, replace: bool, codebase_id: int) -> list:
    results = []
    with pool.connection() as conn:  # one transaction for the whole upload
        for key, files in stages.items():
            if key in SCAN_STAGES:
                results.append(ingest_scan(conn, key, files, replace=replace, codebase_id=codebase_id))
            else:
                results.append(ingest(conn, key, files, replace=replace, codebase_id=codebase_id))
    return results


@router.get("/codebases")
def codebases():
    with pool.connection() as conn:
        return {"codebases": store.list_codebases(conn)}


@router.post("/codebases")
async def create_codebase(request: Request):
    body = await request.json()
    with pool.connection() as conn:
        codebase_id = store.get_or_create_codebase(conn, body.get("name"))
        row = conn.execute("SELECT id, name, created_at, updated_at FROM codebases WHERE id = %s", (codebase_id,)).fetchone()
    return row


@router.delete("/codebases/{codebase_id}")
def delete_codebase(codebase_id: int):
    with pool.connection() as conn:
        row = conn.execute("SELECT id FROM codebases WHERE id = %s", (codebase_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Codebase not found.")
        store.delete_codebase(conn, codebase_id)
    return {"deleted": codebase_id}


@router.post("/upload")
async def upload(request: Request, replace: bool = False, codebase_id: int | None = None, codebase_name: str | None = None):
    """multipart/form-data. Send each file under the field name  files:<stage-key>
    for example  files:repository-intelligence  (repeat the field for many files)."""
    form = await request.form()
    stages: dict = {}
    for name, value in form.multi_items():
        if not name.startswith("files:") or not hasattr(value, "filename"):
            continue
        key = name.split(":", 1)[1]
        if key not in STAGES and key not in SCAN_STAGES:
            raise HTTPException(400, f"Stage '{key}' is not available yet.")
        data = await value.read()
        if len(data) > MAX_FILE_BYTES:
            raise HTTPException(413, f"{clean_filename(value.filename)} is larger than {MAX_FILE_BYTES // 1048576} MB.")
        stages.setdefault(key, []).append((value.filename, data))
    if not stages:
        raise HTTPException(400, "No files received. Choose at least one stage and add its files.")
    if not codebase_id and not (codebase_name or "").strip():
        raise HTTPException(400, "Select an existing codebase or create a new codebase before uploading.")
    with pool.connection() as conn:
        cid = store.get_or_create_codebase(conn, codebase_name, codebase_id)
    return {"codebase_id": cid, "runs": await run_in_threadpool(_process, stages, replace, cid)}


@router.get("/status")
def status(codebase_id: int | None = None):
    cid = store.normalize_codebase_id(codebase_id)
    with pool.connection() as conn:
        runs = {r["stage_key"]: r for r in conn.execute(
            "SELECT stage_key, count(*) AS runs, max(created_at) AS last_run_at FROM analysis_runs WHERE codebase_id = %s GROUP BY stage_key",
            (cid,))}
        stages = []
        for key, cfg in STAGES.items():
            row = store.load_singleton(conn, cfg["table"], cid)
            data = row["data"] if row else {}
            counts = {f: len(data.get(f) or []) for f in cfg["summary_fields"]}
            for name, rs in cfg["records"].items():
                counts[name] = store.count_items(conn, rs["table"], cid)
            run = runs.get(key)
            stages.append({
                "key": key, "label": cfg["label"], "phase": cfg.get("phase", "pre-scan"),
                "has_data": bool(data) or any(counts.get(n) for n in cfg["records"]),
                "runs": run["runs"] if run else 0,
                "last_run_at": run["last_run_at"] if run else None,
                "counts": counts,
            })
    return {"stages": stages}


def _singleton(key: str, codebase_id=None):
    cfg = STAGES[key]
    cid = store.normalize_codebase_id(codebase_id)
    with pool.connection() as conn:
        row = store.load_singleton(conn, cfg["table"], cid)
        records = {n: store.list_items(conn, rs["table"], cid) for n, rs in cfg["records"].items()}
    return (row["data"] if row else None), (row["updated_at"] if row else None), records


@router.get("/lifecycle/{stage_key}")
def lifecycle_stage(stage_key: str, codebase_id: int | None = None):
    if stage_key not in STAGES:
        raise HTTPException(404, "Unknown lifecycle stage.")
    data, updated, rec = _singleton(stage_key, codebase_id)
    has = bool(data) or any(rec.values())
    return {
        "stage": stage_key,
        "label": STAGES[stage_key]["label"],
        "phase": STAGES[stage_key].get("phase", "pre-scan"),
        "has_data": has,
        "updated_at": updated,
        "data": data or {},
        "records": rec,
    }


@router.patch("/lifecycle/{stage_key}/records/{record_key}/{item_key:path}")
async def update_lifecycle_record(stage_key: str, record_key: str, item_key: str, request: Request, codebase_id: int | None = None):
    if stage_key not in STAGES:
        raise HTTPException(404, "Unknown lifecycle stage.")
    cfg = STAGES[stage_key]
    if record_key not in cfg["records"]:
        raise HTTPException(404, "Unknown lifecycle record type.")

    body = await request.json()
    allowed = {"status", "implementation_status", "authorization_status"}
    updates = {key: body.get(key) for key in allowed if key in body}
    if not updates:
        raise HTTPException(400, "No editable remediation fields were provided.")

    cid = store.normalize_codebase_id(codebase_id)
    with pool.connection() as conn:
        row = store.update_item(conn, cfg["records"][record_key]["table"], item_key, updates, cid)
    if not row:
        raise HTTPException(404, "Remediation record not found.")
    return {"record": row}


@router.get("/prescan/repository-intelligence")
def repository_intelligence(codebase_id: int | None = None):
    data, updated, _ = _singleton("repository-intelligence", codebase_id)
    return {"stage": "repository-intelligence", "has_data": bool(data), "updated_at": updated, "data": data}


@router.get("/prescan/threat-model")
def threat_model(codebase_id: int | None = None):
    data, updated, rec = _singleton("threat-modeling", codebase_id)
    has = bool(data) or any(rec.values())
    return {"stage": "threat-modeling", "has_data": has, "updated_at": updated, "threat_model": data,
            "threats": rec["threats"], "threat_relationships": rec["threat_relationships"]}


@router.get("/prescan/security-baseline")
def security_baseline(codebase_id: int | None = None):
    data, updated, rec = _singleton("security-baseline", codebase_id)
    has = bool(data) or any(rec.values())
    return {"stage": "security-baseline", "has_data": has, "updated_at": updated, "security_baseline": data,
            "scan_focus": rec["scan_focus"], "threat_convergence": rec["threat_convergence"]}


@router.get("/prescan/scan-planning")
def scan_planning(codebase_id: int | None = None):
    return security_baseline(codebase_id)


@router.get("/prescan/evidence")
def evidence(codebase_id: int | None = None):
    pre = list(STAGES)
    cid = store.normalize_codebase_id(codebase_id)
    with pool.connection() as conn:
        refs = conn.execute("SELECT stage_key, entity_type, owner_label, reference FROM evidence "
                            "WHERE stage_key = ANY(%s) AND codebase_id = %s ORDER BY id", (pre, cid)).fetchall()
        artifacts = conn.execute(
            "SELECT id, run_id, stage_key, filename, kind, size_bytes, sha256, redacted, created_at "
            "FROM artifacts WHERE stage_key = ANY(%s) AND codebase_id = %s ORDER BY id DESC", (pre, cid)).fetchall()
        runs = conn.execute(
            "SELECT id, stage_key, file_count, counts, warnings, created_at FROM analysis_runs "
            "WHERE stage_key = ANY(%s) AND codebase_id = %s ORDER BY id DESC", (pre, cid)).fetchall()
    return {"has_data": bool(refs or artifacts), "references": refs, "artifacts": artifacts, "runs": runs}



@router.get("/artifacts/{artifact_id}")
def artifact(artifact_id: int):
    with pool.connection() as conn:
        row = conn.execute("SELECT * FROM artifacts WHERE id = %s", (artifact_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Artifact not found.")
    return row


@router.delete("/stages/{stage_key}")
def clear_stage(stage_key: str, codebase_id: int | None = None):
    cid = store.normalize_codebase_id(codebase_id)
    with pool.connection() as conn:
        if stage_key in STAGES:
            store.clear_stage(conn, stage_key, cid)
        elif stage_key in SCAN_STAGES:
            scan_store.clear_stage(conn, stage_key, cid)
        else:
            raise HTTPException(404, "Unknown stage.")
    return {"cleared": stage_key}
