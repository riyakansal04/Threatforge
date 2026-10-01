"""What each pre-scan stage understands. Field names follow the specification.

Each field is (kind, aliases):
  text    one string
  list    list of items (strings or objects)
  refs    list of source references
  records list of separate database records (threats, scan focus, ...)
Matching is by field NAME MEANING inside the content, never by file name:
exact names and aliases first, then word-overlap matching for names it has not seen before.
"""

from app.mapper.util import snake


def F(kind, *aliases):
    return (kind, aliases)


RI_FIELDS = {
    "purpose": F("text", "application_purpose", "project_purpose", "system_purpose", "business_goal", "goals"),
    "business_functionality": F("text", "business_functions", "functionality", "business_workflows", "business_workflow",
                                "business_importance", "business_processes", "business_operations", "business_activities",
                                "workflow", "workflows", "business_capabilities", "functional_requirements"),
    "repository_scope": F("text", "scope", "assessed_scope", "assessment_scope", "system_scope", "project_scope",
                          "application_scope", "repo_scope"),
    "architecture_summary": F("text", "architecture_overview", "system_architecture", "application_architecture",
                             "architectural_summary", "architectural_layers", "architecture_layers", "application_layers"),
    "languages": F("list", "programming_languages", "language_stack"),
    "frameworks": F("list", "framework_stack"),
    "runtimes": F("list", "runtime_environments", "runtime_stack"),
    "libraries": F("list", "library_stack"),
    "dependencies": F("list", "third_party_dependencies", "packages", "dependency_ecosystem"),
    "components": F("list", "modules", "repository_structure", "repo_structure", "project_structure",
                    "application_structure", "major_modules", "major_components", "component_structure"),
    "component_relationships": F("list", "relationships", "component_dependencies", "module_relationships",
                                 "intermodule_relationships", "responsibilities", "dependency_graph"),
    "architecture_layers": F("list", "layers", "architectural_layers", "layered_architecture", "architecture_layer",
                            "layering"),
    "architecture_reference": F("list", "architecture_diagram", "architecture_diagrams", "diagram_reference"),
    "entry_points": F("list", "application_entry_points", "entrypoint", "entrypoints", "bootstrap_sequence",
                      "startup_bootstrap", "startup", "startup_flow", "runtime_entry_points", "initial_entry_points"),
    "startup_flow": F("list", "startup_sequence", "startup", "bootstrap", "bootstrap_sequence", "initialization_flow"),
    "runtime_processes": F("list", "processes", "workers", "runtime_workers", "daemons", "services"),
    "services": F("list", "service", "microservices", "worker_services"),
    "scheduled_jobs": F("list", "jobs", "cron_jobs", "background_jobs", "scheduled_tasks", "task_jobs"),
    "apis": F("list", "api_endpoints", "endpoints", "interfaces", "api_routes", "route_definitions"),
    "routes": F("list", "route", "routes_definition", "route_handlers"),
    "controllers": F("list", "controller", "controller_classes"),
    "handlers": F("list", "handler", "request_handlers"),
    "externally_accessible_interfaces": F("list", "external_interfaces", "exposed_interfaces", "public_interfaces",
                                         "public_api", "public_apis", "external_apis", "external_api"),
    "execution_flows": F("list", "request_flows", "flows", "execution_paths", "request_execution_flows", "component_flows"),
    "data_stores": F("list", "datastores", "databases", "storage", "persisted_storage", "persistence_layers",
                    "data_store", "data_sources", "datasources"),
    "data_models": F("list", "models", "entities", "data_model", "schemas", "schema_definitions"),
    "data_flows": F("list", "important_data_flows", "information_flows", "input_output_flows", "data_flow"),
    "external_services": F("list", "external_systems", "third_party_services", "third_party_apis", "external_api",
                          "external_apis", "service_integrations", "external_dependencies", "connected_services"),
    "integrations": F("list", "integration", "service_integrations", "external_integrations", "connected_systems",
                    "third_party_integrations", "integration_points"),
    "webhooks": F("list", "webhook", "callbacks", "callback_urls", "callback_endpoints", "event_hooks"),
    "authentication": F("list", "authn", "authentication_mechanisms", "authentication_implementation", "identity",
                        "login_mechanisms", "auth_mechanisms", "identity_providers"),
    "authorization": F("list", "authz", "access_control", "authorization_implementation", "authorization_model",
                      "access_control_model", "rbac", "role_based_access", "identity_and_access"),
    "security_controls": F("list", "controls", "security_control_mechanisms", "mitigations"),
    "privileged_functionality": F("list", "privileged_functions", "admin_functionality", "privileged_operations",
                                "security_relevant_interfaces", "important_security_interfaces"),
    "sensitive_processing": F("list", "sensitive_operations", "sensitive_processing_flows", "security_sensitive_processing",
                            "sensitive_activities"),
    "configuration": F("list", "config", "configuration_files", "environment_variables", "deployment_setup",
                       "runtime_setup", "deployment_configuration", "environment_configuration"),
    "build_structure": F("list", "build", "build_system", "build_test_structure", "build_and_test_structure"),
    "test_structure": F("list", "tests", "testing", "test_suite", "unit_tests", "integration_tests"),
    "ci_cd_structure": F("list", "ci_cd", "cicd", "continuous_integration", "deployment_pipeline", "release_pipeline",
                         "build_and_release"),
    "source_references": F("refs", "evidence", "references", "evidence_references", "source_refs"),
    "assumptions": F("list"),
    "unknowns": F("list", "open_questions", "unresolved"),
}

TM_FIELDS = {
    "assets": F("list", "high_value_assets", "critical_assets"),
    "sensitive_data": F("list", "sensitive_data_areas", "sensitive_information"),
    "critical_business_functions": F("list", "business_functions"),
    "privileged_operations": F("list", "privileged_functions"),
    "security_sensitive_entry_points": F("list", "sensitive_entry_points", "entry_points"),
    "trust_boundaries": F("list"),
    "internal_external_trust_relationships": F("list", "trust_relationships"),
    "authentication_authorization_boundaries": F("list", "auth_boundaries", "access_control_boundaries"),
    "threat_actors": F("list", "actors"),
    "attacker_capabilities": F("list", "capabilities"),
    "threats": F("records", "threat_scenarios"),
    "threat_relationships": F("records", "relationships"),
    "affected_components": F("list"),
    "source_references": F("refs", "evidence", "references", "evidence_references", "source_refs"),
    "assumptions": F("list"),
    "unknowns": F("list", "open_questions", "unresolved"),
    "architectural_weaknesses": F("list", "architecture_weaknesses", "weaknesses"),
}

SB_FIELDS = {
    "security_critical_components": F("list", "critical_components", "security_critical_modules_components"),
    "high_value_assets": F("list", "assets"),
    "sensitive_data_paths": F("list", "data_paths"),
    "security_sensitive_apis": F("list", "sensitive_apis"),
    "security_sensitive_entry_points": F("list", "sensitive_entry_points", "entry_points"),
    "privileged_operations": F("list", "privileged_functions"),
    "high_impact_business_operations": F("list", "high_impact_operations"),
    "authentication_surfaces": F("list"),
    "authorization_surfaces": F("list"),
    "external_trust_boundaries": F("list", "trust_boundaries"),
    "integrations": F("list"),
    "threat_path_components": F("list", "threat_linked_components"),
    "relevant_security_controls": F("list", "security_controls", "controls"),
    "limited_visibility_areas": F("list", "limited_visibility"),
    "unresolved_behavior": F("list", "unresolved_behaviour"),
    "security_critical_dependencies": F("list", "critical_dependencies", "important_dependencies"),
    "scan_focus": F("records", "recommended_scan_focus", "scan_focus_records", "scan_focuses",
                    "subsequent_scan_focus"),
    "threat_convergence": F("records", "convergence", "convergence_points", "threat_convergences"),
    "source_references": F("refs", "evidence", "references", "evidence_references", "source_refs"),
}

THREAT_SPEC = {
    "threat_id": F("text", "id"),
    "scenario": F("text", "threat", "name", "title", "description", "abuse_case"),
    "actor": F("text", "threat_actor", "attacker"),
    "entry_point": F("text", "entry_points", "entrypoint"),
    "affected_components": F("list", "components"),
    "affected_assets": F("list", "assets", "affected_asset"),
    "trust_boundaries_crossed": F("list", "trust_boundaries", "boundaries_crossed"),
    "attack_path": F("list", "attack_paths", "path"),
    "preconditions": F("list", "prerequisites"),
    "impact": F("text", "potential_impact"),
    "existing_controls": F("list", "controls", "mitigations"),
    "security_gaps": F("list", "gaps", "weaknesses"),
    "source_references": F("refs", "evidence", "references", "source_reference", "source_refs"),
    "assumptions": F("list"),
    "unknowns": F("list"),
}

REL_SPEC = {
    "relationship_id": F("text", "id"),
    "source_threat_id": F("text", "source", "from"),
    "target_threat_id": F("text", "target", "to"),
    "relationship_type": F("text", "type", "kind"),
    "description": F("text", "reason", "summary"),
    "evidence_references": F("refs", "evidence", "references", "source_references", "source_refs"),
}

SCAN_FOCUS_SPEC = {
    "scan_type": F("text", "type", "scan"),
    "target": F("text", "module", "component", "target_module_component_api_flow"),
    "security_context": F("text", "security_concern", "concern"),
    "asset_or_business_function": F("text", "asset", "business_function"),
    "threat_context": F("text", "threat", "attack_path"),
    "reason": F("text", "rationale", "why"),
    "source_references": F("refs", "evidence", "references", "source_refs"),
}

CONV_SPEC = {
    "convergence_id": F("text", "id"),
    "target_type": F("text", "type"),
    "target": F("text", "where", "component", "area"),
    "related_threat_ids": F("list", "threat_ids", "threats"),
    "reason": F("text", "why", "prioritization_reason"),
    "scan_relevance": F("text", "relevance"),
    "source_references": F("refs", "evidence", "references", "source_refs"),
}


def _n(s):
    return " ".join(str(s or "").lower().split())


def _hash_key(rec):
    import hashlib
    import json
    return "h:" + hashlib.sha1(json.dumps(rec, sort_keys=True, default=str).encode()).hexdigest()


def key_threat(r):
    return r.get("threat_id") and f"id:{_n(r['threat_id'])}" or (r.get("scenario") and f"scenario:{_n(r['scenario'])}") or _hash_key(r)


def key_rel(r):
    if r.get("relationship_id"):
        return f"id:{_n(r['relationship_id'])}"
    if r.get("source_threat_id") and r.get("target_threat_id"):
        return f"{_n(r['source_threat_id'])}>{_n(r['target_threat_id'])}:{_n(r.get('relationship_type'))}"
    return _hash_key(r)


def key_focus(r):
    if r.get("scan_type") or r.get("target"):
        return f"{_n(r.get('scan_type'))}|{_n(r.get('target'))}"
    return _hash_key(r)


def key_conv(r):
    return r.get("convergence_id") and f"id:{_n(r['convergence_id'])}" or (r.get("target") and f"target:{_n(r['target'])}") or _hash_key(r)


FINDING_CASE_SPEC = {
    "finding_id": F("text", "id", "case_id", "logical_finding_id", "original_finding_id", "scan_finding_id"),
    "title": F("text", "name", "finding", "headline", "finding_title", "issue", "issue_title"),
    "description": F("text", "summary", "details", "finding_description", "issue_description", "observation"),
    "category": F("text", "weakness", "finding_type", "issue_type", "vulnerability_type", "class"),
    "cwe": F("text", "cwe_id", "cwe_where_applicable", "weakness_id"),
    "severity": F("text", "risk", "risk_rating"),
    "confidence": F("text", "certainty"),
    "exploitability": F("text", "exploitability_rating", "exploit_likelihood"),
    "validation_state": F("text", "confirmed_status", "confirmation_status", "candidate_status", "validity"),
    "affected_area": F("text", "area", "security_surface", "affected_surface"),
    "affected_component": F("text", "component", "module", "service", "affected_area", "affected_module"),
    "affected_files": F("list", "files", "file_paths", "affected_file_paths"),
    "affected_code_paths": F("list", "code_paths", "affected_paths", "relevant_code_paths"),
    "location": F("text", "code_location", "source_location", "file_location", "location"),
    "vulnerable_code": F("text", "code", "snippet", "vulnerable_snippet"),
    "root_cause": F("text", "cause", "underlying_issue", "underlying_weakness"),
    "attack_path": F("list", "attack_paths", "abuse_path", "threat_path"),
    "preconditions": F("list", "conditions", "required_conditions", "attack_conditions"),
    "affected_assets": F("list", "assets", "affected_asset", "sensitive_assets"),
    "business_impact": F("text", "business_context", "business_function", "affected_business_function"),
    "impact": F("text", "potential_impact", "security_impact"),
    "existing_controls": F("list", "controls", "mitigations", "security_controls"),
    "recommended_remediation": F("text", "recommendation", "remediation", "recommended_fix"),
    "status": F("text", "lifecycle_status", "state"),
    "source_scan_ids": F("list", "source_scans", "scan_ids", "source_scan_results"),
    "related_finding_ids": F("list", "related_findings", "linked_findings"),
    "root_cause_group_id": F("text", "root_cause_group", "common_root_cause", "dedupe_group"),
    "source_references": F("refs", "evidence", "references", "source_refs", "supporting_evidence"),
}

TRIAGE_SPEC = {
    "triage_id": F("text", "id", "decision_id", "assessment_id"),
    "finding_id": F("text", "case_id", "logical_finding_id"),
    "reported_weakness": F("text", "weakness", "reported_issue", "reported_finding"),
    "implementation_support": F("text", "actual_implementation_support", "supported_by_implementation"),
    "assessment_supported": F("text", "supported", "is_supported", "evidence_supported"),
    "reachability": F("text", "reachable", "reachability_assessment"),
    "affected_code_paths": F("list", "code_paths", "affected_paths", "reachable_paths"),
    "security_controls": F("list", "controls", "mitigations", "existing_controls"),
    "conditions": F("list", "preconditions", "conditions_required", "required_conditions"),
    "already_addressed": F("text", "addressed", "previously_addressed"),
    "requires_validation": F("text", "needs_validation", "further_validation_required"),
    "classification": F("text", "triage_classification", "decision", "validity", "finding_classification"),
    "duplicate_of": F("text", "duplicate", "duplicate_finding_id", "consolidated_into"),
    "same_underlying_issue": F("text", "same_issue", "same_root_cause", "same_underlying_weakness"),
    "root_cause_group_id": F("text", "root_cause_group", "dedupe_group", "correlation_group"),
    "consolidated_finding_id": F("text", "logical_finding", "canonical_finding_id"),
    "correlation_reasoning": F("text", "correlation", "deduplication_reasoning", "relatedness_reasoning"),
    "decision_reasoning": F("text", "reasoning", "decision_record", "triage_reasoning"),
    "source_finding_ids": F("list", "source_findings", "original_findings", "scan_findings"),
    "evidence_references": F("refs", "evidence", "references", "source_refs", "supporting_evidence"),
    "related_findings": F("list", "related_but_separate", "linked_findings"),
}

FINDING_REL_SPEC = {
    "relationship_id": F("text", "id"),
    "source_finding_id": F("text", "source", "from"),
    "target_finding_id": F("text", "target", "to"),
    "relationship_type": F("text", "type", "kind"),
    "root_cause_group_id": F("text", "root_cause_group"),
    "description": F("text", "reason", "summary"),
    "evidence_references": F("refs", "evidence", "references", "source_refs"),
}

PRIORITY_SPEC = {
    "priority_id": F("text", "id", "queue_id", "decision_id"),
    "finding_id": F("text", "case_id", "logical_finding_id"),
    "severity": F("text", "risk"),
    "confidence": F("text", "certainty"),
    "exploitability": F("text", "exploitability_rating", "exploit_likelihood"),
    "affected_asset": F("text", "asset", "affected_assets"),
    "business_criticality": F("text", "business_criticality", "business_impact", "criticality"),
    "exposure": F("text", "interface_exposure", "external_exposure", "exposed_interface"),
    "threat_model_relevance": F("text", "threat_relevance", "threat_model_context"),
    "attack_path_significance": F("text", "attack_path", "attack_path_relevance", "attack_path_importance"),
    "security_boundary_impact": F("text", "tenant_impact", "boundary_impact", "trust_boundary_impact"),
    "existing_controls": F("list", "controls", "mitigations", "security_controls"),
    "related_findings": F("list", "relationships", "linked_findings"),
    "remediation_complexity": F("text", "complexity", "estimated_complexity", "fix_complexity"),
    "priority": F("text", "action_level", "action", "priority_classification", "priority_level"),
    "priority_reasoning": F("text", "reasoning", "decision_reasoning", "priority_rationale"),
    "capacity_context": F("text", "capacity", "capacity_and_work_plan", "team_capacity"),
    "target_period": F("text", "target", "target_date", "target_window", "planned_period"),
    "queue_position": F("text", "position", "rank", "order"),
    "work_plan": F("text", "remediation_plan", "work_plan_item"),
    "owner": F("text", "assignee", "responsible_team"),
    "follow_up_required": F("text", "follow_up", "follow_up_queue", "requires_follow_up"),
    "evidence_references": F("refs", "evidence", "references", "source_refs", "supporting_evidence"),
}

REMEDIATION_SPEC = {
    "remediation_id": F("text", "id", "fix_id", "investigation_id"),
    "finding_id": F("text", "case_id", "logical_finding_id"),
    "investigation_context": F("text", "investigation", "analysis_context", "investigation_results"),
    "finding_evidence": F("list", "evidence", "finding_evidence", "supporting_evidence"),
    "root_cause": F("text", "cause", "identified_root_cause", "underlying_issue"),
    "affected_code_paths": F("list", "code_paths", "affected_paths", "affected_code"),
    "architecture_context": F("text", "architecture", "architectural_context"),
    "existing_controls": F("list", "controls", "existing_security_controls", "security_controls"),
    "recommendation": F("text", "recommended_remediation", "recommended_fix"),
    "proposed_remediation": F("text", "proposed_fix", "proposed_remediation", "fix_strategy"),
    "expected_security_improvement": F("text", "security_improvement", "expected_improvement"),
    "behavior_preservation": F("text", "intended_behavior", "business_behavior", "behavior_preserved"),
    "control_strengthening": F("text", "strengthened_controls", "control_changes"),
    "related_code_paths_considered": F("list", "related_paths", "similar_paths", "related_code_paths"),
    "new_risk_assessment": F("text", "introduced_risks", "new_security_or_functional_issues"),
    "architecture_consistency": F("text", "coding_patterns", "pattern_consistency", "architecture_patterns"),
    "change_description": F("text", "changes", "implementation_changes", "fix_changes"),
    "changed_files": F("list", "files", "modified_files", "changed_paths"),
    "patch_reference": F("text", "patch", "patch_file"),
    "commit_reference": F("text", "commit", "commit_id", "commit_hash"),
    "pull_request_reference": F("text", "pr", "pull_request", "merge_request"),
    "implementation_status": F("text", "fix_status", "implemented"),
    "authorization_status": F("text", "authorization", "approval_status", "implementation_authorized"),
    "fallback_reason": F("text", "insufficient_evidence", "not_implemented_reason"),
    "tests_run": F("list", "tests", "validation_tests"),
    "test_results": F("list", "results", "validation_results"),
    "security_validation": F("text", "security_test_result", "vulnerable_behavior_addressed"),
    "functional_validation": F("text", "functionality_validation", "intended_functionality"),
    "related_path_assessment": F("text", "related_paths_assessment", "related_paths_validation"),
    "risk_notes": F("list", "risks", "notes", "residual_risks"),
    "status": F("text", "state", "lifecycle_status"),
    "evidence_references": F("refs", "evidence_references", "references", "source_refs", "supporting_evidence_refs"),
}

TARGETED_VERIFICATION_SPEC = {
    "verification_id": F("text", "verification_id", "result_id", "verification_result_id"),
    "finding_id": F("text", "id", "case_id", "logical_finding_id", "original_finding_id"),
    "title": F("text", "title", "name", "finding", "target_finding"),
    "verification_type": F("text", "type", "verification_scope"),
    "target": F("text", "finding", "target_finding", "target_vulnerability"),
    "baseline_inputs": F("list", "baseline", "verification_baseline", "inputs"),
    "original_condition": F("text", "pre_remediation", "pre_remediation_condition", "original_security_condition"),
    "post_remediation_condition": F("text", "post_remediation", "post_condition", "post_remediation_state"),
    "security_improvement": F("text", "security_improvement", "security_improvement_achieved", "improvement"),
    "affected_area": F("text", "affected_area", "area", "endpoint", "route"),
    "affected_code": F("list", "code_locations", "affected_code", "affected_files", "affected_paths"),
    "remediation_details": F("text", "remediation", "fix_details", "remediation_summary"),
    "previous_evidence": F("list", "previous_evidence", "before_evidence"),
    "original_weakness_present": F("text", "weakness_present", "still_present"),
    "attack_path_status": F("text", "original_attack_path_possible", "attack_or_abuse_path_status", "abuse_path_status"),
    "security_control_status": F("text", "control_status", "introduced_control_status", "control_effectiveness"),
    "flow_change": F("text", "data_flow_change", "control_flow_change", "input_flow_change"),
    "root_cause_addressed": F("text", "root_cause_fixed", "root_cause_status"),
    "remaining_vulnerable_condition": F("text", "what_remains_vulnerable", "remaining_weakness"),
    "validation_note": F("text", "validation_note", "verification_note", "result_note"),
    "validation_checks": F("list", "validation_checks", "verification_checks", "verification_commands", "checks"),
    "validation_results": F("list", "validation_results", "verification_results", "test_results", "focused_runtime_checks"),
    "evidence": F("list", "verification_evidence", "evidence", "evidence_supporting_fixed", "fixed_evidence"),
    "fixed_evidence": F("list", "verification_evidence", "evidence_supporting_fixed", "fixed_evidence"),
    "result": F("text", "classification", "verification_result", "decision"),
    "evidence_references": F("refs", "evidence", "references", "source_refs", "supporting_evidence"),
    "coverage": F("list", "coverage", "coverage_notes", "verification_coverage"),
    "limitations": F("list", "verification_limitations"),
    "source_report": F("text", "source_report", "report", "report_name", "report_id"),
    "confidence": F("text", "verification_confidence"),
    "timestamp": F("text", "verified_at", "generated_at"),
}

REGRESSION_SPEC = {
    "regression_check_id": F("text", "id", "regression_id", "related_path_check_id"),
    "finding_id": F("text", "finding_id", "case_id", "logical_finding_id", "original_finding_id"),
    "root_cause": F("text", "underlying_weakness", "same_weakness"),
    "remediation_changes": F("text", "fix_changes", "remediation"),
    "related_paths": F("list", "related_paths", "paths", "related_security_paths"),
    "regression_candidates": F("list", "regression_candidates", "candidate_regressions", "possible_regressions"),
    "related_components": F("list", "components", "affected_components", "connected_components"),
    "related_interfaces": F("list", "interfaces", "apis", "endpoints", "related_apis"),
    "related_callers": F("list", "callers", "entry_callers"),
    "downstream_components": F("list", "downstream", "downstream_services"),
    "alternative_paths": F("list", "alternate_paths", "alternate_routes", "other_routes"),
    "similar_implementations": F("list", "similar_code", "shared_root_cause_implementations"),
    "authentication_authorization_paths": F("list", "auth_paths", "authn_authz_paths", "authorization_paths"),
    "data_flows": F("list", "related_data_flows", "data_paths"),
    "security_boundaries": F("list", "trust_boundaries", "security_boundary"),
    "attack_path_reachability": F("text", "reachable_through_another_route", "alternate_attack_path"),
    "same_weakness_instances": F("list", "same_weakness_in_related_path", "related_instances"),
    "new_or_regression_issues": F("list", "new_regression", "security_regressions"),
    "regression_status": F("text", "status", "regression_result"),
    "determination": F("text", "scope_determination", "effectiveness_determination"),
    "classification": F("text", "result", "decision"),
    "linked_findings": F("list", "linked_findings", "linked_finding_ids", "new_linked_findings"),
    "linked_finding_ids": F("list", "linked_findings", "linked_finding_ids", "new_linked_findings"),
    "evidence": F("list", "evidence", "supporting_evidence", "regression_evidence"),
    "evidence_references": F("refs", "evidence", "references", "source_refs", "supporting_evidence"),
    "coverage": F("list", "coverage", "coverage_notes", "regression_coverage"),
    "limitations": F("list", "limitations", "constraints", "regression_limitations"),
    "source_report": F("text", "source_report", "report", "report_name", "report_id"),
    "timestamp": F("text", "verified_at", "generated_at"),
}

CLOSURE_SPEC = {
    "closure_id": F("text", "id", "closure_decision_id", "assessment_id"),
    "finding_id": F("text", "case_id", "logical_finding_id", "original_finding_id"),
    "lifecycle_trace": F("list", "complete_lifecycle", "finding_lifecycle", "traceability"),
    "original_condition": F("text", "original_security_condition", "pre_remediation_condition"),
    "post_remediation_state": F("text", "post_state", "post_remediation_condition"),
    "weakness_addressed": F("text", "original_weakness_addressed", "weakness_fixed"),
    "attack_path_broken": F("text", "attack_path_status", "relevant_attack_path_broken"),
    "security_control_effective": F("text", "control_effective", "intended_security_control_effective"),
    "related_paths_checked": F("text", "related_security_paths_checked", "related_path_verification"),
    "functionality_consistent": F("text", "application_behavior_consistent", "intended_functionality"),
    "evidence_sufficient": F("text", "sufficient_evidence", "evidence_supports_closure"),
    "closure_decision": F("text", "closure_decision", "closure_classification", "decision", "classification"),
    "classification": F("text", "closure_classification", "decision", "closure_decision"),
    "closure_reasoning": F("text", "closure_reason", "closure_basis", "basis", "reasoning", "decision_reasoning", "closure_rationale"),
    "closure_evidence": F("list", "evidence", "evidence_supporting_closure", "supporting_closure_evidence"),
    "evidence": F("list", "evidence", "closure_evidence", "evidence_supporting_closure", "supporting_closure_evidence"),
    "security_improvement": F("text", "improvement", "security_improvement_achieved"),
    "remaining_requirements": F("list", "requirements", "evidence_still_required", "remediation_still_required"),
    "before_after_evidence": F("list", "available_before_and_after_evidence", "before_after_comparison"),
    "verification_reference": F("text", "verification_reference", "verification_ref", "verification_id"),
    "regression_reference": F("text", "regression_reference", "regression_ref", "regression_check_id"),
    "evidence_references": F("refs", "evidence", "references", "source_refs", "supporting_evidence"),
    "source_report": F("text", "source_report", "report", "report_name", "report_id"),
}


def key_finding_case(r):
    return r.get("finding_id") and f"id:{_n(r['finding_id'])}" or (r.get("title") and f"title:{_n(r['title'])}") or _hash_key(r)


def key_triage(r):
    return r.get("triage_id") and f"id:{_n(r['triage_id'])}" or (r.get("finding_id") and f"finding:{_n(r['finding_id'])}") or _hash_key(r)


def key_finding_rel(r):
    if r.get("relationship_id"):
        return f"id:{_n(r['relationship_id'])}"
    if r.get("source_finding_id") and r.get("target_finding_id"):
        return f"{_n(r['source_finding_id'])}>{_n(r['target_finding_id'])}:{_n(r.get('relationship_type'))}"
    return _hash_key(r)


def key_priority(r):
    return r.get("priority_id") and f"id:{_n(r['priority_id'])}" or (r.get("finding_id") and f"finding:{_n(r['finding_id'])}") or _hash_key(r)


def key_remediation(r):
    return r.get("remediation_id") and f"id:{_n(r['remediation_id'])}" or (r.get("finding_id") and f"finding:{_n(r['finding_id'])}") or _hash_key(r)


def key_verification(r):
    return (r.get("verification_id") and f"id:{_n(r['verification_id'])}"
            or r.get("regression_check_id") and f"id:{_n(r['regression_check_id'])}"
            or (r.get("finding_id") and f"finding:{_n(r['finding_id'])}") or _hash_key(r))


def key_closure(r):
    return r.get("closure_id") and f"id:{_n(r['closure_id'])}" or (r.get("finding_id") and f"finding:{_n(r['finding_id'])}") or _hash_key(r)


def _rs(table, entity_type, spec, primary, key_field, key_fn):
    return {"table": table, "entity_type": entity_type, "spec": spec, "primary": primary,
            "key_field": key_field, "key_fn": key_fn}


STAGES = {
    "repository-intelligence": {
        "label": "Repository intelligence", "table": "repository_intelligence",
        "entity_type": "RepositoryIntelligence", "fields": RI_FIELDS, "records": {},
        "summary_fields": ["components", "apis", "data_stores", "integrations", "entry_points", "execution_flows"],
    },
    "threat-modeling": {
        "label": "Architecture & threat modeling", "table": "threat_models",
        "entity_type": "ThreatModel", "fields": TM_FIELDS,
        "records": {
            "threats": _rs("threats", "Threat", THREAT_SPEC, "scenario", "threat_id", key_threat),
            "threat_relationships": _rs("threat_relationships", "ThreatRelationship", REL_SPEC,
                                        "description", "relationship_id", key_rel),
        },
        "summary_fields": ["assets", "sensitive_data", "security_sensitive_entry_points",
                           "trust_boundaries", "threat_actors"],
    },
    "security-baseline": {
        "label": "Security assessment & scan planning", "table": "security_baselines",
        "entity_type": "SecurityBaseline", "fields": SB_FIELDS,
        "records": {
            # scan type comes from the object key (standard_scan, deep_scan, ...) when reports use that shape
            "scan_focus": _rs("scan_focus", "ScanFocus", SCAN_FOCUS_SPEC, "reason", "scan_type", key_focus),
            "threat_convergence": _rs("threat_convergence", "ThreatConvergence", CONV_SPEC,
                                      "reason", "target", key_conv),
        },
        "summary_fields": ["security_critical_components", "security_sensitive_apis", "high_value_assets",
                           "privileged_operations", "limited_visibility_areas"],
    },
    "triage": {
        "phase": "findings", "label": "Triage & deduplication", "table": "triage_overviews",
        "entity_type": "FindingLifecycle", "fields": {
            "context_inputs": F("list", "inputs", "context", "source_inputs", "analysis_inputs"),
            "scan_results_reviewed": F("list", "scan_results", "reviewed_findings", "source_findings"),
            "triage_method": F("text", "method", "approach", "assessment_method"),
            "assessment_criteria": F("list", "per_finding_assessment", "assessment_items", "triage_criteria"),
            "classification_summary": F("list", "classification", "classifications", "triage_summary"),
            "deduplication_summary": F("list", "deduplication", "correlation_summary", "dedupe_summary"),
            "consolidated_findings": F("list", "logical_findings", "consolidated_logical_findings"),
            "related_but_separate_findings": F("list", "related_separate_findings", "separate_related_findings"),
            "false_positives": F("list", "false_positive_findings", "invalid_findings"),
            "validation_required": F("list", "requires_validation", "further_validation_required"),
            "findings": F("records", "finding_cases", "cases", "security_findings", "logical_findings"),
            "triage_decisions": F("records", "triage", "decisions", "triage_decision", "triage_results"),
            "finding_relationships": F("records", "relationships", "deduplication", "correlations", "relatedness"),
            "source_references": F("refs", "evidence", "references", "source_refs", "supporting_evidence"),
            "coverage": F("list", "coverage", "triage_coverage", "assessment_coverage"),
            "manifest": F("list", "metadata", "manifest", "scan_metadata"),
            "artifacts": F("list", "supporting_artifacts", "artifacts"),
            "assumptions": F("list"),
            "unknowns": F("list", "unresolved", "open_questions"),
            "limitations": F("list", "limitations", "constraints"),
        },
        "records": {
            "findings": _rs("lifecycle_findings", "FindingCase", FINDING_CASE_SPEC, "title", "finding_id", key_finding_case),
            "triage_decisions": _rs("triage_decisions", "TriageDecision", TRIAGE_SPEC, "classification", "triage_id", key_triage),
            "finding_relationships": _rs("finding_relationships", "FindingRelationship", FINDING_REL_SPEC, "description", "relationship_id", key_finding_rel),
        },
        "summary_fields": ["coverage", "limitations"],
    },
    "prioritization": {
        "phase": "findings", "label": "Risk, priority & remediation planning", "table": "prioritization_overviews",
        "entity_type": "FindingLifecycle", "fields": {
            "context_inputs": F("list", "inputs", "context", "source_inputs", "analysis_inputs"),
            "priority_method": F("text", "method", "prioritization_method", "approach"),
            "priority_considerations": F("list", "considerations", "risk_factors", "priority_factors"),
            "priority_philosophy": F("text", "philosophy", "priority_logic"),
            "classification_summary": F("list", "classification", "action_levels", "priority_classes"),
            "capacity_and_work_plan": F("list", "capacity", "work_plan", "capacity_plan"),
            "remediation_queue_summary": F("list", "queue_summary", "remediation_plan"),
            "follow_up_queue": F("list", "follow_up", "deferred_findings", "remaining_queue"),
            "findings": F("records", "finding_cases", "cases", "security_findings", "validated_findings"),
            "priority_queue": F("records", "priority", "remediation_queue", "queue_items", "prioritized_findings"),
            "source_references": F("refs", "evidence", "references", "source_refs", "supporting_evidence"),
            "coverage": F("list", "coverage", "priority_coverage", "assessment_coverage"),
            "manifest": F("list", "metadata", "manifest", "scan_metadata"),
            "artifacts": F("list", "supporting_artifacts", "artifacts"),
            "assumptions": F("list"),
            "unknowns": F("list", "unresolved", "open_questions"),
            "limitations": F("list", "limitations", "constraints"),
        },
        "records": {
            "findings": _rs("lifecycle_findings", "FindingCase", FINDING_CASE_SPEC, "title", "finding_id", key_finding_case),
            "priority_queue": _rs("priority_queue_items", "PriorityQueueItem", PRIORITY_SPEC, "priority_reasoning", "priority_id", key_priority),
        },
        "summary_fields": ["coverage", "limitations"],
    },
    "investigation": {
        "phase": "findings", "label": "Finding investigation", "table": "investigation_overviews",
        "entity_type": "FindingLifecycle", "fields": {
            "context_inputs": F("list", "inputs", "context", "source_inputs", "analysis_inputs"),
            "target_finding": F("text", "target", "finding", "logical_finding"),
            "investigation_summary": F("text", "summary", "investigation", "analysis_summary"),
            "root_cause_summary": F("text", "root_cause", "root_cause_analysis"),
            "affected_code_paths": F("list", "affected_code_paths", "code_paths", "affected_code"),
            "architecture_context": F("list", "architecture_context", "architecture"),
            "existing_controls": F("list", "existing_controls", "security_controls", "controls"),
            "remediation_requirements": F("list", "requirements", "remediation_requirements"),
            "proposed_remediation_summary": F("text", "proposed_remediation", "recommended_remediation"),
            "validation_summary": F("list", "validation", "validation_information", "tests"),
            "fallback_summary": F("text", "fallback", "not_implemented_reason"),
            "findings": F("records", "finding_cases", "cases", "security_findings"),
            "remediations": F("records", "investigation", "investigation_results", "remediation_context", "fix_recommendations"),
            "source_references": F("refs", "evidence", "references", "source_refs", "supporting_evidence"),
            "coverage": F("list", "coverage", "investigation_coverage", "assessment_coverage"),
            "manifest": F("list", "metadata", "manifest", "remediation_metadata"),
            "artifacts": F("list", "supporting_artifacts", "artifacts"),
            "assumptions": F("list"),
            "unknowns": F("list", "unresolved", "open_questions"),
            "limitations": F("list", "limitations", "constraints"),
        },
        "records": {
            "findings": _rs("lifecycle_findings", "FindingCase", FINDING_CASE_SPEC, "title", "finding_id", key_finding_case),
            "remediations": _rs("remediations", "Remediation", REMEDIATION_SPEC, "proposed_remediation", "remediation_id", key_remediation),
        },
        "summary_fields": ["coverage", "limitations"],
    },
    "remediation": {
        "phase": "findings", "label": "Remediation / fix", "table": "remediation_overviews",
        "entity_type": "FindingLifecycle", "fields": {
            "context_inputs": F("list", "inputs", "context", "source_inputs", "analysis_inputs"),
            "target_finding": F("text", "target", "finding", "logical_finding"),
            "fix_summary": F("text", "summary", "remediation_summary", "fix_summary"),
            "implementation_summary": F("text", "implementation", "implementation_summary", "changes_summary"),
            "authorization_summary": F("text", "authorization", "approval", "authorization_status"),
            "validation_summary": F("list", "validation", "validation_information", "tests"),
            "security_improvement_summary": F("text", "security_improvement", "expected_security_improvement"),
            "related_path_summary": F("list", "related_paths", "related_path_assessment"),
            "residual_risks": F("list", "risk_notes", "residual_risk", "remaining_risks"),
            "findings": F("records", "finding_cases", "cases", "security_findings"),
            "remediations": F("records", "remediations", "fixes", "remediation", "implemented_fixes"),
            "source_references": F("refs", "evidence", "references", "source_refs", "supporting_evidence"),
            "coverage": F("list", "coverage", "remediation_coverage", "assessment_coverage"),
            "manifest": F("list", "metadata", "manifest", "remediation_metadata"),
            "artifacts": F("list", "supporting_artifacts", "artifacts"),
            "assumptions": F("list"),
            "unknowns": F("list", "unresolved", "open_questions"),
            "limitations": F("list", "limitations", "constraints"),
        },
        "records": {
            "findings": _rs("lifecycle_findings", "FindingCase", FINDING_CASE_SPEC, "title", "finding_id", key_finding_case),
            "remediations": _rs("remediations", "Remediation", REMEDIATION_SPEC, "proposed_remediation", "remediation_id", key_remediation),
        },
        "summary_fields": ["coverage", "limitations"],
    },
    "fix-verification": {
        "phase": "post-scan", "label": "Targeted fix verification", "table": "fix_verification_overviews",
        "entity_type": "PostScan", "fields": {
            "context_inputs": F("list", "inputs", "context", "baseline", "verification_baseline"),
            "target_finding": F("text", "target", "finding", "logical_finding"),
            "source_report": F("text", "source_report", "report", "report_name", "report_id"),
            "scope": F("text", "verification_scope", "scope"),
            "verification_summary": F("list", "summary", "verification_summary", "result_totals", "results_summary"),
            "validation_checks": F("list", "verification_commands", "validation_checks", "focused_runtime_checks"),
            "determinations": F("list", "determinations", "verification_determinations"),
            "comparison_summary": F("text", "comparison", "pre_post_comparison", "before_after_comparison"),
            "classification_summary": F("list", "classification", "verification_results", "result_summary"),
            "conditions_and_evidence": F("list", "conditions", "conditions_and_evidence", "evidence_conditions"),
            "targeted_verifications": F("records", "findings", "verification", "targeted_fix_verification", "verification_results", "fix_verifications"),
            "source_references": F("refs", "evidence", "references", "source_refs", "supporting_evidence"),
            "coverage": F("list", "coverage", "coverage_notes", "verification_coverage", "assessment_coverage"),
            "manifest": F("list", "metadata", "manifest", "verification_metadata"),
            "artifacts": F("list", "supporting_artifacts", "artifacts"),
            "assumptions": F("list"),
            "unknowns": F("list", "unresolved", "open_questions"),
            "limitations": F("list", "limitations", "constraints"),
        },
        "records": {
            "targeted_verifications": _rs("targeted_verifications", "TargetedVerification", TARGETED_VERIFICATION_SPEC, "result", "verification_id", key_verification),
        },
        "summary_fields": ["coverage", "limitations"],
    },
    "regression": {
        "phase": "post-scan", "label": "Regression & related-path verification", "table": "regression_overviews",
        "entity_type": "PostScan", "fields": {
            "context_inputs": F("list", "inputs", "context", "baseline", "verification_context"),
            "target_finding": F("text", "target", "finding", "logical_finding"),
            "source_report": F("text", "source_report", "report", "report_name", "report_id"),
            "scope": F("text", "verification_scope", "scope"),
            "checks_performed": F("list", "checks", "related_path_checks", "regression_checks"),
            "determination_summary": F("text", "determination", "determination_summary"),
            "classification_summary": F("list", "classification", "result_summary", "regression_results"),
            "linked_findings_summary": F("list", "linked_findings", "same_weakness_links"),
            "regression_verifications": F("records", "regression", "related_path_verification", "related_path_regression", "regression_results", "regression_checks"),
            "source_references": F("refs", "evidence", "references", "source_refs", "supporting_evidence"),
            "coverage": F("list", "coverage", "coverage_notes", "regression_coverage", "verification_coverage"),
            "manifest": F("list", "metadata", "manifest", "verification_metadata"),
            "artifacts": F("list", "supporting_artifacts", "artifacts"),
            "assumptions": F("list"),
            "unknowns": F("list", "unresolved", "open_questions"),
            "limitations": F("list", "limitations", "constraints"),
        },
        "records": {
            "regression_verifications": _rs("regression_verifications", "RegressionVerification", REGRESSION_SPEC, "classification", "regression_check_id", key_verification),
        },
        "summary_fields": ["coverage", "limitations"],
    },
    "closure": {
        "phase": "post-scan", "label": "Closure & evidence assessment", "table": "closure_overviews",
        "entity_type": "PostScan", "fields": {
            "context_inputs": F("list", "inputs", "context", "complete_finding_lifecycle"),
            "target_finding": F("text", "target", "finding", "logical_finding"),
            "source_report": F("text", "source_report", "report", "report_name", "report_id"),
            "comparison_summary": F("text", "comparison", "original_vs_post_remediation", "before_after_comparison"),
            "closure_determinations": F("list", "determinations", "closure_determinations"),
            "classification_summary": F("list", "classification", "closure_results", "closure_summary"),
            "conditional_evidence": F("list", "conditional_evidence", "closure_evidence", "remaining_evidence"),
            "traceability_summary": F("list", "traceability", "finding_traceability", "lifecycle_traceability"),
            "closure_assessments": F("records", "closure", "closure_assessment", "closure_decisions", "closure_results"),
            "source_references": F("refs", "evidence", "references", "source_refs", "supporting_evidence"),
            "coverage": F("list", "coverage", "coverage_notes", "closure_coverage", "verification_coverage"),
            "manifest": F("list", "metadata", "manifest", "closure_metadata"),
            "artifacts": F("list", "supporting_artifacts", "artifacts"),
            "assumptions": F("list"),
            "unknowns": F("list", "unresolved", "open_questions"),
            "limitations": F("list", "limitations", "constraints"),
        },
        "records": {
            "closure_assessments": _rs("closure_assessments", "ClosureAssessment", CLOSURE_SPEC, "classification", "closure_id", key_closure),
        },
        "summary_fields": ["coverage", "limitations"],
    },
}


def build_alias_map(fields):
    m = {}
    for canon in fields:
        m[canon] = canon
    for canon, (_, aliases) in fields.items():
        for a in aliases:
            m.setdefault(a, canon)
    return m


COMBINED_ALIASES = {
    "authentication_and_authorization": ["authentication", "authorization"],
    "auth_and_authz": ["authentication", "authorization"],
    "authentication_and_authz": ["authentication", "authorization"],
    "authorization_and_authentication": ["authentication", "authorization"],
    "webhooks_and_integrations": ["webhooks", "integrations"],
    "integrations_and_webhooks": ["webhooks", "integrations"],
    "external_sources_and_integrations": ["external_services", "integrations"],
    "third_party_services_and_integrations": ["external_services", "integrations"],
    "applications_and_components": ["components", "purpose"],
    "business_importance_and_workflows": ["business_functionality", "purpose"],
}


# ---------- meaning-based matching for names we have not seen before ----------
STOP = {"and", "or", "the", "of", "to", "for", "in", "is", "are", "a", "an", "by", "with",
        "relevant", "related", "observed", "determined"}
SYN = {
    "ref": "reference", "evidence": "reference", "module": "component", "behaviour": "behavior",
    "authn": "authentication", "authz": "authorization", "auth": "authentication",
    "api": "interface", "apis": "interface", "svc": "service", "services": "service",
    "ext": "external", "thirdparty": "third_party", "3rdparty": "third_party",
    "callback": "webhook", "callbacks": "webhook", "hook": "webhook", "hooks": "webhook",
    "db": "database", "datastore": "data_store", "dataset": "data_store",
}

SEMANTIC_ALIASES = {
    "external_sources": "external_services",
    "external_source": "external_services",
    "external_service": "external_services",
    "external_services": "external_services",
    "external_api": "external_services",
    "external_apis": "external_services",
    "third_party_api": "external_services",
    "third_party_apis": "external_services",
    "third_party_services": "external_services",
    "external_interface": "externally_accessible_interfaces",
    "external_interfaces": "externally_accessible_interfaces",
    "public_interfaces": "externally_accessible_interfaces",
    "public_api": "externally_accessible_interfaces",
    "public_apis": "externally_accessible_interfaces",
    "identity_provider": "authentication",
    "identity_providers": "authentication",
    "login_mechanisms": "authentication",
    "authentication_mechanisms": "authentication",
    "auth_mechanisms": "authentication",
    "authorization_model": "authorization",
    "access_control_model": "authorization",
    "rbac": "authorization",
    "role_based_access": "authorization",
    "integration_points": "integrations",
    "connected_systems": "integrations",
    "dependent_services": "integrations",
    "third_party_integrations": "integrations",
    "integration_endpoints": "integrations",
    "webhooks_and_callbacks": "webhooks",
    "callback_urls": "webhooks",
    "callback_endpoints": "webhooks",
    "event_hooks": "webhooks",
    "application_purpose": "purpose",
    "business_use_cases": "business_functionality",
    "use_cases": "business_functionality",
    "business_workflows": "business_functionality",
    "business_workflow": "business_functionality",
    "business_importance": "business_functionality",
    "business_capabilities": "business_functionality",
    "business_processes": "business_functionality",
    "business_operations": "business_functionality",
    "workflows": "business_functionality",
    "workflow": "business_functionality",
    "databases": "data_stores",
    "data_stores": "data_stores",
    "data_storage": "data_stores",
    "repository_structure": "components",
    "repo_structure": "components",
    "project_structure": "components",
    "application_structure": "components",
    "architecture_overview": "architecture_summary",
    "architecture_summary": "architecture_summary",
    "system_architecture": "architecture_summary",
    "application_architecture": "architecture_summary",
    "architectural_summary": "architecture_summary",
    "architectural_layers": "architecture_layers",
    "architecture_layers": "architecture_layers",
    "application_layers": "architecture_layers",
    "project_scope": "repository_scope",
    "repository_scope": "repository_scope",
    "application_scope": "repository_scope",
    "scope": "repository_scope",
    "entrypoint": "entry_points",
    "entrypoints": "entry_points",
    "entry_point": "entry_points",
    "startup_bootstrap": "entry_points",
    "bootstrap_sequence": "startup_flow",
    "startup_flow": "startup_flow",
    "exposed_endpoints": "externally_accessible_interfaces",
    "observed_interfaces": "externally_accessible_interfaces",
    "security_boundary": "trust_boundaries",
    "security_boundaries": "trust_boundaries",
    "trust_boundary": "trust_boundaries",
    "environment_variables": "configuration",
    "deployment_configuration": "configuration",
    "runtime_setup": "configuration",
    "deployment_setup": "configuration",
    "major_modules": "components",
    "module_relationships": "component_relationships",
    "responsibilities": "component_relationships",
    "important_data_flows": "data_flows",
    "data_flow": "data_flows",
    "authentication_implementation": "authentication",
    "authorization_implementation": "authorization",
    "sensitive_processing": "sensitive_processing",
    "privileged_operations": "privileged_functionality",
    "scan_findings": "findings",
    "validated_findings": "findings",
    "logical_findings": "findings",
    "security_findings": "findings",
    "finding_cases": "findings",
    "triage_results": "triage_decisions",
    "triage_decision": "triage_decisions",
    "dedupe_results": "finding_relationships",
    "deduplication_results": "finding_relationships",
    "correlation_results": "finding_relationships",
    "finding_correlations": "finding_relationships",
    "remediation_queue": "priority_queue",
    "prioritized_findings": "priority_queue",
    "action_queue": "priority_queue",
    "fixes": "remediations",
    "fix_recommendations": "remediations",
    "implemented_fixes": "remediations",
    "remediation_results": "remediations",
    "verification_results": "targeted_verifications",
    "fix_verifications": "targeted_verifications",
    "targeted_fix_results": "targeted_verifications",
    "related_path_results": "regression_verifications",
    "related_path_verification": "regression_verifications",
    "regression_results": "regression_verifications",
    "closure_results": "closure_assessments",
    "closure_decisions": "closure_assessments",
    "closure_assessment": "closure_assessments",
}
DYNAMIC_IGNORED_KEYS = {
    "sha256", "sha_256", "hash", "checksum", "digest", "path", "file", "filename", "uri", "url",
    "location", "artifact", "artifact_name", "created_at", "updated_at", "timestamp", "status",
    "kind", "type", "format", "source", "owner", "manifest", "schema", "$schema", "warning",
    "notes", "note"
}

# Keys that are report metadata, not security content. Not reported as "unmapped".
IGNORED_KEYS = {
    "assessment_type", "repository", "constraints_observed", "completion_check", "deliverables",
    "metadata", "version", "schema_version", "generated_at", "title", "summary_note",
    "report_name", "report_id", "report_type", "status", "summary", "description"
}


def is_known_field_name(name):
    text = snake(str(name)).strip()
    if not text:
        return False
    if text in IGNORED_KEYS or text in DYNAMIC_IGNORED_KEYS:
        return True
    for cfg in STAGES.values():
        if cfg["matcher"](text):
            return True
    return text in ALL_ALIASES or text in ALL_RECORD_KEYS


def dynamic_field_name(key):
    name = snake(str(key)).strip()
    if not name or name in IGNORED_KEYS or name in DYNAMIC_IGNORED_KEYS:
        return None
    if is_known_field_name(name):
        return None
    return name


# --- existing code continues below ---


def _stem(t):
    if t.endswith("ies") and len(t) > 4:
        return t[:-3] + "y"
    if t.endswith("s") and not t.endswith("ss") and len(t) > 3:
        return t[:-1]
    return t


def toks(name):
    out = []
    for t in str(name).lower().split("_"):
        if not t or t in STOP:
            continue
        t = _stem(t)
        t = SYN.get(t, t)
        if t not in out:
            out.append(t)
    return out


def make_matcher(fields, loose=False):
    """Returns match(key) -> list of canonical field names.
    Exact names and aliases win. Otherwise a field matches when all the words of one of its names
    appear in the key (so 'security_controls_relevant' finds 'security_controls').
    loose=True is used inside a single record: single-word names may match, and only the best field is returned."""
    exact = build_alias_map(fields)
    for alias, canon in SEMANTIC_ALIASES.items():
        if canon in fields:
            exact.setdefault(alias, canon)
    for combo, pieces in COMBINED_ALIASES.items():
        if all(piece in fields for piece in pieces):
            exact.setdefault(combo, pieces[0])

    names = []
    for canon, (_, aliases) in fields.items():
        for n in (canon,) + tuple(aliases):
            t = toks(n)
            if t:
                names.append((frozenset(t), canon))
    for alias, canon in SEMANTIC_ALIASES.items():
        if canon in fields:
            t = toks(alias)
            if t:
                names.append((frozenset(t), canon))
    for combo, pieces in COMBINED_ALIASES.items():
        if all(piece in fields for piece in pieces):
            t = toks(combo)
            if t:
                names.append((frozenset(t), pieces[0]))

    def match(key):
        key_text = str(key or '')
        if key_text in exact:
            return [exact[key_text]]
        normalized = snake(key_text)
        if normalized in exact:
            return [exact[normalized]]
        if normalized in COMBINED_ALIASES:
            return list(COMBINED_ALIASES[normalized])
        order = toks(key_text)
        kt = set(order)
        if not kt:
            return []
        best = {}
        for nt, canon in names:
            if not nt <= kt:
                continue
            score = (len(nt), -min(order.index(t) for t in nt))
            if canon not in best or score > best[canon]:
                best[canon] = score
        if not best:
            return []
        if loose:
            return [max(best, key=best.get)]
        return sorted(best, key=lambda canon: (-best[canon][0], best[canon][1], canon))

    return match


for _cfg in STAGES.values():
    _cfg["alias_map"] = build_alias_map(_cfg["fields"])
    _cfg["matcher"] = make_matcher(_cfg["fields"])
    for _rs_cfg in _cfg["records"].values():
        _rs_cfg["matcher"] = make_matcher(_rs_cfg["spec"], loose=True)

# Every alias of every stage, used to decide whether a JSON file is a manifest instead of content.
ALL_ALIASES = set().union(*(set(c["alias_map"]) for c in STAGES.values()), set(SEMANTIC_ALIASES))

# Keys that hold whole records of some stage. Never searched for fields of another stage.
ALL_RECORD_KEYS = set()
for _cfg in STAGES.values():
    for _canon, (_kind, _aliases) in _cfg["fields"].items():
        if _kind == "records":
            ALL_RECORD_KEYS |= {_canon, *_aliases}


def is_record_key(key) -> bool:
    if key in ALL_RECORD_KEYS:
        return True
    for cfg in STAGES.values():
        for canon in cfg["matcher"](key):
            if cfg["fields"][canon][0] == "records":
                return True
    return False
