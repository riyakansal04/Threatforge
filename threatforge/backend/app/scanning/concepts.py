"""Meaning-based recognition of scanning-report fields.

Not a fixed field list. Each canonical concept is a set of word combinations; a key matches when it
contains all the words of a combination (so 'affected_dependency_and_area' matches both
'affected area' and 'affected dependency'). The longest / earliest match wins; ties fill every tied field.
Anything that matches nothing is kept by the adapter as a dynamic attribute.
"""
from app.mapper.util import snake

STOP = {"and", "or", "the", "of", "to", "for", "in", "is", "are", "a", "an", "by", "with", "if",
        "where", "applicable", "available", "when"}
SYN = {"recommendation": "remediation", "recommended": "remediation", "fix": "remediation",
       "behaviour": "behavior", "repo": "repository", "vuln": "vulnerability", "ref": "reference",
       "authn": "authentication", "authz": "authorization"}


def _stem(t):
    if t.endswith("ies") and len(t) > 4:
        return t[:-3] + "y"
    if t.endswith("sses"):
        return t[:-2]
    if t.endswith("s") and len(t) > 3 and not t.endswith(("ss", "us", "is")):
        return t[:-1]
    return t


def tokens(name):
    out = []
    for t in snake(str(name)).split("_"):
        if not t or t in STOP:
            continue
        t = SYN.get(_stem(t), _stem(t))
        if t not in out:
            out.append(t)
    return out


def R(*phrases):
    return [t for t in (tuple(tokens(p)) for p in phrases) if t]


# ---------------- common finding ----------------
FINDING = {
    "finding_id": R("finding id", "issue id", "vulnerability id", "rule id"),
    "source_scan_ids": R("source scan id", "source scan ids", "source scan", "contributing scan"),
    "source_finding_ids": R("source finding id", "source finding ids", "related finding"),
    "title": R("title", "name", "finding", "issue", "vulnerability", "headline"),
    "description": R("description", "detail", "summary"),
    "classification": R("classification", "status", "verdict", "disposition", "determination", "validation"),
    "severity": R("severity", "risk level"),
    "confidence": R("confidence"),
    "cwe": R("cwe"),
    "category": R("category", "weakness type", "vulnerability type", "finding type", "issue type", "weakness"),
    "affected_area": R("affected area", "affected component", "affected surface", "area", "component",
                       "module", "affected"),
    "code_location": R("code location", "location", "file", "source location", "affected file"),
    "root_cause": R("root cause", "cause"),
    "attack_path": R("attack path", "exploit path", "attack chain"),
    "impact": R("impact", "consequence"),
    "evidence": R("evidence", "proof"),
    "recommended_remediation": R("remediation"),
    "runtime_target": R("runtime target"),
    "observed_behavior": R("observed behavior", "observed", "actual behavior"),
    "expected_behavior": R("expected behavior", "expected"),
    "security_identifier": R("security identifier", "advisory", "cve", "vulnerability identifier", "identifier"),
    "affected_dependency": R("affected dependency", "dependency", "package", "library"),
    "source_references": R("source reference", "evidence reference", "reference"),
}

# a record is a finding when it carries at least two of these
CORE = {"severity", "category", "confidence", "cwe", "root_cause", "impact", "code_location",
        "recommended_remediation", "affected_area", "attack_path", "observed_behavior",
        "security_identifier", "affected_dependency"}

# ---------------- scan-specific objects ----------------
TRACE = {
    "attack_path_id": R("attack path id"),
    "attack_path_status": R("attack path status"),
    "attacker_entry_point": R("entry point", "entrypoint"),
    "attacker_controlled_input_or_action": R("attacker controlled", "controlled input", "attacker input",
                                             "attacker action"),
    "application_flow": R("application flow", "flow"),
    "security_weakness": R("security weakness", "weakness"),
    "authentication_authorization_boundary": R("authentication authorization boundary", "authentication boundary",
                                               "authorization boundary", "auth boundary"),
    "trust_boundary": R("trust boundary"),
    "sensitive_asset": R("sensitive asset", "asset"),
    "privileged_operation": R("privileged operation", "privileged"),
    "attack_conditions": R("condition", "precondition", "prerequisite"),
    "chained_weaknesses": R("chained weakness", "chained", "chain"),
    "affected_components": R("affected component"),
    "source_finding_ids": R("source finding"),
    "evidence_references": R("evidence reference", "source reference"),
    "assumptions": R("assumption"),
    "unknowns": R("unknown"),
}
DEP = {
    "dependency_name": R("dependency name", "package name", "affected dependency", "dependency", "package", "library"),
    "dependency_version": R("dependency version", "package version", "installed version", "version"),
    "dependency_type": R("dependency type", "direct", "transitive"),
    "resolution": R("resolution", "resolved", "resolved version"),
    "source": R("dependency source", "registry"),
    "installation_configuration": R("installation configuration", "installation", "install"),
    "security_identifier": R("security identifier", "cve", "advisory", "vulnerability identifier"),
    "affected_functionality": R("affected functionality", "vulnerable functionality"),
    "application_usage": R("application usage", "usage"),
    "application_reachability": R("reachability", "reachable", "application reachability",
                                  "application relevance", "relevance"),
    "affected_components": R("affected component"),
    "source_references": R("source reference", "manifest reference", "lockfile reference", "report reference"),
}
RUNTIME = {
    "runtime_target": R("runtime target"),
    "environment": R("environment"),
    "endpoint_or_interface": R("endpoint", "interface"),
    "request_or_action": R("request", "action"),
    "expected_behavior": R("expected behavior", "expected"),
    "observed_behavior": R("observed behavior", "observed", "actual behavior"),
    "authentication_context": R("authentication context"),
    "authorization_context": R("authorization context"),
    "privilege_context": R("privilege context"),
    "tenant_context": R("tenant context", "tenant"),
    "session_context": R("session context", "session"),
    "token_context": R("token context", "token"),
    "source_finding_reference": R("source finding", "related finding"),
    "attack_path_reference": R("attack path reference"),
    "runtime_evidence": R("runtime evidence"),
    "source_references": R("source reference", "evidence reference"),
    "validation_status": R("validation status", "validation result"),
}
OBJECTS = {
    "exploitable": ("attack_path_trace", TRACE),
    "supply_chain": ("dependency", DEP),
    "runtime": ("runtime_validation", RUNTIME),
}

# ---------------- scan / coverage / manifest ----------------
SCAN = {
    "scan_id": R("scan id"),
    "repository_reference": R("repository", "repository reference"),
    "scan_type": R("scan type", "scan mode", "assessment type", "mode"),
    "target": R("target", "runtime target", "target module", "target component"),
    "assessment_scope": R("scope", "assessment scope", "scan scope", "validation scope"),
    "status": R("status", "scan status", "outcome"),
    "summary": R("summary", "executive summary", "overview"),
    "scan_context": R("scan context", "context"),
    "tool": R("tool", "scanner"),
    "engine": R("engine"),
    "capabilities": R("capability"),
    "configuration_reference": R("configuration", "config", "configuration reference"),
    "started_at": R("started", "start time", "start"),
    "completed_at": R("completed", "end time", "finished", "ended", "end"),
    "pre_scan_references": R("pre scan"),
    "previous_scan_references": R("previous scan", "previous finding", "prior scan"),
    "source_context": R("source context", "input context", "inputs"),
    "finding_ids": R("finding id", "finding ids"),
    "coverage_id": R("coverage id"),
    "manifest_id": R("manifest id"),
    "artifact_ids": R("artifact id", "artifact ids"),
    "source_references": R("source reference", "report reference", "artifact reference"),
}
COVKEY = {"coverage": R("coverage")}
COVERAGE_HINT = {"c": R("coverage", "limitation", "files analyzed", "paths analyzed", "component covered", "not covered")}
COVERAGE = {
    "summary": R("summary", "overview", "description"),
    "limitations": R("limitation", "gap", "exclusion", "not covered", "out of scope"),
}
MANIFEST = {
    "run_id": R("run id"),
    "manifest_id": R("manifest id"),
    "scan_id": R("scan id"),
    "repository_reference": R("repository", "repository reference"),
    "target": R("target"),
    "start_time": R("started", "start time", "start"),
    "end_time": R("completed", "end time", "finished", "ended", "end"),
    "tool": R("tool", "scanner"),
    "capabilities": R("capability"),
    "configuration": R("configuration", "config"),
    "artifacts": R("artifact", "file", "output"),
    "status": R("status"),
    "version": R("version"),
    "artifact_reference": R("artifact reference", "source artifact", "manifest artifact"),
}

_memo = {}


def match(rules, key):
    """-> (score, [canonical names]) of the best rule(s); (None, []) when nothing matches."""
    ck = (id(rules), key)
    if ck in _memo:
        return _memo[ck]
    order = tokens(key)
    ks = set(order)
    best, names = None, []
    for canon, combos in rules.items():
        for combo in combos:
            if set(combo) <= ks:
                sc = (len(combo), -min(order.index(t) for t in combo))
                if best is None or sc > best:
                    best, names = sc, [canon]
                elif sc == best and canon not in names:
                    names.append(canon)
    _memo[ck] = (best, names)
    return best, names


def is_finding(rec) -> bool:
    if not isinstance(rec, dict):
        return False
    got = set()
    for k, v in rec.items():
        if v is None or v == "" or v == [] or v == {}:
            continue
        got.update(match(FINDING, str(k))[1])
    return len(got & CORE) >= 2
