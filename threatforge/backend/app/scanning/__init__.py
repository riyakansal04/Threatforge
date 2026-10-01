"""Scanning stage: one upload of a scanning stage becomes one Scan with findings, coverage, manifest, artifacts."""

SCAN_STAGES = {
    "standard-scan": {"scan_type": "standard", "label": "Standard scan"},
    "deep-scan": {"scan_type": "deep", "label": "Deep scan"},
    "module-scan": {"scan_type": "module", "label": "Module scan"},
    "exploitable-scan": {"scan_type": "exploitable", "label": "Exploitable scan"},
    "dependency-scan": {"scan_type": "supply_chain", "label": "Supply-chain / dependency scan"},
    "runtime-validation": {"scan_type": "runtime", "label": "Runtime / dynamic validation"},
}