"""What the upload page offers."""

PHASES = [
    {
        "id": "pre-scan", "label": "Intelligence", "available": True,
        "stages": [
            {"key": "repository-intelligence", "label": "Repository intelligence",
             "description": "Application purpose, structure, architecture, entry points, data flows and integrations."},
        ],
    },
    {
        "id": "threat-modeling", "label": "Threat modeling", "available": True,
        "stages": [
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
            {"key": "prioritization", "label": "Risk prioritization & Jira handoff", "description": "Rank triaged findings and prepare Jira work before remediation starts."},
            {"key": "remediation", "label": "Remediation", "description": "Review proposed code patches, validation evidence and approval before implementation."},
        ],
    },
    {
        "id": "post-scan", "label": "Post-scan", "available": True,
        "stages": [
            {"key": "fix-verification", "label": "Post-scan verification",
             "description": "Upload the final verification package with fix checks, related-path review, closure readiness, coverage, SARIF and manifest."},
        ],
    },
]

FILE_TYPES = [
    {"kind": "json", "label": "JSON", "extensions": [".json"]},
    {"kind": "markdown", "label": "Markdown", "extensions": [".md", ".markdown"]},
    {"kind": "mermaid", "label": "Mermaid diagram", "extensions": [".mmd", ".mermaid"]},
    {"kind": "sarif", "label": "SARIF", "extensions": [".sarif", ".json"]},
    {"kind": "manifest", "label": "Manifest", "extensions": [".json", ".txt", ".sha256"]},
    {"kind": "patch", "label": "Code patch", "extensions": [".patch", ".diff"]},
    {"kind": "source", "label": "Source or proposed tests", "extensions": [".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".go", ".rb", ".php", ".cs", ".rs", ".sh", ".ps1", ".proposed"]},
]
