import base64
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.config import JIRA_API_TOKEN, JIRA_BASE_URL, JIRA_EMAIL, JIRA_ISSUE_TYPE, JIRA_PROJECT_KEY


def configured() -> bool:
    return bool(JIRA_BASE_URL and JIRA_EMAIL and JIRA_API_TOKEN and JIRA_PROJECT_KEY)


def config_status() -> dict:
    return {
        "configured": configured(),
        "base_url": JIRA_BASE_URL,
        "project_key": JIRA_PROJECT_KEY,
        "issue_type": JIRA_ISSUE_TYPE,
    }


def _text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple, set)):
        return ", ".join(_text(item) for item in value if _text(item))
    if isinstance(value, dict):
        return ", ".join(f"{key}: {_text(val)}" for key, val in value.items() if _text(val))
    return str(value).strip()


def _first(record: dict, *keys: str) -> str:
    for key in keys:
        value = _text(record.get(key))
        if value:
            return value
    return ""


def _priority_name(record: dict) -> str:
    explicit = " ".join(_text(record.get(key)).lower() for key in (
        "priority",
        "action_level",
        "action",
        "priority_classification",
        "priority_level",
        "target_period",
        "work_plan",
        "priority_reasoning",
    ))
    severity = _first(record, "severity", "risk", "risk_rating").lower()

    if any(token in explicit for token in ("immediate", "urgent", "emergency", "p0", "p1", "blocker", "hotfix", "active exploit")):
        return "Highest"
    if any(token in explicit for token in ("critical", "highest")):
        return "Highest"
    if any(token in explicit for token in ("high", "near term", "near-term", "short term", "short-term", "p2", "this sprint")):
        return "High"
    if any(token in explicit for token in ("low", "backlog", "defer", "p4", "informational", "accepted risk")):
        return "Low"
    if any(token in explicit for token in ("lowest", "no action")):
        return "Lowest"

    if severity == "critical":
        return "Highest"
    if severity == "high":
        return "High"
    if severity == "medium":
        return "Medium"
    if severity == "low":
        return "Low"
    if severity in {"info", "informational"}:
        return "Lowest"
    return "Medium"


def _summary(record: dict) -> str:
    finding = _first(record, "finding_id", "remediation_id", "id")
    title = _first(record, "title", "proposed_remediation", "recommendation", "root_cause")
    summary = f"ThreatForge remediation: {finding} - {title}" if finding else f"ThreatForge remediation: {title}"
    return summary[:252] + "..." if len(summary) > 255 else summary


def _paragraph(text: str) -> dict:
    return {
        "type": "paragraph",
        "content": [{"type": "text", "text": text or "Not provided"}],
    }


def _description(record: dict) -> dict:
    lines = [
        ("Finding", _first(record, "finding_id", "logical_finding_id", "remediation_id")),
        ("ThreatForge priority", _first(record, "priority", "action_level", "priority_level", "target_period")),
        ("Jira priority", _priority_name(record)),
        ("Severity", _first(record, "severity", "risk", "priority")),
        ("Root cause", _first(record, "root_cause", "common_root_cause")),
        ("Recommendation", _first(record, "recommendation", "proposed_remediation", "fix_summary")),
        ("Validation", _first(record, "security_validation", "functional_validation", "validation")),
        ("Changed files", _first(record, "changed_files", "files")),
        ("Evidence", _first(record, "evidence", "source_findings", "source_finding_ids")),
    ]
    content = [_paragraph("Created from ThreatForge remediation workflow.")]
    for label, value in lines:
        if value:
            content.append(_paragraph(f"{label}: {value}"))
    return {"type": "doc", "version": 1, "content": content}


def _payload(record: dict) -> dict:
    return {
        "fields": {
            "project": {"key": JIRA_PROJECT_KEY},
            "issuetype": {"name": JIRA_ISSUE_TYPE},
            "summary": _summary(record),
            "description": _description(record),
            "priority": {"name": _priority_name(record)},
            "labels": ["threatforge", "security-remediation"],
        }
    }


def update_issue_priority(issue_key: str, record: dict) -> dict:
    if not configured():
        raise RuntimeError("Jira is not configured. Add JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN and JIRA_PROJECT_KEY to backend/.env.")
    if not issue_key:
        raise RuntimeError("No Jira issue key is available to update.")

    token = base64.b64encode(f"{JIRA_EMAIL}:{JIRA_API_TOKEN}".encode("utf-8")).decode("ascii")
    priority = _priority_name(record)
    request = Request(
        f"{JIRA_BASE_URL}/rest/api/3/issue/{issue_key}",
        data=json.dumps({"fields": {"priority": {"name": priority}}}).encode("utf-8"),
        method="PUT",
        headers={
            "Authorization": f"Basic {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=25):
            pass
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        raise RuntimeError(f"Jira rejected priority update ({exc.code}): {detail[:600]}") from exc
    except URLError as exc:
        raise RuntimeError(f"Could not reach Jira: {exc.reason}") from exc
    return {"key": issue_key, "url": f"{JIRA_BASE_URL}/browse/{issue_key}", "priority": priority}


def create_issue(record: dict) -> dict:
    if not configured():
        raise RuntimeError("Jira is not configured. Add JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN and JIRA_PROJECT_KEY to backend/.env.")

    token = base64.b64encode(f"{JIRA_EMAIL}:{JIRA_API_TOKEN}".encode("utf-8")).decode("ascii")
    request = Request(
        f"{JIRA_BASE_URL}/rest/api/3/issue",
        data=json.dumps(_payload(record)).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": f"Basic {token}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=25) as response:
            data = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        raise RuntimeError(f"Jira rejected issue creation ({exc.code}): {detail[:600]}") from exc
    except URLError as exc:
        raise RuntimeError(f"Could not reach Jira: {exc.reason}") from exc

    key = data.get("key")
    if not key:
        raise RuntimeError("Jira created an issue but did not return an issue key.")
    return {"id": data.get("id"), "key": key, "url": f"{JIRA_BASE_URL}/browse/{key}", "priority": _priority_name(record)}
