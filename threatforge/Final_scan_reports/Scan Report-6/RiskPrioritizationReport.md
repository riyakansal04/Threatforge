# Risk-Based Prioritization Report

## Scope

This report prioritizes the eight technically confirmed findings from `Scan Report-5/TriageFindings.json`. It uses the architecture, threat model, scan plan, Standard Scan evidence, and triage conclusions generated in `Scan Report-1` through `Scan Report-5`.

The recommendations are proposed priorities only. The dashboard owns final priority, approvals, risk acceptance, workflow state, and remediation tracking.

## Context Used

The application is documented as an intentionally vulnerable Flask training app. The confirmed default execution binds to `127.0.0.1:4000` with an in-memory SQLite database. No production deployment, customer data, regulatory obligation, business-critical workflow, remediation SLA, or risk-acceptance record was supplied.

That context matters: if the app is isolated in an approved lab, operational urgency may be lower. If it is reachable by untrusted users, the unauthenticated execution paths become immediate high-order risks.

## Priority Summary

| Priority | Findings | Basis |
|---|---|---|
| Critical | BF-STD-003, BF-STD-002, BF-STD-001, BF-STD-006 | Unauthenticated request-controlled input reaches Python eval, OS command execution, unsafe pickle deserialization, or Jinja template interpretation. |
| High | BF-STD-008, BF-STD-007 | Token integrity and SQL query integrity are source-confirmed, but observed business impact or backend impact is more conditional than the direct execution paths. |
| Medium | BF-STD-004, BF-STD-005 | Parser and cryptographic oracle patterns are source-confirmed, but concrete exploit impact depends on runtime/library/environment behavior. |

No finding was assigned a remediation timeframe because no approved SLA or policy was provided.

## Individual Risk Assessments

### BF-STD-003: Python eval expression injection

Proposed priority: Critical.

The technical severity is high because request-controlled input reaches Python `eval`, creating a direct route from HTTP form data to interpreter execution. Exploitability is technically plausible with low apparent prerequisites: an attacker needs only route reachability and the ability to submit the `expression` field. No authentication, sandbox, restricted globals, or parser allowlist was observed.

The finding maps to threat `T003` and the process-integrity objective. The biggest uncertainty is deployment exposure: default localhost training use reduces operational urgency, but any untrusted network exposure makes this a top remediation candidate.

### BF-STD-002: OS command injection

Proposed priority: Critical.

The technical severity is high because `/lookup` concatenates form input into an `nslookup` command that reaches `os.popen`. Exploitation was not dynamically demonstrated, but the code path is direct and unauthenticated. If reachable, impact can include command execution with Flask process privileges, data exposure, and service disruption.

This finding maps to `T002` and shares execution-boundary context with `T003`. Priority could be reduced only with strong evidence that the app is isolated to a lab or that runtime command execution is constrained by external controls not present in the source evidence.

### BF-STD-001: Pickle cookie deserialization

Proposed priority: Critical.

The technical severity is high because a client-controlled cookie is base64-decoded and passed to `pickle.loads`. Base64 does not provide integrity or authenticity, and no signing, MAC, or server-side session lookup was observed.

The attack path crosses the cookie trust boundary into Python deserialization. If the app is reachable by untrusted clients, this belongs with the first remediation group because unsafe pickle deserialization can compromise the application process.

### BF-STD-006: Jinja template injection

Proposed priority: Critical.

The technical severity is high because `/sayhi` inserts request input into template source before calling `render_template_string`. Runtime object reachability was not tested, but server-side template injection is a process-level interpretation boundary and may lead to internal object access or code execution depending on the Jinja environment.

The finding maps to `T006` and relates to BF-STD-003 because both interpret request-controlled text. The training-lab context is the main reason this remains a proposed, not final, critical priority.

### BF-STD-008: JWT algorithm confusion

Proposed priority: High.

The technical severity is high because token verification accepts `None` and `HS256` based on an untrusted JWT header, and `/user` trusts the resulting `sub` claim for admin state. The issue threatens authentication and authorization integrity.

The proposed priority is High rather than Critical because no real privileged operation beyond rendered admin state was documented, and forged-token acceptance was not dynamically validated. If admin state controls sensitive operations elsewhere or in a deployment variant, this should be reconsidered upward.

### BF-STD-007: SQL injection

Proposed priority: High.

The SQL injection path is source-confirmed: `category` is formatted into a SQL `WHERE` clause and executed. This affects query integrity and may affect confidentiality or database integrity.

Priority is High because the route is unauthenticated and database impact can be serious, but the practical blast radius depends on the selected backend, driver behavior, and database privileges. The documented default database contains training seed data; no production data sensitivity was supplied.

### BF-STD-004: XXE-enabled XML parser

Proposed priority: Medium.

The parser configuration is unsafe: untrusted XML is parsed with DTD loading and network access enabled. That creates plausible confidentiality, SSRF-like, or availability concerns.

Priority is Medium because exact impact depends on installed `lxml`/`libxml2` behavior and available local file or network targets, neither of which was validated. If runtime validation confirms sensitive file disclosure or internal network access, the priority should be revisited.

### BF-STD-005: CBC padding-oracle pattern

Proposed priority: Medium.

The `/config` route decrypts attacker-controlled ciphertext and returns padding errors. This is a source-confirmed cryptographic oracle pattern.

Priority is Medium because practical exploitation requires observable oracle behavior over repeated requests and affects a narrower configuration-key asset than the direct execution findings. If CONFIG contains production secrets or runtime testing confirms reliable decryption/forgery, priority may increase.

## Sequencing Considerations

The direct execution group should be addressed first if this app is reachable by untrusted users:

1. BF-STD-003, BF-STD-002, BF-STD-001, BF-STD-006.
2. BF-STD-008 and BF-STD-007.
3. BF-STD-004 and BF-STD-005, with runtime validation to calibrate impact.

No remediation deadlines are recommended because no documented SLA or policy was available.

## Unresolved Questions

- Is the application ever bound beyond `127.0.0.1` or reachable by untrusted users?
- Is this code used only in an intentionally vulnerable training lab?
- Are any real privileged operations controlled by the JWT admin `sub` claim?
- Which database backend and privilege set are used outside the default SQLite mode?
- What exact dependency versions are installed in the runtime?
- Do CONFIG values or local runtime files contain business-sensitive or regulated data?

