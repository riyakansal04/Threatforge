"""What the upload page offers. Only the pre-scan phase can be ingested for now."""

PHASES = [
    {
        "id": "pre-scan", "label": "Pre-scan", "available": True,
        "stages": [
            {"key": "repository-intelligence", "label": "Repository intelligence",
             "description": "Structure, architecture, entry points, data flows and integrations."},
            {"key": "threat-modeling", "label": "Architecture & threat modeling",
             "description": "Assets, trust boundaries, actors, threats and attack paths."},
            {"key": "security-baseline", "label": "Security assessment & scan planning",
             "description": "Security-critical surfaces and where each later scan should focus."},
        ],
    },
        {
        "id": "scanning", "label": "Scanning", "available": True,
        "stages": [
            {"key": "standard-scan", "label": "Standard scan",
             "description": "Broad assessment of the security surfaces found during pre-scan."},
            {"key": "deep-scan", "label": "Deep scan",
             "description": "Focused deep analysis of critical or uncertain areas."},
            {"key": "module-scan", "label": "Module scan",
             "description": "Focused assessment of one module, component or service."},
            {"key": "exploitable-scan", "label": "Exploitable scan",
             "description": "Attacker-perspective attack paths and chained weaknesses."},
            {"key": "dependency-scan", "label": "Supply-chain / dependency scan",
             "description": "Third-party dependencies and their relevance to the application."},
            {"key": "runtime-validation", "label": "Runtime / dynamic validation",
             "description": "Expected versus observed security behavior in a running environment."},
        ],
    },
    {
        "id": "findings", "label": "Findings & cases", "available": True,
        "stages": [
            {"key": "triage", "label": "Triage & deduplication", "description": "Validate, classify, correlate and deduplicate scan findings."},
            {"key": "prioritization", "label": "Risk, priority & remediation planning", "description": "Turn validated findings into an actionable remediation queue."},
            {"key": "investigation", "label": "Finding investigation", "description": "Investigation context used to determine remediation."},
            {"key": "remediation", "label": "Remediation / fix", "description": "Proposed or implemented fix details, validation and risk notes."},
        ],
    },
    {
        "id": "post-scan", "label": "Post-scan", "available": True,
        "stages": [
            {"key": "fix-verification", "label": "Targeted fix verification", "description": "Re-test the specific remediated vulnerability."},
            {"key": "regression", "label": "Regression & related-path verification", "description": "Check related paths and obvious security regressions."},
            {"key": "closure", "label": "Closure & evidence assessment", "description": "Decide whether evidence supports closing the finding."},
        ],
    },
]

FILE_TYPES = [
    {"kind": "json", "label": "JSON", "extensions": [".json"]},
    {"kind": "markdown", "label": "Markdown", "extensions": [".md", ".markdown"]},
    {"kind": "mermaid", "label": "Mermaid diagram", "extensions": [".mmd", ".mermaid"]},
    {"kind": "sarif", "label": "SARIF", "extensions": [".sarif", ".json"]},
    {"kind": "manifest", "label": "Manifest", "extensions": [".json", ".txt", ".sha256"]},
]
