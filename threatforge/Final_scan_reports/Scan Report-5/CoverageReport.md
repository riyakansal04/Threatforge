# Triage Coverage Report

## Reviewed Inputs

- `Scan Report-4/findings.json`: 8 findings reviewed.
- `Scan Report-4/results.sarif`: used for SARIF continuity.
- `Scan Report-1/ApplicationIntelligence.json`: used for architecture and component context.
- `Scan Report-2/ThreatModel.json` and `Scan Report-2/ThreatRelationships.json`: used for threat and relationship context.
- `Scan Report-3/ScanPlan.json` and `Scan Report-3/ScanFocus.json`: used for approved scope and assessment boundaries.

## Coverage Summary

| Category | Count |
|---|---:|
| Findings reviewed | 8 |
| Confirmed by static evidence | 8 |
| Needs review | 0 |
| Not actionable | 0 |
| True duplicates | 0 |
| Findings not fully assessed | 0 |

Every finding in the completed Standard Scan was reviewed for evidence-to-claim support, reachability, root cause, validation limits, false-positive considerations, duplicate status, and related-finding links.

## Assessed Areas

- Authentication and token handling: BF-STD-008.
- Cookie trust boundary and deserialization: BF-STD-001.
- Command and code execution paths: BF-STD-002 and BF-STD-003.
- Server-side template interpretation: BF-STD-006.
- XML parser configuration: BF-STD-004.
- Cryptographic decrypt/error behavior: BF-STD-005.
- SQL query construction and database boundary: BF-STD-007.

## Exclusions

- No runtime requests were sent to the application.
- No exploit payloads were executed.
- No database server or external service was contacted.
- No dependency advisory lookup was performed.
- No dashboard triage status, risk acceptance, approval, or workflow decision was assigned.
- No application source code or configuration was changed.

## Processing Limitations

- Static review can confirm source-to-sink implementation patterns but cannot prove runtime exploitability for shell behavior, Jinja object access, XML entity resolution, JWT token acceptance, CBC oracle reliability, or database-specific SQL behavior.
- Exact dependency versions were not available from a lockfile or environment inventory.
- No repository `SECURITY.md` policy guidance was resolved for this scope.
- The installed codex-security plugin referenced a triage output contract file that was not present; the generated structured output preserves canonical finding IDs and includes the requested technical assessment fields.

## Uncovered Questions

- Which findings manifest in an isolated running instance under safe dynamic validation?
- What concrete database impact exists for each supported backend and configured privilege set?
- Which dependency versions are actually installed in the target runtime?
- Does production deployment expose any routes beyond localhost, and with what network controls?

