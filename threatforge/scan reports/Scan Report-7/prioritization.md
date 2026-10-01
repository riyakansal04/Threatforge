# ThreatForge Findings Prioritization

## Metadata

- Prioritization ID: `prioritization-threatforge-20260923`
- Repository: `breakableflask-master`
- Inputs: repository intelligence, architecture threat model, security baseline, deduplicated triage results, and source evidence
- Output directory: `Scan Report-7`
- Source code modified: false
- Remediation applied: false

No team capacity, sprint size, engineer count, or remediation limit was provided. This report therefore creates a default ordered remediation queue with immediate, near-term, planned, and validation tracks.

## Summary

- Findings prioritized: 11
- Validation candidates prioritized: 3
- Immediate attention: 4
- Near-term remediation: 3
- Planned remediation: 4
- Further validation required: 3

Priority was not determined by severity alone. The ordering weighs exploitability, unauthenticated reachability, shared-process blast radius, affected assets, threat-model convergence, existing controls, relationships between findings, and likely remediation effort.

## Immediate Attention

### 1. TF-001: Unauthenticated Python Eval Code Execution

- Source findings: `BF-001`, `MAINPY-001`
- Evidence: `main.py:372-379`
- Priority reason: This is the clearest unauthenticated path to full Python execution in the shared Flask process. It can expose keys, config, database cursor state, local files, and downstream application logic.
- Action: Remove `eval` or replace it with a constrained evaluator; disable the route in deployable contexts until fixed.

### 2. TF-002: OS Command Injection In DNS Lookup

- Source findings: `BF-002`, `MAINPY-002`
- Evidence: `main.py:171-172`, `main.py:353-361`
- Priority reason: Unauthenticated input crosses directly into `os.popen`, reaching the host command boundary. It ranks just below eval because the exact behavior depends on shell/OS context, but the impact remains host-level.
- Action: Replace shell execution with a DNS library or `subprocess` argument list with shell disabled.

### 3. TF-003: Pickle Deserialization Of Client Cookie

- Source findings: `BF-003`, `MAINPY-003`
- Evidence: `main.py:320-350`
- Priority reason: Client-controlled pickle data is a high-confidence process execution primitive. It is also a comparatively direct fix.
- Action: Replace pickle cookie state with signed JSON/session state or server-side state.

### 4. TF-004: Server-Side Template Injection

- Source findings: `BF-004`, `MAINPY-004`
- Evidence: `main.py:450-468`
- Priority reason: Although ranked high rather than critical in the scan, exploitability is strong and remediation is small. User input becomes Jinja template source.
- Action: Render a fixed template and pass user input as escaped data.

## Near-Term Remediation

### 5. TF-006: JWT Algorithm Confusion And None Acceptance

- Source findings: `BF-006`, `MAINPY-006`
- Evidence: `main.py:29-36`, `main.py:211-279`, `main.py:510-537`
- Priority reason: This breaks the authentication boundary and can combine with key exposure and token theft paths. It follows process-compromise issues because the current app's admin state is limited, but it should not wait long.
- Action: Pin verification to a server-selected algorithm and remove `None`/HS256 from the RSA flow.

### 6. TF-005: SQL Injection In `listservices`

- Source findings: `BF-005`, `MAINPY-005`
- Evidence: `main.py:472-505`, `main.py:647-656`
- Priority reason: Direct unauthenticated database query manipulation affects data access and integrity. Impact depends on backend behavior and privileges.
- Action: Parameterize queries across supported drivers and avoid returning raw database errors.

### 7. TF-007: Unsafe XML Parser Configuration

- Source findings: `BF-007`, `MAINPY-007`
- Evidence: `main.py:392-411`
- Priority reason: Unauthenticated XML parsing uses DTD/network-capable settings. Exact file/network behavior is runtime-dependent, but hardening is usually low effort.
- Action: Disable DTD loading, network access, entity resolution, and huge-tree parsing for untrusted XML.

## Planned Remediation

### 8. TF-009: Raw HTML Rendering Of Attacker-Influenced Values

- Source findings: `BF-009`, `MAINPY-008`
- Evidence: `main.py:325-334`, `main.py:484-500`, `main.py:519-526`
- Priority reason: XSS risk is important and amplifies cookie/token weaknesses, but direct server-side execution and auth/data access issues should land first.
- Action: Move response rendering to autoescaped templates and stop reflecting raw exception text.

### 9. TF-010: Predictable Temporary JWT Private Key Storage

- Source findings: `BF-010`, `MAINPY-009`
- Evidence: `main.py:107-123`
- Priority reason: JWT private key exposure is serious but depends on same-host or log access and whether fallback generation is used.
- Action: Require explicit key management or generate keys only in a private restricted directory without logging paths.

### 10. TF-008: AES-CBC Config Selector Oracle

- Source findings: `BF-008`, `MAINPY-010`
- Evidence: `main.py:140-168`, `main.py:417-446`
- Priority reason: Remotely reachable but lower impact in the current implementation because direct hidden byte-value rendering is constrained.
- Action: Use authenticated tokens/encryption, generic errors, and a strict selector allowlist.

### 11. TF-011: Authentication Cookie Missing Security Attributes

- Source findings: `BF-011`, `MAINPY-011`
- Evidence: `main.py:540-551`, `main.py:510-516`
- Priority reason: Quick hardening win, especially with XSS present, but lower standalone impact than execution and auth-bypass findings.
- Action: Set `HttpOnly`, `Secure` under HTTPS, and appropriate `SameSite`.

## Further Validation Required

1. `TC-002`: Validate exact lxml external resource behavior for `TF-007`.
2. `TC-003`: Validate generated temp key exposure through host ACLs and logs for `TF-010`.
3. `TC-001`: Run dependency advisory/SCA lookup for `requirements.txt`.

## Work Plan

With no capacity limit supplied, the proposed default plan is:

- First remediation batch: `TF-001`, `TF-002`, `TF-003`, `TF-004`
- Second remediation batch: `TF-006`, `TF-005`, `TF-007`
- Third remediation batch: `TF-009`, `TF-010`, `TF-008`, `TF-011`
- Parallel validation: `TC-002`, `TC-003`, `TC-001`

If only three fixes can be handled in the first cycle, take `TF-001`, `TF-002`, and `TF-003`.

## Coverage

All validated and deduplicated findings from `Scan Report-6` were prioritized. Repository intelligence, architecture/threat model, security baseline, and finding evidence were used as context. No source code was modified and no remediation was applied.
