"""Response models for GET /api/overview.

Python fields are snake_case; the JSON sent to the frontend is camelCase
(stage_runs -> stageRuns), matching frontend/src/api/mockOverview.js.
"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Project(ApiModel):
    id: str
    name: str
    repository: str


class StageRun(ApiModel):
    runs: int
    last_run_at: datetime


class Funnel(ApiModel):
    reported: int
    confirmed: int
    fix_applied: int
    fix_verified: int


class AttentionItem(ApiModel):
    id: str
    title: str
    severity: str  # critical | high | medium | low | info
    location: str
    state: str


class RecentUpload(ApiModel):
    id: str
    folder: str
    stage_id: str  # must match a stage id in frontend/src/config/lifecycle.js
    files: list[str]
    outcome: str
    status: str  # "Ingested" | "Needs review"
    uploaded_at: datetime


class OverviewResponse(ApiModel):
    project: Project
    stage_runs: dict[str, StageRun]  # key = stage id, e.g. "standard-scan"
    severity_counts: dict[str, int]  # critical, high, medium, low, info
    funnel: Funnel
    attention: list[AttentionItem]
    recent_uploads: list[RecentUpload]