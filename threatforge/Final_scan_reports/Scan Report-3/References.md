# References

## Primary Inputs

- `Scan Report-1\ApplicationIntelligence.json`
- `Scan Report-1\ApplicationArchitectureReport.md`
- `Scan Report-1\SourceReferences.md`
- `Scan Report-2\ThreatModel.json`
- `Scan Report-2\ThreatRecords.json`
- `Scan Report-2\ThreatRelationships.json`
- `Scan Report-2\ThreatModelReport.md`

## Application Intelligence Records Used

- `application.name`: Breakable Flask
- `application.type`: single-file Flask web application
- `components.cookie_workflow`
- `components.lookup_workflow`
- `components.evaluate_workflow`
- `components.xml_workflow`
- `components.config_workflow`
- `components.sayhi_workflow`
- `components.services_workflow`
- `components.jwt_workflow`
- `components.database_bootstrap`
- `interfacesAndIntegrations.httpRoutes`
- `technologyStack.runtimeLibraries`
- `dataArchitecture.storageMechanisms`
- `securityRelevantImplementation.sensitiveOperations`
- `assumptionsAndUnknowns`

## Threat Model Records Used

- Assets:
  - `asset_host_execution_context`
  - `asset_auth_tokens`
  - `asset_config_and_crypto_secrets`
  - `asset_database_contents`
  - `asset_client_browser_session`
- Trust boundaries:
  - `tb_http_to_app`
  - `tb_app_to_host_execution`
  - `tb_app_to_parser_renderer`
  - `tb_app_to_database`
  - `tb_cookie_to_auth_and_deserialization`
  - `tb_startup_configuration`
- Threats:
  - `T001`: Client cookie deserialization
  - `T002`: DNS lookup command execution
  - `T003`: Python expression evaluation
  - `T004`: XML parser external resource access
  - `T005`: Config decryption oracle
  - `T006`: Server-side template execution
  - `T007`: SQL query manipulation
  - `T008`: JWT algorithm confusion or None-algorithm token acceptance
  - `T009`: Startup configuration exposure/authority amplification
- Threat relationships:
  - `TR001`: shared execution asset and boundary
  - `TR002`: shared server-side interpretation capability
  - `TR003`: shared confidentiality objective
  - `TR004`: deployment amplifies SQL impact
  - `TR005`: shared crypto assets
  - `TR006`: shared cookie boundary
  - `TR007`: exposure dependency

## Source Files Referenced Indirectly Through Prior Reports

- `main.py`
- `README.md`
- `requirements.txt`
- `database-requirements.txt`
- `docker_database_setup.md`
- `vulnerability_index.md`

## Referenced Codex Task

- Thread `01a0eb26-5bed-7960-817c-16d392f96b53` on host `local` was read before use.
- The thread concerns ThreatForge dashboard/lifecycle UI flow, including scan assessment, scanning tabs, triage, prioritization, remediation, Jira integration, and post-scan stages.
- It was used only for lifecycle framing, not as evidence for Breakable Flask security behavior.

