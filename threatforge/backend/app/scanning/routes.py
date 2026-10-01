import re
from collections import Counter

from fastapi import APIRouter, HTTPException

from app.db import pool
from app.store import normalize_codebase_id
from app.scanning import SCAN_STAGES

router = APIRouter(prefix="/api/scanning")

SCAN_TYPES = ("standard", "deep", "module", "exploitable", "supply_chain", "runtime")

SCAN_SQL = """SELECT s.id, s.run_id, r.codebase_id, s.stage_key, s.scan_type, s.data, s.coverage, s.manifest, s.created_at,
 (SELECT count(*) FROM findings f WHERE f.scan_id = s.id) AS finding_count,
 (SELECT count(*) FROM artifacts a WHERE a.scan_id = s.id) AS artifact_count
 FROM scans s JOIN analysis_runs r ON r.id = s.run_id"""

SCOPE_ONLY_RE = re.compile(
    r"\b(authentication and authorization|apis? and interfaces|business-critical|security controls and trust boundaries|external integrations|dependencies and configuration|target-specific risks|assessment scope|coverage scope)\b",
    re.I,
)
FINDING_TEXT_RE = re.compile(
    r"\b(vulnerab|injection|xss|csrf|deserial|auth|bypass|exposure|disclosure|leak|secret|credential|token|cookie|command|path traversal|ssrf|xxe|misconfig|weak|risk|exploit|cwe-|cve-)\b",
    re.I,
)


def _empty(value):
    return value is None or value == "" or value == [] or value == {}


def _text(value):
    if value is None:
        return ""
    if isinstance(value, list):
        return " ".join(_text(item) for item in value if not _empty(item))
    if isinstance(value, dict):
        return ""
    return " ".join(str(value).split())


def _sev_class(value):
    clean = _text(value).lower()
    if "moderate" in clean:
        return "medium"
    for name in ("critical", "high", "medium", "low", "info"):
        if name in clean:
            return name
    return "none"


def _displayable_finding(finding):
    if not isinstance(finding, dict):
        return False
    attrs = finding.get("attributes") or {}
    title = _text(finding.get("title") or finding.get("finding_id"))
    summary = " ".join(_text(item) for item in [
        title,
        finding.get("description"),
        finding.get("category"),
        finding.get("root_cause"),
        finding.get("impact"),
        finding.get("recommended_remediation"),
        finding.get("observed_behavior"),
        finding.get("expected_behavior"),
    ] if not _empty(item))
    has_severity = _sev_class(finding.get("severity") or attrs.get("sarif_level")) != "none"
    has_security_id = not _empty(finding.get("cwe")) or not _empty(finding.get("security_identifier"))
    has_finding_id = not _empty(finding.get("finding_id"))
    has_finding_body = any(not _empty(finding.get(key)) for key in (
        "description", "root_cause", "impact", "attack_path", "recommended_remediation",
        "observed_behavior", "expected_behavior", "runtime_validation", "dependency",
    ))
    has_affected_target = any(not _empty(finding.get(key)) for key in (
        "affected_area", "affected_dependency", "runtime_target", "code_location",
    ))
    has_review_signal = not _empty(finding.get("classification")) or not _empty(finding.get("confidence"))
    has_evidence = bool(finding.get("evidence_items")) or bool(finding.get("source_references")) or not _empty(finding.get("evidence"))
    looks_scope_only = not has_severity and not has_security_id and not has_finding_body and not has_affected_target and SCOPE_ONLY_RE.search(summary)
    if looks_scope_only:
        return False
    if has_security_id or has_severity:
        return has_finding_id or has_finding_body or has_affected_target or bool(FINDING_TEXT_RE.search(summary))
    if has_finding_body and (has_affected_target or has_review_signal or has_evidence or FINDING_TEXT_RE.search(summary)):
        return True
    if has_finding_id and (has_review_signal or has_evidence or has_affected_target or FINDING_TEXT_RE.search(summary)):
        return True
    return False


def _scan(r, full=False, finding_count=None):
    d = {**r["data"], "id": r["id"], "run_id": r["run_id"], "codebase_id": r["codebase_id"],
         "stage_key": r["stage_key"], "scan_type": r["scan_type"],
         "finding_count": r["finding_count"] if finding_count is None else finding_count, "artifact_count": r["artifact_count"],
         "has_coverage": r["coverage"] is not None, "has_manifest": r["manifest"] is not None,
         "created_at": r["created_at"]}
    if full:
        d["coverage"], d["manifest"] = r["coverage"], r["manifest"]
    return d


def _findings(conn, scan_id=None, scan_ids=None):
    if scan_id is None and scan_ids is not None and not scan_ids:
        return []
    q = ("SELECT f.id, f.scan_id, f.data, s.scan_type, s.data->>'scan_id' AS scan_label "
         "FROM findings f JOIN scans s ON s.id = f.scan_id")
    params = ()
    if scan_id is not None:
        q += " WHERE f.scan_id = %s"
        params = (scan_id,)
    elif scan_ids is not None:
        q += " WHERE f.scan_id = ANY(%s)"
        params = (scan_ids,)
    rows = conn.execute(q + " ORDER BY f.scan_id DESC, f.id", params).fetchall()
    ev = {}
    if rows:
        for e in conn.execute(
                "SELECT finding_id, artifact_id, origin, location, description FROM scan_evidence "
                "WHERE finding_id = ANY(%s) ORDER BY id", ([r["id"] for r in rows],)).fetchall():
            ev.setdefault(e["finding_id"], []).append(e)
    return [
        item for item in (
            {**r["data"], "id": r["id"], "scan_db_id": r["scan_id"], "scan_type": r["scan_type"],
             "scan_label": r["scan_label"], "evidence_items": ev.get(r["id"], [])} for r in rows
        )
        if _displayable_finding(item)
    ]


def _display_finding_counts(conn, scan_ids):
    counts = Counter()
    if not scan_ids:
        return counts
    rows = conn.execute("SELECT scan_id, data FROM findings WHERE scan_id = ANY(%s)", (scan_ids,)).fetchall()
    for row in rows:
        if _displayable_finding(row["data"]):
            counts[row["scan_id"]] += 1
    return counts


def _dist(values, expected=None):
    c, label = Counter(), {}
    for v in expected or []:
        k = str(v).lower()
        c[k] += 0
        label[k] = str(v)
    for v in values:
        if isinstance(v, (list, dict)) or v is None:
            continue
        s = " ".join(str(v).split())
        if s:
            c[s.lower()] += 1
            label.setdefault(s.lower(), s)
    return [{"label": label[k], "count": n} for k, n in c.most_common()]


def _select_scans(rows, scan_id):
    if scan_id is None:
        return rows
    selected = [r for r in rows if r["id"] == scan_id]
    if not selected:
        raise HTTPException(404, "Scan not found.")
    return selected


def _history(rows, finding_counts=None):
    finding_counts = finding_counts or {}
    return [_scan(r, finding_count=finding_counts.get(r["id"])) for r in rows]


def _scans_for(conn, codebase_id):
    return conn.execute(SCAN_SQL + " WHERE r.codebase_id = %s ORDER BY s.id DESC",
                        (normalize_codebase_id(codebase_id),)).fetchall()


@router.get("/overview")
def overview(scan_id: int | None = None, codebase_id: int | None = None):
    cid = normalize_codebase_id(codebase_id)
    with pool.connection() as conn:
        all_scans = _scans_for(conn, cid)
        scans = _select_scans(all_scans, scan_id)
        display_counts = _display_finding_counts(conn, [s["id"] for s in all_scans])
        ids = [s["id"] for s in scans]
        run_ids = [s["run_id"] for s in scans]
        if ids:
            findings = [r["data"] for r in conn.execute(
                "SELECT data FROM findings WHERE scan_id = ANY(%s)", (ids,)).fetchall() if _displayable_finding(r["data"])]
            arts = conn.execute(
                "SELECT kind, count(*) AS n FROM artifacts WHERE scan_id = ANY(%s) GROUP BY kind", (ids,)).fetchall()
            runs = conn.execute(
                "SELECT id, stage_key, file_count, counts, warnings, created_at FROM analysis_runs "
                "WHERE id = ANY(%s) ORDER BY id DESC LIMIT 8", (run_ids,)).fetchall()
        else:
            findings, arts, runs = [], [], []
        if scan_id is None:
            runs = conn.execute(
                "SELECT id, stage_key, file_count, counts, warnings, created_at FROM analysis_runs "
                "WHERE stage_key = ANY(%s) AND codebase_id = %s ORDER BY id DESC LIMIT 8", (list(SCAN_STAGES), cid)).fetchall()
    by_type = {}
    for t in SCAN_TYPES:
        by_type[t] = {"scan_type": t, "count": 0, "findings": 0, "latest": None}
    for s in scans:
        t = by_type.setdefault(s["scan_type"], {"scan_type": s["scan_type"], "count": 0, "findings": 0, "latest": None})
        t["count"] += 1
        t["findings"] += display_counts.get(s["id"], 0)
        t["latest"] = max(t["latest"], s["created_at"]) if t["latest"] else s["created_at"]
    selected_scan = _scan(scans[0], finding_count=display_counts.get(scans[0]["id"], 0)) if scan_id is not None and scans else None
    return {
        "has_data": bool(all_scans),
        "scope": "selected_scan" if scan_id is not None else "all_scans",
        "scan_history": _history(all_scans, display_counts),
        "selected_scan": selected_scan,
        "included_scan_count": len(scans),
        "scan_count": len(all_scans),
        "finding_total": len(findings),
        "coverage_available": sum(1 for s in scans if s["coverage"] is not None),
        "scan_types_run": sum(1 for r in by_type.values() if r["count"]),
        "by_type": list(by_type.values()),
        "statuses": _dist(s["data"].get("status") for s in scans),
        "severity": _dist(((f.get("severity") or (f.get("attributes") or {}).get("sarif_level")) for f in findings),
                          ["Critical", "High", "Medium", "Low", "Info"]),
        "confidence": _dist((f.get("confidence") for f in findings), ["High", "Medium", "Low", "Unknown"]),
        "category": _dist(f.get("category") for f in findings),
        "classification": _dist(f.get("classification") for f in findings),
        "artifact_types": [{"label": a["kind"], "count": a["n"]} for a in arts],
        "latest_scan": _scan(all_scans[0], finding_count=display_counts.get(all_scans[0]["id"], 0)) if all_scans else None,
        "recent_runs": runs,
    }


@router.get("/scans")
def scans(codebase_id: int | None = None):
    with pool.connection() as conn:
        rows = _scans_for(conn, codebase_id)
        display_counts = _display_finding_counts(conn, [r["id"] for r in rows])
    return {"has_data": bool(rows), "scans": _history(rows, display_counts)}


@router.get("/scans/{scan_id}")
def scan_detail(scan_id: int):
    with pool.connection() as conn:
        row = conn.execute(SCAN_SQL + " WHERE s.id = %s", (scan_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Scan not found.")
        findings = _findings(conn, scan_id)
        display_counts = {scan_id: len(findings)}
        artifacts = conn.execute(
            "SELECT id, filename, kind, size_bytes, sha256, redacted, created_at FROM artifacts "
            "WHERE scan_id = %s ORDER BY id", (scan_id,)).fetchall()
        evidence = conn.execute(
            "SELECT finding_id, artifact_id, origin, location, description FROM scan_evidence "
            "WHERE scan_id = %s ORDER BY id", (scan_id,)).fetchall()
    return {"scan": _scan(row, full=True, finding_count=display_counts.get(scan_id, 0)), "findings": findings, "artifacts": artifacts, "evidence": evidence}


@router.get("/findings")
def findings(scan_id: int | None = None, codebase_id: int | None = None):
    with pool.connection() as conn:
        scans = _scans_for(conn, codebase_id)
        selected = _select_scans(scans, scan_id)
        items = _findings(conn, scan_id) if scan_id is not None else _findings(conn, scan_ids=[s["id"] for s in scans])
        display_counts = _display_finding_counts(conn, [s["id"] for s in scans])
    return {"has_data": bool(scans), "findings": items, "scan_history": _history(scans, display_counts),
            "selected_scan": _scan(selected[0], finding_count=display_counts.get(selected[0]["id"], 0)) if scan_id is not None and selected else None}


@router.get("/coverage")
def coverage(scan_id: int | None = None, codebase_id: int | None = None):
    cid = normalize_codebase_id(codebase_id)
    with pool.connection() as conn:
        scans = _scans_for(conn, cid)
        _select_scans(scans, scan_id)
        display_counts = _display_finding_counts(conn, [s["id"] for s in scans])
        where = "WHERE r.codebase_id = %s"
        params = [cid]
        if scan_id is not None:
            where += " AND s.id = %s"
            params.append(scan_id)
        rows = conn.execute(
            "SELECT s.id, s.scan_type, s.data->>'scan_id' AS scan_label, s.coverage, s.created_at, "
            "(SELECT a.id FROM artifacts a WHERE a.scan_id = s.id AND a.kind = 'coverage' ORDER BY a.id LIMIT 1) AS artifact_id "
            f"FROM scans s JOIN analysis_runs r ON r.id = s.run_id {where} ORDER BY s.id DESC", tuple(params)).fetchall()
    return {"has_data": bool(scans), "items": rows, "scan_history": _history(scans, display_counts),
            "selected_scan": _scan(_select_scans(scans, scan_id)[0], finding_count=display_counts.get(scan_id, 0)) if scan_id is not None else None}


@router.get("/artifacts")
def artifacts(scan_id: int | None = None, codebase_id: int | None = None):
    cid = normalize_codebase_id(codebase_id)
    with pool.connection() as conn:
        scans = _scans_for(conn, cid)
        _select_scans(scans, scan_id)
        display_counts = _display_finding_counts(conn, [s["id"] for s in scans])
        where = "WHERE a.codebase_id = %s"
        params = [cid]
        if scan_id is not None:
            where += " AND a.scan_id = %s"
            params.append(scan_id)
        rows = conn.execute(
            "SELECT a.id, a.filename, a.kind, a.size_bytes, a.sha256, a.redacted, a.created_at, "
            "a.scan_id AS scan_db_id, s.scan_type, s.data->>'scan_id' AS scan_label "
            f"FROM artifacts a JOIN scans s ON s.id = a.scan_id {where} ORDER BY a.id DESC", tuple(params)).fetchall()
    return {"has_data": bool(scans), "artifacts": rows, "scan_history": _history(scans, display_counts),
            "selected_scan": _scan(_select_scans(scans, scan_id)[0], finding_count=display_counts.get(scan_id, 0)) if scan_id is not None else None}


@router.delete("/scans/{scan_id}")
def delete_scan(scan_id: int):
    with pool.connection() as conn:
        row = conn.execute("SELECT run_id FROM scans WHERE id = %s", (scan_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Scan not found.")
        conn.execute("DELETE FROM analysis_runs WHERE id = %s", (row["run_id"],))  # cascades to scan, findings, artifacts
    return {"deleted": scan_id}
