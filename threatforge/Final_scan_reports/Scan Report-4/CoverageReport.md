# Coverage Report

## Execution Status

Status: completed static standard scan

Validation mode: static source review only

Runtime testing: not performed

Source modification: not performed

Managed scan id: `273eb7b9-0470-443d-8f09-1c9bd5cf012f`

## Assessed Areas

| Area | Coverage | Notes |
| --- | --- | --- |
| Flask route handlers in `main.py` | Reviewed | All primary routes from ApplicationIntelligence were inspected. |
| Cookie handling | Reviewed | `/cookie` value cookie serialization/deserialization reviewed. |
| Command execution | Reviewed | `rp()` and `/lookup` reviewed. |
| Python expression evaluation | Reviewed | `/evaluate` reviewed. |
| XML parsing | Reviewed | `/xml` parser configuration reviewed. |
| Config encryption/decryption | Reviewed | AES-CBC helpers and `/config` reviewed. |
| Template rendering | Reviewed | `/sayhi` reviewed. |
| SQL query construction | Reviewed | `/listservices` and startup database bootstrap reviewed. |
| JWT authentication | Reviewed | token creation, verification branches, `/user`, `/user/login`, `/user/jwks` reviewed. |
| Startup configuration | Reviewed | CLI args, database selection, key file handling, and app.run reviewed. |
| Dependency manifests | Partially reviewed | Manifests inspected for declared packages; advisory lookup and exact-version resolution were not performed. |
| External database behavior | Deferred | No backend selected for runtime validation. |
| Runtime exploitability | Deferred | Covered by ScanPlan SF-04/SF-05, not executed in this Standard scan. |

## Files Fully Reviewed

- `main.py`
- `README.md`
- `requirements.txt`
- `database-requirements.txt`
- `docker_database_setup.md`
- `vulnerability_index.md`
- `Scan Report-1\ApplicationIntelligence.json`
- `Scan Report-2\ThreatModel.json`
- `Scan Report-2\ThreatRecords.json`
- `Scan Report-2\ThreatRelationships.json`
- `Scan Report-3\ScanPlan.json`
- `Scan Report-3\ScanFocus.json`

## Exclusions

- No Git history review; the target folder is not a Git repository.
- No runtime route execution.
- No destructive or external database testing.
- No production deployment assessment because no production deployment artifacts were present.
- No network dependency advisory lookup.

## Open Questions

1. Which database backend should be considered authoritative for SQL injection impact?
2. What exact dependency versions are installed in the runtime environment?
3. Is the app ever bound to a non-local address using `--address`?
4. What process user, filesystem permissions, and network egress controls exist in any non-lab deployment?
5. Should severity be interpreted as lab/training coverage or as production-hardening risk?

