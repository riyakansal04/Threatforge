"""Turns uploaded files into canonical entities. Matching is by field meaning, not by file name."""
from dataclasses import dataclass, field

from app.mapper.fields import IGNORED_KEYS, STAGES, dynamic_field_name, is_known_field_name, is_record_key
from app.mapper.readers import Upload, sarif_references
from app.mapper.util import (as_list, as_text, is_empty, merge_lists, normalize_refs, snake)


def collect(node, match, out: dict, depth: int = 0, unmatched=None, path: str = ""):
    """Finds known fields anywhere in the content. A matched value is not searched any deeper.
    If `unmatched` is a list, it receives the paths of keys that carry content but matched nothing."""
    if depth > 6:
        return
    if isinstance(node, dict):
        for k, v in node.items():
            canons = match(k)
            if canons:
                for c in canons:
                    out.setdefault(c, []).append(v)
            elif not is_record_key(k):
                if (unmatched is not None and not isinstance(v, (dict, bool))
                        and not is_empty(v) and k not in IGNORED_KEYS):
                    unmatched.append(f"{path}{k}")
                collect(v, match, out, depth + 1, unmatched if isinstance(v, dict) else None, f"{path}{k}/")
    elif isinstance(node, list):
        for i in node:
            collect(i, match, out, depth + 1, None, path)


def collect_dynamic(node, out: dict, depth: int = 0):
    """Collect any meaningful keys that were not matched to the known stage schema."""
    if depth > 6:
        return
    if isinstance(node, dict):
        for k, v in node.items():
            if is_known_field_name(k):
                continue
            name = dynamic_field_name(k)
            if name and not is_empty(v):
                out.setdefault(name, []).append(v)
            if not is_record_key(k) and k not in IGNORED_KEYS:
                collect_dynamic(v, out, depth + 1)
    elif isinstance(node, list):
        for item in node:
            collect_dynamic(item, out, depth + 1)


def _has_content(values) -> bool:
    return bool(values) and any(not is_empty(v) for v in values)


def _first_present(node: dict, *keys):
    if not isinstance(node, dict):
        return None
    for key in keys:
        if not is_empty(node.get(key)):
            return node.get(key)
    return None


def _list_from(value, key_field: str = "name") -> list:
    return as_list(value, key_field)


def _summary_text(value):
    if isinstance(value, dict):
        return as_text(_first_present(value, "summary", "description", "purpose", "text", "detail") or value)
    return as_text(value)


def _startup_steps(value):
    if isinstance(value, dict):
        steps = value.get("steps") or value.get("startup_steps") or value.get("startup_sequence")
        refs = normalize_refs(value.get("evidence") or value.get("source_references"))
        out = []
        for n, step in enumerate(as_list(steps, "description"), 1):
            item = step if isinstance(step, dict) else {"description": as_text(step)}
            item = dict(item)
            item.setdefault("step", n)
            if refs and is_empty(item.get("source_references")) and is_empty(item.get("evidence")):
                item["source_references"] = refs
            out.append(item)
        return out
    return as_list(value, "description")


def _split_assumptions_unknowns(items):
    assumptions, unknowns = [], []
    for item in as_list(items, "item"):
        if isinstance(item, dict):
            status = as_text(item.get("status")).lower()
            target = unknowns if "unknown" in status or "unresolved" in status or "incomplete" in status else assumptions
            target.append(item)
        else:
            unknowns.append(item)
    return assumptions, unknowns


def augment_repository_intelligence(tree):
    """Derive canonical RI fields from common rich report shapes without requiring one strict prompt schema."""
    if not isinstance(tree, dict):
        return tree
    extra = {}

    app = _first_present(tree, "application", "application_summary", "project", "system") or {}
    if isinstance(app, dict):
        purpose = _first_present(app, "purpose", "application_purpose", "summary")
        if purpose is not None:
            extra["purpose"] = _summary_text(purpose)
        functionality = _first_present(app, "primary_functionality", "functionality", "business_functionality", "workflows")
        if not is_empty(app.get("primary_functionality")):
            extra["primary_workflows"] = app.get("primary_functionality")
        elif functionality is not None:
            extra["business_functionality"] = functionality
        scope = _first_present(app, "scope", "repository_scope", "application_scope")
        if scope is not None:
            extra["repository_scope"] = _summary_text(scope)

    tech = _first_present(tree, "technology_stack", "tech_stack", "stack") or {}
    if isinstance(tech, dict):
        languages = _first_present(tech, "languages", "language", "programming_languages")
        frameworks = _first_present(tech, "frameworks", "web_framework", "framework")
        runtimes = _first_present(tech, "runtimes", "runtime", "runtime_environments", "deployment_and_execution")
        libraries = _first_present(tech, "libraries", "runtime_libraries", "packages")
        dependencies = _first_present(tech, "dependencies", "third_party_dependencies")
        if languages is not None:
            extra["languages"] = _list_from(languages)
        if frameworks is not None:
            extra["frameworks"] = _list_from(frameworks)
        if runtimes is not None:
            extra["runtimes"] = _list_from(runtimes)
        if libraries is not None:
            extra["libraries"] = _list_from(libraries)
        if dependencies is not None:
            extra["dependencies"] = _list_from(dependencies)

    data = _first_present(tree, "data_architecture", "dataArchitecture", "data") or {}
    if isinstance(data, dict):
        stores = _first_present(data, "data_stores", "storage_mechanisms", "storage", "databases")
        models = _first_present(data, "data_models", "logical_models", "models", "schemas")
        flows = _first_present(data, "data_flows", "information_flows", "important_data_flows")
        if stores is not None:
            extra["data_stores"] = stores
        if models is not None:
            extra["data_models"] = models
        if flows is not None:
            extra["data_flows"] = flows

    interfaces = _first_present(tree, "interfaces_and_integrations", "interfacesAndIntegrations", "interfaces", "api_surface") or {}
    if isinstance(interfaces, dict):
        routes = _first_present(interfaces, "routes", "http_routes", "api_routes", "endpoints")
        external = _first_present(interfaces, "external_integrations", "integrations", "external_services")
        webhooks = _first_present(interfaces, "webhooks", "callbacks")
        if routes is not None:
            extra["routes"] = routes
        if external is not None:
            extra["integrations"] = external
            extra["external_services"] = external
        if webhooks is not None:
            extra["webhooks"] = webhooks

    flow = _first_present(tree, "execution_flow", "executionFlow", "runtime_flow", "architecture_flow") or {}
    if isinstance(flow, dict):
        startup = _first_present(flow, "startup", "startup_flow", "startup_sequence")
        request = _first_present(flow, "request_handling", "request_flows", "execution_flows")
        relationships = _first_present(flow, "inferred_runtime_relationships", "runtime_relationships")
        if startup is not None:
            extra["startup_flow"] = _startup_steps(startup)
        exec_flows = []
        if request is not None:
            exec_flows += _list_from(request, "description")
        if relationships is not None:
            exec_flows += _list_from(relationships, "relationship")
        if exec_flows:
            extra["execution_flows"] = exec_flows

    security = _first_present(tree, "security_relevant_implementation", "securityRelevantImplementation", "security") or {}
    if isinstance(security, dict):
        for src, dest in (
            ("authentication", "authentication"),
            ("authorization", "authorization"),
            ("security_controls", "security_controls"),
            ("cryptography_and_secrets", "security_controls"),
            ("privileged_functionality", "privileged_functionality"),
            ("privileged_operations", "privileged_functionality"),
            ("sensitive_processing", "sensitive_processing"),
            ("sensitive_operations", "sensitive_processing"),
        ):
            if not is_empty(security.get(src)):
                extra[dest] = merge_lists(extra.get(dest, []), _list_from(security[src]))

    assumptions = _first_present(tree, "assumptions", "assumptions_and_unknowns", "assumptionsAndUnknowns")
    if assumptions is not None:
        a, u = _split_assumptions_unknowns(assumptions)
        if a:
            extra["assumptions"] = a
        if u:
            extra["unknowns"] = u

    if not extra:
        return tree
    augmented = dict(tree)
    for grouped_key in (
        "interfaces_and_integrations",
        "execution_flow",
        "data_architecture",
        "technology_stack",
        "security_relevant_implementation",
        "assumptions_and_unknowns",
        "application",
    ):
        augmented.pop(grouped_key, None)
    for key, value in extra.items():
        if not is_empty(value):
            augmented.setdefault(key, value)
    return augmented


def _with_evidence(item, refs):
    if not refs:
        return item
    if isinstance(item, dict):
        out = dict(item)
        if is_empty(out.get("source_references")) and is_empty(out.get("evidence")):
            out["source_references"] = refs
        return out
    return item


def _split_assumptions_unknowns_by_id(items):
    assumptions, unknowns = [], []
    for item in as_list(items, "description"):
        if isinstance(item, dict):
            ident = as_text(item.get("id")).lower()
            status = as_text(item.get("status")).lower()
            text = " ".join([ident, status, as_text(item.get("description")).lower()])
            target = unknowns if "unknown" in text or "unresolved" in text or "incomplete" in text else assumptions
            target.append(item)
        else:
            unknowns.append(item)
    return assumptions, unknowns


def augment_threat_model(tree):
    """Derive canonical threat-model fields from rich nested report shapes."""
    if not isinstance(tree, dict):
        return tree
    root = _first_present(tree, "threatModel", "threat_model", "threatModeling", "threat_modeling") or tree
    extra = {}

    if isinstance(root, dict):
        summary = _first_present(root, "summary", "overview", "applicationContext", "application_context")
        if isinstance(summary, dict):
            summary_parts = []
            for key in ("application", "purpose", "architecture", "normalDeployment", "normal_deployment"):
                if not is_empty(summary.get(key)):
                    summary_parts.append(f"{key}: {as_text(summary[key])}")
            if summary_parts:
                extra["summary"] = "; ".join(summary_parts)
            if not is_empty(summary.get("evidence")):
                extra["source_references"] = summary.get("evidence")
            context = []
            for key in ("application", "purpose", "architecture", "normalDeployment", "normal_deployment"):
                if not is_empty(summary.get(key)):
                    context.append({"name": key, "description": summary[key]})
            if context:
                extra["application_context"] = context
        elif not is_empty(summary):
            extra["summary"] = _summary_text(summary)

        for src, dest in (
            ("assets", "assets"),
            ("sensitiveData", "sensitive_data"),
            ("sensitive_data", "sensitive_data"),
            ("criticalBusinessFunctions", "critical_business_functions"),
            ("critical_business_functions", "critical_business_functions"),
            ("privilegedOperations", "privileged_operations"),
            ("privileged_operations", "privileged_operations"),
            ("trustBoundaries", "trust_boundaries"),
            ("trust_boundaries", "trust_boundaries"),
            ("securityObjectives", "security_objectives"),
            ("security_objectives", "security_objectives"),
            ("threatActors", "threat_actors"),
            ("threat_actors", "threat_actors"),
            ("attackerCapabilities", "attacker_capabilities"),
            ("attacker_capabilities", "attacker_capabilities"),
            ("architecturalWeaknesses", "architectural_weaknesses"),
            ("architectural_weaknesses", "architectural_weaknesses"),
        ):
            if not is_empty(root.get(src)):
                extra[dest] = merge_lists(extra.get(dest, []), _list_from(root[src], "description"))

        entry_points = []
        for actor in as_list(_first_present(root, "threatActors", "threat_actors"), "name"):
            if isinstance(actor, dict) and not is_empty(actor.get("entryPoints")):
                for ep in as_list(actor.get("entryPoints"), "name"):
                    entry_points.append({
                        "entry_point": ep,
                        "actor": _first_present(actor, "name", "id"),
                        "source_references": normalize_refs(actor.get("basis") or actor.get("evidence")),
                    })
        if entry_points:
            extra["security_sensitive_entry_points"] = entry_points

        boundary_rels = []
        for boundary in as_list(_first_present(root, "trustBoundaries", "trust_boundaries"), "name"):
            if isinstance(boundary, dict):
                desc = _first_present(boundary, "description", "transferredDataOrAuthority", "transferred_data_or_authority")
                if desc is not None:
                    boundary_rels.append(_with_evidence({
                        "boundary": _first_present(boundary, "name", "id"),
                        "description": desc,
                    }, normalize_refs(boundary.get("evidence"))))
        if boundary_rels:
            extra["internal_external_trust_relationships"] = boundary_rels

        assumptions = _first_present(root, "assumptions", "assumptionsAndUnknowns", "assumptions_and_unknowns")
        if assumptions is not None:
            a, u = _split_assumptions_unknowns_by_id(assumptions)
            if a:
                extra["assumptions"] = a
            if u:
                extra["unknowns"] = u

    if not is_empty(tree.get("sourceReferences")):
        extra["source_references"] = merge_lists(extra.get("source_references", []), normalize_refs(tree.get("sourceReferences")))
    if not is_empty(tree.get("source_references")):
        extra["source_references"] = merge_lists(extra.get("source_references", []), normalize_refs(tree.get("source_references")))

    if not extra:
        return tree
    augmented = dict(tree)
    for grouped_key in ("threatModel", "threat_model", "threatModeling", "threat_modeling", "sourceReferences"):
        augmented.pop(grouped_key, None)
    for key, value in extra.items():
        if not is_empty(value):
            augmented.setdefault(key, value)
    return augmented


def _scan_target_summary(target):
    if not isinstance(target, dict):
        return as_text(target)
    bits = []
    for key in ("type", "path", "runtime"):
        if not is_empty(target.get(key)):
            bits.append(as_text(target[key]))
    for key in ("primaryFiles", "primary_files", "components", "entryPoints", "entry_points", "interfaces",
                "files", "backends", "dependencyFamilies", "dependency_families"):
        if not is_empty(target.get(key)):
            vals = [as_text(v) for v in as_list(target[key]) if as_text(v)]
            if vals:
                bits.append(f"{key}: {', '.join(vals[:8])}{' +' + str(len(vals) - 8) + ' more' if len(vals) > 8 else ''}")
    return "; ".join(bits) or as_text(target)


def _normalize_scan_focus_item(item):
    if not isinstance(item, dict):
        return {"name": as_text(item)}
    out = dict(item)
    if not is_empty(out.get("id")):
        out.setdefault("scan_id", out.get("id"))
    if not is_empty(_first_present(out, "scanCapability", "scan_capability")):
        out.setdefault("scan_type", _first_present(out, "scanCapability", "scan_capability"))
    if not is_empty(_first_present(out, "assessmentObjective", "assessment_objective")):
        out.setdefault("assessment_objective", _first_present(out, "assessmentObjective", "assessment_objective"))
    if not is_empty(_first_present(out, "whyThisScope", "why_this_scope")):
        out.setdefault("why_this_scope", _first_present(out, "whyThisScope", "why_this_scope"))
        out.setdefault("reason", _first_present(out, "whyThisScope", "why_this_scope"))
    if not is_empty(_first_present(out, "relatedThreats", "related_threats")):
        out.setdefault("related_threats", _first_present(out, "relatedThreats", "related_threats"))
        out.setdefault("threat_context", _first_present(out, "relatedThreats", "related_threats"))
    if not is_empty(_first_present(out, "relatedApplicationReferences", "related_application_references")):
        out.setdefault("related_application_references", _first_present(out, "relatedApplicationReferences", "related_application_references"))
    if not is_empty(_first_present(out, "expectedCoverage", "expected_coverage")):
        out.setdefault("expected_coverage", _first_present(out, "expectedCoverage", "expected_coverage"))
    if not is_empty(_first_present(out, "requiredPrerequisites", "required_prerequisites")):
        out.setdefault("required_prerequisites", _first_present(out, "requiredPrerequisites", "required_prerequisites"))
    target = out.get("target")
    if isinstance(target, dict):
        out.setdefault("target_details", [
            {"name": key, "description": value}
            for key, value in target.items()
            if not is_empty(value)
        ])
        out["target"] = _scan_target_summary(target)
    scope = out.get("scopeAndBoundaries") or out.get("scope_and_boundaries")
    if isinstance(scope, dict):
        if not is_empty(scope.get("included")):
            out.setdefault("scope_included", scope.get("included"))
        if not is_empty(scope.get("excluded")):
            out.setdefault("scope_excluded", scope.get("excluded"))
    return out


def augment_security_baseline(tree):
    """Derive canonical scan-planning fields from rich Stage 3 assessment-plan reports."""
    if not isinstance(tree, dict):
        return tree
    root = _first_present(tree, "assessmentPlan", "assessment_plan", "securityAssessmentPlan", "security_assessment_plan") or tree
    extra = {}

    if isinstance(root, dict):
        for src, dest in (
            ("planningGoal", "planning_goal"),
            ("planning_goal", "planning_goal"),
            ("overallPriorityRationale", "overall_priority_rationale"),
            ("overall_priority_rationale", "overall_priority_rationale"),
            ("selectedCapabilities", "selected_capabilities"),
            ("selected_capabilities", "selected_capabilities"),
            ("notSelectedCapabilities", "not_selected_capabilities"),
            ("not_selected_capabilities", "not_selected_capabilities"),
            ("assessmentObjectives", "assessment_objectives"),
            ("assessment_objectives", "assessment_objectives"),
            ("executionOrder", "execution_order"),
            ("execution_order", "execution_order"),
            ("dependencies", "dependencies"),
            ("coverageGaps", "coverage_gaps"),
            ("coverage_gaps", "coverage_gaps"),
            ("assumptions", "assumptions"),
        ):
            if not is_empty(root.get(src)):
                value = root.get(src)
                if dest.endswith("_rationale") or dest.endswith("_goal"):
                    extra[dest] = _summary_text(value)
                else:
                    extra[dest] = merge_lists(extra.get(dest, []), _list_from(value, "description"))

    focus = _first_present(tree, "ScanFocus", "scanFocus", "scan_focus", "recommendedScanFocus", "recommended_scan_focus")
    if focus is not None:
        extra["scan_focus"] = [_normalize_scan_focus_item(item) for item in as_list(focus, "name")]

    if not extra:
        return tree
    augmented = dict(tree)
    for grouped_key in ("assessmentPlan", "assessment_plan", "securityAssessmentPlan", "security_assessment_plan", "ScanFocus", "scanFocus"):
        augmented.pop(grouped_key, None)
    for key, value in extra.items():
        if not is_empty(value):
            if key == "scan_focus":
                augmented[key] = value
            else:
                augmented.setdefault(key, value)
    return augmented


def _looks_like_triage_finding(item) -> bool:
    if not isinstance(item, dict):
        return False
    keys = {snake(k) for k in item}
    id_keys = {"finding_id", "original_finding_id", "id", "case_id"}
    triage_keys = {
        "triage_technical_verdict",
        "evidence_to_claim_analysis",
        "implementation_and_reachability",
        "root_cause_analysis",
        "validation_assessment",
        "false_positive_reasoning",
        "technical_conclusion",
        "exploitability_stack_rank",
    }
    return bool(keys & id_keys) and bool(keys & triage_keys)


def _triage_rows(root):
    candidates = [
        _first_present(root, "triage_decisions", "triageDecisions", "decisions", "triage_results"),
        _first_present(root, "Finding", "finding", "findings", "Findings"),
        _first_present(root, "findingAssessments", "finding_assessments", "triageFindings", "triage_findings"),
    ]
    rows = []
    for candidate in candidates:
        if candidate is None:
            continue
        for item in as_list(candidate, "title"):
            if _looks_like_triage_finding(item):
                rows.append(dict(item))
    return rows


def _summary_metric(summary: dict, key: str, label: str):
    if not isinstance(summary, dict) or is_empty(summary.get(key)):
        return None
    return {"name": label, "value": summary.get(key)}


def _triage_summary_rows(summary: dict) -> list:
    if not isinstance(summary, dict):
        return []
    pairs = [
        ("findingsReviewed", "Findings reviewed"),
        ("findings_reviewed", "Findings reviewed"),
        ("confirmed", "Confirmed"),
        ("needsReview", "Needs review"),
        ("needs_review", "Needs review"),
        ("notActionable", "Not actionable"),
        ("not_actionable", "Not actionable"),
        ("trueDuplicates", "True duplicates"),
        ("true_duplicates", "True duplicates"),
        ("relatedFindingLinks", "Related finding links"),
        ("related_finding_links", "Related finding links"),
    ]
    out = []
    seen = set()
    for key, label in pairs:
        metric = _summary_metric(summary, key, label)
        if metric and label not in seen:
            out.append(metric)
            seen.add(label)
    return out


def _triage_relationship_rows(rows: list) -> list:
    relationships = []
    for row in rows:
        source = as_text(_first_present(row, "findingId", "finding_id", "originalFindingId", "original_finding_id", "id"))
        if not source:
            continue
        for related in as_list(_first_present(row, "relatedFindings", "related_findings", "linkedFindings"), "findingId"):
            if isinstance(related, dict):
                target = as_text(_first_present(related, "findingId", "finding_id", "target", "to", "id"))
                rel_type = as_text(_first_present(related, "relationship", "relationship_type", "type", "kind"))
                desc = as_text(_first_present(related, "description", "reason", "summary", "relationship"))
            else:
                target = as_text(related)
                rel_type = "related"
                desc = ""
            if not target:
                continue
            relationships.append({
                "relationship_id": f"{source}>{target}:{rel_type or 'related'}",
                "source_finding_id": source,
                "target_finding_id": target,
                "relationship_type": rel_type or "related",
                "description": desc or rel_type or "Related finding",
            })
    return relationships


def _reference_rows(value) -> list:
    if not isinstance(value, dict):
        return as_list(value)
    return [
        {"name": key, "value": item}
        for key, item in value.items()
        if not is_empty(item)
    ]


def augment_triage(tree):
    """Derive canonical triage lifecycle fields from structured finding-triage reports."""
    if not isinstance(tree, dict):
        return tree
    root = _first_present(tree, "triage", "triageReport", "triage_report", "findingTriage", "finding_triage") or tree
    if not isinstance(root, dict):
        return tree

    rows = _triage_rows(root)
    summary = _first_present(root, "summary", "triageSummary", "triage_summary") or {}
    if not rows and not isinstance(summary, dict):
        return tree

    extra = {}
    if rows:
        extra["triage_decisions"] = rows
        extra["findings"] = rows
        relationships = _triage_relationship_rows(rows)
        if relationships:
            extra["finding_relationships"] = relationships

    identity = _first_present(root, "triageIdentity", "triage_identity", "identity") or {}
    if isinstance(identity, dict):
        method = _first_present(identity, "mode", "method", "name", "approach")
        if method is not None:
            extra["triage_method"] = _summary_text(method)

    metrics = _triage_summary_rows(summary)
    if metrics:
        extra["classification_summary"] = metrics

    inputs = _first_present(root, "inputReferences", "input_references", "inputs", "sourceInputs", "source_inputs")
    if inputs is not None:
        extra["context_inputs"] = _reference_rows(inputs)

    if isinstance(summary, dict):
        flags = []
        for src, label in (
            ("sourceModified", "Source modified"),
            ("source_modified", "Source modified"),
            ("runtimeValidationPerformed", "Runtime validation performed"),
            ("runtime_validation_performed", "Runtime validation performed"),
        ):
            if not is_empty(summary.get(src)):
                flags.append({"name": label, "value": summary.get(src)})
        if flags:
            extra["coverage"] = flags

    if not extra:
        return tree
    augmented = dict(tree)
    for grouped_key in (
        "Finding",
        "finding",
        "findings",
        "Findings",
        "findingAssessments",
        "finding_assessments",
        "triageFindings",
        "triage_findings",
        "triageIdentity",
        "triage_identity",
        "identity",
        "inputReferences",
        "input_references",
        "summary",
        "triageSummary",
        "triage_summary",
    ):
        augmented.pop(grouped_key, None)
    for key, value in extra.items():
        if not is_empty(value):
            augmented.setdefault(key, value)
    return augmented


def _looks_like_priority_finding(item) -> bool:
    if not isinstance(item, dict):
        return False
    keys = {snake(k) for k in item}
    id_keys = {"finding_id", "logical_finding_id", "id", "case_id"}
    priority_keys = {
        "proposed_priority",
        "priority",
        "priority_rationale",
        "risk_factors",
        "urgency_and_dependencies",
    }
    return bool(keys & id_keys) and bool(keys & priority_keys)


def _priority_rows(root):
    candidates = [
        _first_present(root, "priority_queue", "priorityQueue", "prioritized_findings", "queue_items"),
        _first_present(root, "Finding", "finding", "findings", "Findings"),
        _first_present(root, "risk_findings", "riskFindings", "risk_prioritization"),
    ]
    rows = []
    for candidate in candidates:
        if candidate is None:
            continue
        for item in as_list(candidate, "title"):
            if _looks_like_priority_finding(item):
                rows.append(_normalize_priority_item(item))
    return rows


def _priority_summary_rows(summary: dict) -> list:
    if not isinstance(summary, dict):
        return []
    pairs = [
        ("eligible_findings_assessed", "Eligible findings assessed"),
        ("eligibleFindingsAssessed", "Eligible findings assessed"),
        ("critical", "Critical"),
        ("high", "High"),
        ("medium", "Medium"),
        ("low", "Low"),
        ("informational", "Informational"),
        ("findings_without_definitive_priority", "Without definitive priority"),
        ("findingsWithoutDefinitivePriority", "Without definitive priority"),
        ("runtime_validation_performed", "Runtime validation performed"),
        ("runtimeValidationPerformed", "Runtime validation performed"),
        ("dashboard_decisions_made", "Dashboard decisions made"),
        ("dashboardDecisionsMade", "Dashboard decisions made"),
    ]
    out = []
    seen = set()
    for key, label in pairs:
        metric = _summary_metric(summary, key, label)
        if metric and label not in seen:
            out.append(metric)
            seen.add(label)
    return out


def _priority_scale_rows(value) -> list:
    if not isinstance(value, dict):
        return as_list(value)
    rows = []
    scale = _first_present(value, "scale_used", "scaleUsed", "priority_scale")
    if not is_empty(scale):
        rows.append({"name": "Scale used", "value": as_list(scale)})
    configured = _first_present(value, "configured_scale_found", "configuredScaleFound")
    if not is_empty(configured):
        rows.append({"name": "Configured scale found", "value": configured})
    note = _first_present(value, "note", "summary", "description")
    if not is_empty(note):
        rows.append({"name": "Priority scale note", "value": note})
    return rows


def _business_context_rows(value) -> list:
    if not isinstance(value, dict):
        return as_list(value)
    rows = []
    for key, label in (
        ("risk_interpretation", "Risk interpretation"),
        ("riskInterpretation", "Risk interpretation"),
        ("documented", "Documented context"),
        ("missing", "Missing context"),
    ):
        item = value.get(key)
        if not is_empty(item):
            rows.append({"name": label, "value": item})
    return rows


def _normalize_priority_item(item: dict) -> dict:
    out = dict(item)
    finding_id = _first_present(out, "finding_id", "findingId", "logical_finding_id", "id", "case_id")
    if not is_empty(finding_id):
        out.setdefault("finding_id", finding_id)
        out.setdefault("priority_id", finding_id)

    priority = _first_present(out, "proposed_priority", "proposedPriority", "priority", "priority_level")
    if not is_empty(priority):
        out.setdefault("priority", priority)

    rationale = _first_present(out, "priority_rationale", "priorityRationale", "reasoning")
    if not is_empty(rationale):
        out.setdefault("priority_reasoning", rationale)

    original_severity = _first_present(out, "original_severity", "originalSeverity", "severity")
    if not is_empty(original_severity):
        out.setdefault("severity", original_severity)
        out.setdefault("original_severity", original_severity)

    triage_verdict = _first_present(out, "triage_technical_verdict", "triageTechnicalVerdict", "triage_verdict")
    if not is_empty(triage_verdict):
        out.setdefault("triage_verdict", triage_verdict)
        out.setdefault("confidence", triage_verdict)

    risk = _first_present(out, "risk_factors", "riskFactors") or {}
    if isinstance(risk, dict):
        for src, dest in (
            ("technical_severity", "technical_severity"),
            ("technicalSeverity", "technical_severity"),
            ("exploitability", "exploitability"),
            ("exposure", "exposure"),
            ("impact", "impact"),
            ("threat_context", "threat_model_relevance"),
            ("threatContext", "threat_model_relevance"),
            ("business_context", "business_context"),
            ("businessContext", "business_context"),
            ("compensating_controls", "existing_controls"),
            ("compensatingControls", "existing_controls"),
        ):
            value = risk.get(src)
            if not is_empty(value):
                out.setdefault(dest, as_list(value) if dest == "existing_controls" else _summary_text(value))

    urgency = _first_present(out, "urgency_and_dependencies", "urgencyAndDependencies") or {}
    if isinstance(urgency, dict):
        timeframe = _first_present(urgency, "recommended_timeframe", "recommendedTimeframe")
        if not is_empty(timeframe):
            out.setdefault("recommended_timeframe", timeframe)
            out.setdefault("target_period", timeframe)
        timeframe_reason = _first_present(urgency, "timeframe_reason", "timeframeReason")
        if not is_empty(timeframe_reason):
            out.setdefault("timeframe_reason", timeframe_reason)
        dependencies = _first_present(urgency, "dependencies", "prerequisites")
        if not is_empty(dependencies):
            out.setdefault("dependencies", as_list(dependencies))
            out.setdefault("follow_up_required", as_text(dependencies))

    trace = _first_present(out, "traceability", "trace") or {}
    if isinstance(trace, dict):
        for src, dest in (
            ("related_threats", "related_threats"),
            ("relatedThreats", "related_threats"),
            ("related_scan_focus", "related_scan_focus"),
            ("relatedScanFocus", "related_scan_focus"),
            ("triage_evidence_ids", "triage_evidence_ids"),
            ("triageEvidenceIds", "triage_evidence_ids"),
        ):
            value = trace.get(src)
            if not is_empty(value):
                out.setdefault(dest, as_list(value))

    evidence = _first_present(out, "evidence_references", "evidenceReferences", "references")
    if not is_empty(evidence):
        out.setdefault("evidence_references", normalize_refs(evidence))

    uncertainty = _first_present(out, "uncertainty", "uncertainties")
    if not is_empty(uncertainty):
        out.setdefault("uncertainty", as_list(uncertainty))

    return out


def augment_prioritization(tree):
    """Derive canonical prioritization fields from risk-prioritization reports."""
    if not isinstance(tree, dict):
        return tree
    root = _first_present(tree, "risk_prioritization", "riskPrioritization", "prioritization") or tree
    if not isinstance(root, dict):
        return tree

    rows = _priority_rows(root)
    summary = _first_present(root, "summary", "priority_summary", "prioritySummary") or {}
    extra = {}

    if rows:
        extra["priority_queue"] = rows
        extra["findings"] = rows

    inputs = _first_present(root, "input_references", "inputReferences", "inputs", "source_inputs")
    if inputs is not None:
        extra["context_inputs"] = _reference_rows(inputs)

    identity = _first_present(root, "processing_identity", "processingIdentity", "identity") or {}
    if isinstance(identity, dict):
        method = _first_present(identity, "mode", "name", "method")
        if not is_empty(method):
            extra["priority_method"] = _summary_text(method)

    metrics = _priority_summary_rows(summary)
    if metrics:
        extra["classification_summary"] = metrics

    considerations = []
    considerations += _priority_scale_rows(_first_present(root, "priority_scale", "priorityScale"))
    considerations += _business_context_rows(_first_present(root, "business_context", "businessContext"))
    if considerations:
        extra["priority_considerations"] = considerations

    manifest_limitations = _first_present(root, "limitations", "constraints")
    if not is_empty(manifest_limitations):
        extra["limitations"] = as_list(manifest_limitations)

    if not extra:
        return tree
    augmented = dict(tree)
    for grouped_key in (
        "Finding",
        "finding",
        "findings",
        "Findings",
        "risk_findings",
        "riskFindings",
        "priority_queue",
        "priorityQueue",
        "prioritized_findings",
        "queue_items",
        "inputReferences",
        "input_references",
        "processingIdentity",
        "processing_identity",
        "priorityScale",
        "priority_scale",
        "businessContext",
        "business_context",
        "summary",
        "priority_summary",
    ):
        augmented.pop(grouped_key, None)
    for key, value in extra.items():
        if not is_empty(value):
            augmented.setdefault(key, value)
    return augmented


def _looks_like_remediation_records(value) -> bool:
    items = as_list(value, "title")
    if not items:
        return False
    remediation_keys = {
        "proposed_fix",
        "proposed_remediation",
        "recommended_fix",
        "recommended_remediation",
        "patch_reference",
        "patch_file",
        "root_cause",
        "side_effects",
        "validation_tests",
        "tests",
    }
    for item in items[:10]:
        if isinstance(item, dict) and remediation_keys & set(item):
            return True
    return False


def augment_remediation(tree):
    """Normalize generate-only remediation proposal packages without relying on a strict schema name."""
    if not isinstance(tree, dict):
        return tree
    extra = {}

    records = _first_present(
        tree,
        "remediations",
        "fixes",
        "remediation_results",
        "remediation_proposals",
        "proposals",
        "patches",
        "finding",
        "findings",
    )
    if _looks_like_remediation_records(records):
        extra["remediations"] = records

    proposal_status = _first_present(tree, "proposal_status", "implementation_status", "status")
    if proposal_status is not None:
        extra["implementation_summary"] = proposal_status

    generated_artifacts = _first_present(tree, "generated_artifacts", "artifacts", "outputs")
    if generated_artifacts is not None:
        extra["artifacts"] = generated_artifacts

    validation = _first_present(tree, "validation_evidence", "validation", "validation_results", "tests")
    if validation is not None:
        extra["validation_summary"] = validation

    inputs = _first_present(tree, "input_references", "inputs", "context_inputs")
    if inputs is not None:
        extra["context_inputs"] = inputs

    limitations = _first_present(tree, "limitations", "constraints", "assumptions_and_limitations")
    if limitations is not None:
        extra["limitations"] = limitations

    if not extra:
        return tree
    augmented = dict(tree)
    for grouped_key in (
        "Finding",
        "finding",
        "Findings",
        "findings",
        "remediation_proposals",
        "proposals",
        "patches",
        "proposal_status",
        "proposalStatus",
        "generated_artifacts",
        "generatedArtifacts",
        "validation_evidence",
        "validationEvidence",
        "input_references",
        "inputReferences",
    ):
        augmented.pop(grouped_key, None)
    for key, value in extra.items():
        if not is_empty(value):
            augmented.setdefault(key, value)
    return augmented


def _normalize_post_fix_item(item: dict) -> dict:
    out = dict(item)
    finding_id = _first_present(out, "finding_id", "findingId", "id", "case_id", "logical_finding_id")
    if not is_empty(finding_id):
        out.setdefault("finding_id", finding_id)
        out.setdefault("verification_id", finding_id)

    root_cause = _first_present(out, "original_root_cause", "originalRootCause", "root_cause")
    if not is_empty(root_cause):
        out.setdefault("root_cause", root_cause)
        out.setdefault("original_condition", root_cause)

    implemented = _first_present(out, "implemented_change_reviewed", "implementedChangeReviewed",
                                 "implemented_change", "post_remediation_condition")
    if not is_empty(implemented):
        out.setdefault("post_remediation_condition", implemented)
        out.setdefault("remediation_details", implemented)

    comparison = _first_present(out, "comparison_to_proposal", "comparisonToProposal", "comparison")
    if not is_empty(comparison):
        out.setdefault("security_improvement", comparison)

    conclusion = _first_present(out, "technical_conclusion", "technicalConclusion", "validation_note")
    if not is_empty(conclusion):
        out.setdefault("validation_note", conclusion)

    status = _first_present(out, "verify_fix_skill_status", "verifyFixSkillStatus", "verification_status", "status")
    if not is_empty(status):
        out.setdefault("result", status)

    recommendation = _first_present(out, "technical_closure_recommendation", "technicalClosureRecommendation",
                                    "closure_recommendation")
    if not is_empty(recommendation):
        out.setdefault("closure_recommendation", recommendation)

    checks = _first_present(out, "verification_checks", "verificationChecks", "validation_checks", "checks")
    if not is_empty(checks):
        out.setdefault("validation_checks", checks)
        out.setdefault("validation_results", checks)

    refs = _first_present(out, "evidence_references", "evidenceReferences", "references")
    if not is_empty(refs):
        out["evidence_references"] = normalize_refs(refs)

    return out


def _post_fix_summary_rows(rows: list, contract_results=None) -> list:
    source = as_list(contract_results, "id") or rows
    if not source:
        return []
    counts = {}
    for item in source:
        if isinstance(item, dict):
            status = as_text(_first_present(item, "status", "result", "verify_fix_skill_status",
                                            "verification_status", "classification"))
        else:
            status = as_text(item)
        status = status or "recorded"
        counts[status] = counts.get(status, 0) + 1
    out = [{"name": "Total findings verified", "value": len(source)}]
    out.extend({"name": label, "value": count} for label, count in counts.items())
    return out


def augment_post_fix_verification(tree):
    """Normalize focused post-fix verification packages into canonical post-scan records."""
    if not isinstance(tree, dict):
        return tree
    root = _first_present(tree, "post_fix_verification", "postFixVerification", "verification") or tree
    if not isinstance(root, dict):
        return tree

    extra = {}

    raw_findings = _first_present(root, "finding", "Finding", "findings", "verification_results",
                                  "targeted_verifications", "fix_verifications")
    rows = [_normalize_post_fix_item(item) for item in as_list(raw_findings, "title") if isinstance(item, dict)]
    if rows:
        extra["targeted_verifications"] = rows
        summary_results = None
        contract = _first_present(root, "verify_fix_result_contract", "verifyFixResultContract", "result_contract")
        if isinstance(contract, dict):
            summary_results = _first_present(contract, "results", "verification_results")
            if summary_results is not None:
                extra["determinations"] = summary_results
        summary = _post_fix_summary_rows(rows, summary_results)
        if summary:
            extra["verification_summary"] = summary
            extra["classification_summary"] = summary

    scope = _first_present(root, "verification_scope", "verificationScope", "scope")
    coverage = []
    if isinstance(scope, dict):
        reason = _first_present(scope, "scope_reason", "scopeReason", "reason", "summary", "description")
        if not is_empty(reason):
            extra["scope"] = reason
        remediation_id = _first_present(scope, "remediation_id", "remediationId")
        if not is_empty(remediation_id):
            coverage.append({"name": "Remediation batch", "value": remediation_id})
        finding_ids = _first_present(scope, "finding_ids", "findingIds", "verified_findings", "verifiedFindings")
        if not is_empty(finding_ids):
            coverage.append({"name": "Verified findings", "value": finding_ids})
        excluded = _first_present(scope, "excluded_findings", "excludedFindings", "excluded")
        if not is_empty(excluded):
            extra["excluded_findings"] = excluded
            coverage.append({"name": "Not verified in this batch", "value": excluded})
    elif not is_empty(scope):
        extra["scope"] = scope

    commands = _first_present(root, "verification_commands", "verificationCommands", "validation_checks",
                              "tests_executed", "execution_details")
    if commands is not None:
        extra["validation_checks"] = commands

    inputs = _first_present(root, "input_references", "inputReferences", "inputs", "input_artifacts")
    if inputs is not None:
        extra["context_inputs"] = _reference_rows(inputs)

    processing = _first_present(root, "processing_identity", "processingIdentity")
    if processing is not None:
        extra["manifest"] = _reference_rows(processing)

    if coverage:
        extra["coverage"] = coverage

    closure_recommendations = []
    limitations = []
    refs = []
    for row in rows:
        if not is_empty(row.get("closure_recommendation")):
            closure_recommendations.append({
                "finding_id": row.get("finding_id"),
                "value": row.get("closure_recommendation"),
            })
        limitations = merge_lists(limitations, as_list(row.get("limitations")))
        refs = merge_lists(refs, normalize_refs(row.get("evidence_references")))
    if closure_recommendations:
        extra["closure_recommendations"] = closure_recommendations
    if limitations:
        extra["limitations"] = limitations
    if refs:
        extra["source_references"] = refs

    if not extra:
        return tree
    augmented = dict(tree)
    for grouped_key in (
        "finding",
        "Finding",
        "findings",
        "verification_results",
        "targeted_verifications",
        "fix_verifications",
        "verification_scope",
        "verificationScope",
        "verification_commands",
        "verificationCommands",
        "verify_fix_result_contract",
        "verifyFixResultContract",
        "input_references",
        "inputReferences",
        "processing_identity",
        "processingIdentity",
    ):
        augmented.pop(grouped_key, None)
    for key, value in extra.items():
        if not is_empty(value):
            augmented.setdefault(key, value)
    return augmented


def score(tree, stage_key: str) -> int:
    out: dict = {}
    collect(tree, STAGES[stage_key]["matcher"], out)
    return sum(1 for v in out.values() if _has_content(v))


def score_all(tree) -> dict:
    return {k: score(tree, k) for k in STAGES}


def unmatched_keys(tree, stage_key: str) -> list:
    miss: list = []
    collect(tree, STAGES[stage_key]["matcher"], {}, unmatched=miss)
    seen: list = []
    for m in miss:
        if m not in seen:
            seen.append(m)
    return seen


def _coerce(kind: str, v):
    return as_text(v) if kind == "text" else normalize_refs(v) if kind == "refs" else as_list(v)


def normalize_record(raw, rs: dict):
    if isinstance(raw, str):
        raw = {rs["primary"]: raw}
    if not isinstance(raw, dict):
        return None
    out, used = {}, set()
    # 1. exact names and aliases
    for canon, (kind, aliases) in rs["spec"].items():
        for a in (canon,) + tuple(aliases):
            if a in raw and not is_empty(raw[a]):
                val = _coerce(kind, raw[a])
                if not is_empty(val):
                    used.add(a)
                    out[canon] = val
                    break
    # 2. names we have not seen before, matched by meaning
    for k, v in raw.items():
        if k in used or is_empty(v):
            continue
        for canon in rs["matcher"](k):
            if canon in out:
                break
            val = _coerce(rs["spec"][canon][0], v)
            if not is_empty(val):
                out[canon] = val
                used.add(k)
            break
    if not out:
        return None
    st = out.get("scan_type")
    if isinstance(st, str) and "_" in st and " " not in st:
        out["scan_type"] = st.replace("_", " ").capitalize()
    extra = {k: v for k, v in raw.items() if k not in used and not is_empty(v)}
    if extra:
        out["extra"] = extra
    return out


def tidy_items(items: list) -> list:
    """Makes source references inside list items use the standard reference shape."""
    out = []
    for it in items:
        if isinstance(it, dict):
            it = dict(it)
            if "source_refs" in it:
                refs = it.pop("source_refs")
                if not is_empty(refs):
                    it["source_references"] = merge_lists(normalize_refs(it.get("source_references")),
                                                          normalize_refs(refs))
            for key in ("source_references", "evidence_references"):
                if not is_empty(it.get(key)):
                    it[key] = normalize_refs(it[key])
        out.append(it)
    return out


def build_field(kind: str, values: list):
    if kind == "text":
        for v in values:
            t = as_text(v)
            if t:
                return t
        return ""
    out: list = []
    for v in values:
        out = merge_lists(out, normalize_refs(v) if kind == "refs" else tidy_items(as_list(v)))
    return out


@dataclass
class Extracted:
    singleton: dict = field(default_factory=dict)
    records: dict = field(default_factory=dict)  # table -> [(item_key, data)]


def extract(stage_key: str, uploads: list) -> Extracted:
    cfg = STAGES[stage_key]
    match = cfg["matcher"]
    from_json: dict = {}
    from_md: dict = {}
    dynamic: dict = {}
    sarif_refs, diagrams = [], []

    for u in uploads:
        if stage_key == "repository-intelligence":
            tree = augment_repository_intelligence(u.tree)
        elif stage_key == "threat-modeling":
            tree = augment_threat_model(u.tree)
        elif stage_key == "security-baseline":
            tree = augment_security_baseline(u.tree)
        elif stage_key == "triage":
            tree = augment_triage(u.tree)
        elif stage_key == "prioritization":
            tree = augment_prioritization(u.tree)
        elif stage_key == "remediation":
            tree = augment_remediation(u.tree)
        elif stage_key == "fix-verification":
            tree = augment_post_fix_verification(u.tree)
        else:
            tree = u.tree
        if u.kind == "json":
            collect(tree, match, from_json)
            collect_dynamic(tree, dynamic)
        elif u.kind == "markdown":
            collect(tree, match, from_md)
            collect_dynamic(tree, dynamic)
        elif u.kind == "sarif":
            collect_dynamic(tree, dynamic)
            sarif_refs += sarif_references(u.tree)
        elif u.kind == "manifest":
            collect_dynamic(u.tree, dynamic)
        if u.diagrams:
            diagrams += u.diagrams

    res = Extracted()
    for canon, (kind, _) in cfg["fields"].items():
        # JSON is the primary source. Markdown only fills fields that JSON did not provide.
        values = from_json.get(canon) if _has_content(from_json.get(canon)) else from_md.get(canon)
        if not _has_content(values):
            continue
        if kind == "records":
            rs = cfg["records"][canon]
            items = []
            for v in values:
                for raw in as_list(v, rs["key_field"]):
                    rec = normalize_record(raw, rs)
                    if rec:
                        items.append((rs["key_fn"](rec), rec))
            if items:
                res.records[rs["table"]] = items
        else:
            val = build_field(kind, values)
            if not is_empty(val):
                res.singleton[canon] = val

    for canon, values in dynamic.items():
        if canon in cfg["fields"] or canon in cfg["records"]:
            continue
        val = build_field("list", values)
        if not is_empty(val):
            res.singleton[canon] = val

    if sarif_refs:
        res.singleton["source_references"] = merge_lists(res.singleton.get("source_references", []), sarif_refs)
    if diagrams:
        res.singleton["diagrams"] = merge_lists([], diagrams)
    return res
