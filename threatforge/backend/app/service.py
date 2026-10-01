"""Overview data.

Step 1 returns fixed sample data. In the next step this function will read
from PostgreSQL instead; the route and the response models will not change.
"""
from datetime import datetime, timedelta, timezone

from app.schemas import (
    AttentionItem,
    Funnel,
    OverviewResponse,
    Project,
    RecentUpload,
    StageRun,
)


def _hours_ago(hours: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(hours=hours)


def get_overview() -> OverviewResponse:
    return OverviewResponse(
        project=Project(id="prj_001", name="Payments API", repository="acme/payments-api"),
        stage_runs={
            "repository-intelligence": StageRun(runs=1, last_run_at=_hours_ago(120)),
            "threat-modeling": StageRun(runs=1, last_run_at=_hours_ago(118)),
            "security-baseline": StageRun(runs=1, last_run_at=_hours_ago(117)),
            "standard-scan": StageRun(runs=2, last_run_at=_hours_ago(72)),
            "deep-scan": StageRun(runs=1, last_run_at=_hours_ago(48)),
            "module-scan": StageRun(runs=2, last_run_at=_hours_ago(30)),
            "dependency-scan": StageRun(runs=1, last_run_at=_hours_ago(26)),
            "triage": StageRun(runs=1, last_run_at=_hours_ago(22)),
            "prioritization": StageRun(runs=1, last_run_at=_hours_ago(21)),
            "investigation": StageRun(runs=3, last_run_at=_hours_ago(9)),
            "remediation": StageRun(runs=2, last_run_at=_hours_ago(6)),
            "fix-verification": StageRun(runs=1, last_run_at=_hours_ago(1)),
        },
        severity_counts={"critical": 2, "high": 7, "medium": 12, "low": 8, "info": 2},
        funnel=Funnel(reported=48, confirmed=31, fix_applied=12, fix_verified=7),
        attention=[
            AttentionItem(id="TF-014", title="SQL injection in order search", severity="critical",
                          location="OrderRepository.java:88", state="Fix applied, not verified"),
            AttentionItem(id="TF-033", title="Webhook signature is not verified", severity="high",
                          location="WebhookController.java:41", state="Awaiting investigation"),
            AttentionItem(id="TF-021", title="Refund endpoint has no authorization check", severity="high",
                          location="RefundController.java:57", state="Awaiting fix"),
            AttentionItem(id="TF-009", title="Token signing secret stored in config file", severity="high",
                          location="application.yml:23", state="Awaiting fix"),
            AttentionItem(id="TF-027", title="Vulnerable version of a JSON parsing library", severity="medium",
                          location="pom.xml:112", state="Awaiting validation"),
        ],
        recent_uploads=[
            RecentUpload(id="up_117", folder="Scan Report-17", stage_id="fix-verification",
                         files=["JSON", "Markdown", "Manifest"], outcome="1 fix verified",
                         status="Ingested", uploaded_at=_hours_ago(1)),
            RecentUpload(id="up_116", folder="Scan Report-16", stage_id="remediation",
                         files=["JSON", "Markdown", "Manifest"], outcome="2 fixes linked to findings",
                         status="Ingested", uploaded_at=_hours_ago(6)),
            RecentUpload(id="up_109", folder="Scan Report-9", stage_id="module-scan",
                         files=["JSON", "Markdown", "SARIF", "Manifest"], outcome="4 new, 3 already known",
                         status="Ingested", uploaded_at=_hours_ago(30)),
            RecentUpload(id="up_106", folder="Scan Report-6", stage_id="deep-scan",
                         files=["JSON", "Markdown", "SARIF", "Manifest"], outcome="9 new, 5 already known",
                         status="Needs review", uploaded_at=_hours_ago(48)),
            RecentUpload(id="up_102", folder="Scan Report-2", stage_id="threat-modeling",
                         files=["JSON", "Markdown"], outcome="14 threat scenarios",
                         status="Ingested", uploaded_at=_hours_ago(118)),
        ],
    )