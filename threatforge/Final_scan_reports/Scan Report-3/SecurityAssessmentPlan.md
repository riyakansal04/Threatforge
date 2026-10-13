# Security Assessment Plan

## Scope

This plan uses the existing architecture and threat-model outputs:

- `Scan Report-1\ApplicationIntelligence.json`
- `Scan Report-2\ThreatModel.json`
- `Scan Report-2\ThreatRecords.json`
- `Scan Report-2\ThreatRelationships.json`

I also read the referenced Codex task `01a0eb26-5bed-7960-817c-16d392f96b53`. Its content is mainly ThreatForge dashboard/lifecycle UI context, so this plan uses it only as supporting vocabulary for the lifecycle flow. It is not treated as evidence about Breakable Flask.

No scans were executed. No source code was modified. This document is a planning artifact only.

## Assessment Objectives

| Objective | Security question | Related threats | Expected result |
| --- | --- | --- | --- |
| AO-01 | Which plausible threats have complete source-backed paths? | T001-T009 | A baseline static determination of reachability, controls, and missing counterevidence. |
| AO-02 | Which paths are actually exploitable, not just dangerous-looking patterns? | T001-T008 | Preconditions and exploitability decisions suitable for triage. |
| AO-03 | Which behaviors depend on runtime environment? | T002, T004, T005, T007, T008, T009 | Safe validation plan for shell, parser, JWT, SQL, and oracle behavior. |
| AO-04 | Do dependencies add known or version-specific risk? | T004, T005, T007, T008, T009 | Dependency risk context and exact-version gaps. |

The highest-value assets from the threat model are the application host execution context, JWT authentication claims, cryptographic/config material, and database contents. The plan therefore focuses on routes and libraries that cross from HTTP input into code execution, command execution, parsing, template rendering, SQL execution, decryption, and JWT verification.

## Selected Capabilities

### Standard Security Scan

Selected as the baseline scan. The application is small enough that a full repository scan is appropriate and cheaper than over-partitioning. It should review `main.py`, dependency manifests, and setup documentation to confirm whether each threat has a complete source path and whether the code includes any controls that the threat model did not account for.

Primary focus:

- Route-to-sensitive-operation paths
- JWT/authentication logic
- Database query construction
- Startup configuration and database bootstrap
- Secret/key handling

Related threats: T001-T009.

### Exploitable Security Scan

Selected for focused feasibility analysis after the baseline pass. The threat model intentionally labels scenarios as plausible rather than confirmed. An exploitable scan is the right capability for deciding which of those plausible paths are actually reachable by an unauthenticated or guest actor and what exact preconditions are needed.

Primary focus:

- Pickle cookie path
- OS command path
- Python `eval`
- Server-side template rendering
- XML parser behavior
- Config decryption oracle
- JWT algorithm confusion / None algorithm

Related threats: T001-T008.

### Runtime / Dynamic Security Validation

Selected because several questions cannot be fully answered statically. Shell parsing, lxml entity behavior, JWT branch acceptance, database driver behavior, and padding-oracle response signal are runtime-dependent.

This must be performed only in an isolated disposable local lab, never against a shared or production environment.

Related threats: T001, T002, T004, T005, T006, T007, T008, T009.

### Supply-Chain / Dependency Security Scan

Selected because the app depends on security-sensitive packages and uses lower-bound requirements rather than a lockfile. Dependency behavior matters especially for Flask/Jinja rendering, lxml parsing, JWT handling, pycryptodome crypto behavior, and optional database drivers.

Related threats: T004, T005, T007, T008, T009.

## Capabilities Not Selected Now

### Deep Security Scan

Deferred. The current target is a compact single-file application and the existing threat model already identifies the main route-level concerns. A Deep Security Scan becomes appropriate if baseline/exploitability work leaves major uncertainty, if formal assurance requires variance reduction, or if the codebase expands.

### Module Security Scan

Deferred. A module scan would mostly duplicate the Standard Security Scan because `main.py` contains nearly all application logic. It becomes useful if future versions split handlers, JWT helpers, database logic, or parser logic into separate modules.

## Planned Scan Focuses

### SF-01: Repository-Wide Baseline Source Security Scan

Capability: Standard Security Scan

Target: entire current Codebase folder, especially `main.py`, manifests, and setup docs.

Objective: confirm source-backed paths for T001-T009 and identify actual controls/counterevidence.

Why this scope is sufficient: the app is architecturally flat, and ApplicationIntelligence found no separate service layer, template directory, or package tree. A full static pass over the small repo should cover the meaningful source surface.

Limitations: cannot prove exploitability for environment-dependent behavior.

### SF-02: Execution And Interpreter Exploitability Review

Capability: Exploitable Security Scan

Target: `/cookie`, `/lookup`, `/evaluate`, and `/sayhi`.

Objective: determine whether cookie deserialization, command execution, eval, and template rendering paths are exploitable from realistic actor positions.

Related threats: T001, T002, T003, T006.

Why this scope is appropriate: these threats share the highest-impact asset, the application host execution context, but use different mechanisms. They need focused path reasoning before runtime testing.

Limitations: cannot confirm shell behavior, pickle payload behavior, or Jinja reachable objects without dynamic validation.

### SF-03: Parser, Crypto, And JWT Exploitability Review

Capability: Exploitable Security Scan

Target: `/xml`, `/config`, `/user`, `/user/jwks`, `/user/login`.

Objective: refine exploitability questions for XXE, padding oracle behavior, and JWT algorithm confusion.

Related threats: T004, T005, T008.

Why this scope is appropriate: all three depend on library behavior and cryptographic/token validation details. The review should identify exact runtime probes needed and avoid broad, unfocused testing.

Limitations: cannot confirm actual parser resolution, oracle signal, or token acceptance without runtime execution.

### SF-04: Controlled Local Runtime Validation Of HTTP Attack Surfaces

Capability: Runtime / Dynamic Security Validation

Target: isolated local Breakable Flask instance.

Objective: validate behavior observed in static/exploitable scans using safe, non-destructive requests.

Related threats: T001, T002, T004, T005, T006, T008.

Prerequisites:

- Explicit authorization for dynamic validation
- Disposable local environment
- Installed dependencies
- No production/shared target
- Defined payload safety rules

Limitations: default local behavior may not match production or optional database environments.

### SF-05: Database Backend Validation For SQL And Startup Authority

Capability: Runtime / Dynamic Security Validation

Target: `/listservices` and database startup paths.

Objective: determine whether SQL manipulation is exploitable against the selected backend and how database privileges change impact.

Related threats: T007, T009.

Prerequisites:

- Selected database backend
- Disposable database instance
- Non-production credentials
- Agreement on read-only versus destructive test limits

Limitations: without an external backend selection, results apply only to default SQLite.

### SF-06: Dependency And Supply-Chain Review

Capability: Supply-Chain / Dependency Security Scan

Target: `requirements.txt` and `database-requirements.txt`.

Objective: identify known advisories, unsafe lower bounds, and version ambiguity relevant to Flask/Jinja, lxml, PyJWT, pycryptodome, and database drivers.

Related threats: T004, T005, T007, T008, T009.

Limitations: exact installed-version risk cannot be finalized without a lockfile or runtime package inventory.

## Assessment Dependencies

1. SF-01 should run first. It establishes the baseline and prevents later phases from validating unreachable assumptions.
2. SF-02 and SF-03 should consume SF-01 output. They refine exploitability for the most important attack paths.
3. SF-06 should run before or alongside runtime validation. Dependency versions may change parser/JWT behavior.
4. SF-04 requires explicit authorization and an isolated runtime.
5. SF-05 requires a selected database backend and disposable database instance.

## Coverage Gaps

Production risk remains uncovered because no deployment topology is available. The plan cannot answer questions about internet exposure, reverse proxy controls, process user, filesystem permissions, container isolation, or network egress.

External database impact remains conditional until a backend is selected. SQLite, PostgreSQL, MySQL, MSSQL, and Oracle can behave differently.

Dependency risk remains partially unresolved without exact installed versions. The requirements files define lower bounds, not a lockfile.

Severity and prioritization should remain context-dependent because the application is intentionally vulnerable. The right priority depends on whether the goal is training completeness, exploit demonstration, or hardening readiness.

## Output References

Detailed machine-readable records are in:

- `ScanPlan.json`
- `ScanFocus.json`

