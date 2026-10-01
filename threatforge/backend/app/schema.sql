-- ThreatForge pre-scan schema (PostgreSQL). Applied automatically on start-up.

CREATE TABLE IF NOT EXISTS analysis_runs (
    id          BIGSERIAL PRIMARY KEY,
    stage_key   TEXT        NOT NULL,
    file_count  INT         NOT NULL DEFAULT 0,
    counts      JSONB       NOT NULL DEFAULT '{}'::jsonb,
    warnings    JSONB       NOT NULL DEFAULT '[]'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS codebases (
    id          BIGSERIAL PRIMARY KEY,
    name        TEXT        NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO codebases (id, name) VALUES (1, 'Default codebase') ON CONFLICT DO NOTHING;
SELECT setval(pg_get_serial_sequence('codebases', 'id'), GREATEST((SELECT max(id) FROM codebases), 1));

ALTER TABLE analysis_runs ADD COLUMN IF NOT EXISTS codebase_id BIGINT;
UPDATE analysis_runs SET codebase_id = 1 WHERE codebase_id IS NULL;
ALTER TABLE analysis_runs ALTER COLUMN codebase_id SET DEFAULT 1;
CREATE INDEX IF NOT EXISTS analysis_runs_codebase ON analysis_runs (codebase_id);

-- Every uploaded file is kept as evidence. Secret values are masked in the stored text.
CREATE TABLE IF NOT EXISTS artifacts (
    id          BIGSERIAL PRIMARY KEY,
    run_id      BIGINT      NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
    stage_key   TEXT        NOT NULL,
    filename    TEXT        NOT NULL,
    kind        TEXT        NOT NULL,
    size_bytes  BIGINT      NOT NULL,
    sha256      TEXT        NOT NULL,
    redacted    BOOLEAN     NOT NULL DEFAULT FALSE,
    content     TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS artifacts_stage_sha ON artifacts (stage_key, sha256);
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS codebase_id BIGINT;
UPDATE artifacts a SET codebase_id = COALESCE((SELECT r.codebase_id FROM analysis_runs r WHERE r.id = a.run_id), 1)
WHERE a.codebase_id IS NULL;
ALTER TABLE artifacts ALTER COLUMN codebase_id SET DEFAULT 1;
CREATE INDEX IF NOT EXISTS artifacts_codebase ON artifacts (codebase_id);

-- One row each (id is always 1).
CREATE TABLE IF NOT EXISTS repository_intelligence (
    id SMALLINT PRIMARY KEY CHECK (id = 1), data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS threat_models (
    id SMALLINT PRIMARY KEY CHECK (id = 1), data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS security_baselines (
    id SMALLINT PRIMARY KEY CHECK (id = 1), data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Many records each.
CREATE TABLE IF NOT EXISTS threats (
    id BIGSERIAL PRIMARY KEY, item_key TEXT NOT NULL UNIQUE, data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS threat_relationships (
    id BIGSERIAL PRIMARY KEY, item_key TEXT NOT NULL UNIQUE, data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS scan_focus (
    id BIGSERIAL PRIMARY KEY, item_key TEXT NOT NULL UNIQUE, data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS threat_convergence (
    id BIGSERIAL PRIMARY KEY, item_key TEXT NOT NULL UNIQUE, data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS finding_lifecycle_overviews (
    id SMALLINT PRIMARY KEY CHECK (id = 1), data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS post_scan_overviews (
    id SMALLINT PRIMARY KEY CHECK (id = 1), data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS triage_overviews (
    id SMALLINT PRIMARY KEY CHECK (id = 1), data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS prioritization_overviews (
    id SMALLINT PRIMARY KEY CHECK (id = 1), data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS investigation_overviews (
    id SMALLINT PRIMARY KEY CHECK (id = 1), data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS remediation_overviews (
    id SMALLINT PRIMARY KEY CHECK (id = 1), data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fix_verification_overviews (
    id SMALLINT PRIMARY KEY CHECK (id = 1), data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS regression_overviews (
    id SMALLINT PRIMARY KEY CHECK (id = 1), data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS closure_overviews (
    id SMALLINT PRIMARY KEY CHECK (id = 1), data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS lifecycle_findings (
    id BIGSERIAL PRIMARY KEY, item_key TEXT NOT NULL UNIQUE, data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS triage_decisions (
    id BIGSERIAL PRIMARY KEY, item_key TEXT NOT NULL UNIQUE, data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS finding_relationships (
    id BIGSERIAL PRIMARY KEY, item_key TEXT NOT NULL UNIQUE, data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS priority_queue_items (
    id BIGSERIAL PRIMARY KEY, item_key TEXT NOT NULL UNIQUE, data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS remediations (
    id BIGSERIAL PRIMARY KEY, item_key TEXT NOT NULL UNIQUE, data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS targeted_verifications (
    id BIGSERIAL PRIMARY KEY, item_key TEXT NOT NULL UNIQUE, data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS regression_verifications (
    id BIGSERIAL PRIMARY KEY, item_key TEXT NOT NULL UNIQUE, data JSONB NOT NULL
);
CREATE TABLE IF NOT EXISTS closure_assessments (
    id BIGSERIAL PRIMARY KEY, item_key TEXT NOT NULL UNIQUE, data JSONB NOT NULL
);

-- Reusable link between a dashboard item and its source location.
CREATE TABLE IF NOT EXISTS evidence (
    id           BIGSERIAL PRIMARY KEY,
    stage_key    TEXT  NOT NULL,
    entity_type  TEXT  NOT NULL,
    owner_label  TEXT  NOT NULL,
    reference    JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS evidence_stage ON evidence (stage_key);
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS codebase_id BIGINT;
UPDATE evidence SET codebase_id = 1 WHERE codebase_id IS NULL;
ALTER TABLE evidence ALTER COLUMN codebase_id SET DEFAULT 1;
CREATE INDEX IF NOT EXISTS evidence_codebase ON evidence (codebase_id);


ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS scan_id BIGINT;
CREATE INDEX IF NOT EXISTS artifacts_scan ON artifacts (scan_id);

CREATE TABLE IF NOT EXISTS scans (
    id         BIGSERIAL PRIMARY KEY,
    run_id     BIGINT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
    stage_key  TEXT NOT NULL,
    scan_type  TEXT NOT NULL,
    data       JSONB NOT NULL,
    coverage   JSONB,
    manifest   JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS findings (
    id       BIGSERIAL PRIMARY KEY,
    scan_id  BIGINT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    item_key TEXT NOT NULL,
    data     JSONB NOT NULL,
    UNIQUE (scan_id, item_key)
);
CREATE INDEX IF NOT EXISTS findings_scan ON findings (scan_id);

CREATE TABLE IF NOT EXISTS scan_evidence (
    id          BIGSERIAL PRIMARY KEY,
    scan_id     BIGINT NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    finding_id  BIGINT REFERENCES findings(id) ON DELETE CASCADE,
    artifact_id BIGINT,
    origin      TEXT,
    location    TEXT,
    description TEXT,
    reference   JSONB
);
CREATE INDEX IF NOT EXISTS scan_evidence_scan ON scan_evidence (scan_id);
