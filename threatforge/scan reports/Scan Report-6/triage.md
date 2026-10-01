# Security Findings Triage And Deduplication

## Metadata

- Triage ID: `triage-dedup-threatforge-20260923`
- Repository: `breakableflask-master`
- Inputs: `Scan Report-1` through `Scan Report-5`, `main.py`, `requirements.txt`, `vulnerability_index.md`
- Output directory: `Scan Report-6`
- Source code modified: false
- Runtime validation performed: false

No `SECURITY.md` was found. Boundary assessment used the README/project role, previous repository intelligence, previous threat model, and Flask route evidence in `main.py`.

## Summary

- Input findings assessed: 22
- Input candidates assessed: 6
- Confirmed input findings: 22
- Requires validation candidates: 6
- False positives: 0
- Already addressed: 0
- Deduplicated logical findings: 11
- Deduplicated validation candidates: 3

The `Scan Report-4` standard scan and `Scan Report-5` focused scan report the same 11 implementation-backed issues. They were consolidated only where source locations, root causes, and attack paths matched. Similar titles, CWE, or severity alone were not used for merging.

## Deduplicated Logical Findings

### TF-001: Unauthenticated Python Eval Code Execution

- Classification: Confirmed
- Source findings: `BF-001`, `MAINPY-001`
- Affected code: `main.py:372-379`
- Reasoning: Both findings trace unauthenticated `POST /evaluate` input from `request.form["expression"]` to `eval(expression)` with no sandbox, allowlist, or authentication.
- Conditions: Flask app running and `/evaluate` reachable.
- Controls: none before interpreter execution.
- Dedup decision: same source, sink, route, and root cause.

### TF-002: OS Command Injection In DNS Lookup

- Classification: Confirmed
- Source findings: `BF-002`, `MAINPY-002`
- Affected code: `main.py:171-172`, `main.py:353-361`
- Reasoning: Both findings trace `address` from `POST /lookup` into `rp("nslookup " + address)`, where `rp()` calls `os.popen`.
- Conditions: Flask app running and shell command environment available.
- Controls: no argument separation, hostname validation, or `shell=False` equivalent.
- Dedup decision: same command construction and sink.

### TF-003: Pickle Deserialization Of Client Cookie

- Classification: Confirmed
- Source findings: `BF-003`, `MAINPY-003`
- Affected code: `main.py:320-350`
- Reasoning: Both findings identify client-controlled `value` cookie data flowing through base64 decoding to `pickle.loads`.
- Conditions: Attacker can set a cookie and request `/cookie`.
- Controls: base64 encoding only; no signature, MAC, or safe serializer.
- Dedup decision: same cookie trust boundary and deserialization sink.

### TF-004: Server-Side Template Injection

- Classification: Confirmed
- Source findings: `BF-004`, `MAINPY-004`
- Affected code: `main.py:450-468`
- Reasoning: Both findings identify `request.form["name"]` being interpolated into template source before `render_template_string`.
- Conditions: Attacker can submit `POST /sayhi`.
- Controls: no fixed template or escaped variable binding.
- Dedup decision: same template-source injection path.

### TF-005: SQL Injection In `listservices`

- Classification: Confirmed
- Source findings: `BF-005`, `MAINPY-005`
- Affected code: `main.py:472-505`, `main.py:647-656`
- Reasoning: Both findings trace `category` from the query string into a formatted SQL `WHERE` clause executed by `cursor.execute`.
- Conditions: Database initialized and `/listservices` reachable.
- Controls: no parameterized query; `try/except` only reflects errors and does not prevent injection.
- Dedup decision: same route, SQL construction, and database sink.

### TF-006: JWT Algorithm Confusion And None Acceptance

- Classification: Confirmed
- Source findings: `BF-006`, `MAINPY-006`
- Affected code: `main.py:29-36`, `main.py:211-279`, `main.py:510-537`
- Reasoning: Both findings trace the authentication cookie to `verify_token`, which uses `jwt.get_unverified_header` and permits `RS256`, `HS256`, and `None`; `/user` trusts `sub == admin`.
- Conditions: Attacker can supply an authentication cookie with claims satisfying accepted verifier checks.
- Controls: audience, issuer, and time checks exist, but do not defeat attacker-selected algorithm dispatch.
- Dedup decision: same authentication trust-boundary failure.

### TF-007: Unsafe XML Parser Configuration

- Classification: Confirmed
- Source findings: `BF-007`, `MAINPY-007`
- Affected code: `main.py:392-411`
- Reasoning: Both findings identify unauthenticated XML input parsed by lxml with `no_network=False`, `load_dtd=True`, and `huge_tree=True`.
- Conditions: Attacker can submit XML to `/xml`.
- Controls: `html.escape` occurs after parsing and does not constrain parser resource behavior.
- Dedup decision: same parser configuration and route.
- Validation note: exact file/network/entity behavior remains runtime-dependent.

### TF-008: AES-CBC Config Selector Oracle

- Classification: Confirmed
- Source findings: `BF-008`, `MAINPY-010`
- Affected code: `main.py:140-168`, `main.py:417-446`
- Reasoning: Both findings identify chosen ciphertext from `/config?key=...` being decrypted with AES-CBC and returning distinguishable exception text.
- Conditions: Attacker can query `/config` and observe responses.
- Controls: page links only `app_` keys, but decrypted selectors are checked against all `CONFIG` keys.
- Dedup decision: same decrypt/unpad oracle.

### TF-009: Raw HTML Rendering Of Attacker-Influenced Values

- Classification: Confirmed
- Source findings: `BF-009`, `MAINPY-008`
- Affected code: `main.py:325-334`, `main.py:484-500`, `main.py:519-526`
- Reasoning: Both findings identify raw string-built HTML with attacker-influenced values. `MAINPY-008` expands the evidence to include `/listservices`.
- Conditions: Victim browser renders attacker-influenced route output.
- Controls: no consistent template autoescaping or explicit escaping for these outputs.
- Dedup decision: same missing output-encoding control; scope expansion preserved.

### TF-010: Predictable Temporary JWT Private Key Storage

- Classification: Confirmed
- Source findings: `BF-010`, `MAINPY-009`
- Affected code: `main.py:107-123`
- Reasoning: Both findings identify fallback key generation writing `private.pem` and `public.pem` to predictable temp paths and printing those paths.
- Conditions: `PRIVATE_KEY_FILE` and `PUBLIC_KEY_FILE` absent; host/log exposure determines exploitability.
- Controls: environment-provided key files mitigate only when configured.
- Dedup decision: same startup fallback key-storage issue.

### TF-011: Authentication Cookie Missing Security Attributes

- Classification: Confirmed
- Source findings: `BF-011`, `MAINPY-011`
- Affected code: `main.py:540-551`, `main.py:510-516`
- Reasoning: Both findings identify the login route setting the bearer JWT cookie with only value and expiry.
- Conditions: User successfully logs in.
- Controls: cookie expiry exists, but `Secure`, `HttpOnly`, and `SameSite` are omitted.
- Dedup decision: same `set_cookie` call and authentication cookie trust.

## Candidates Requiring Validation

- `TC-001`: Dependency CVE status. Duplicates `CAND-001` and `CAND-MAINPY-001`; requires authorized advisory/SCA lookup.
- `TC-002`: Exact lxml external resource behavior. Duplicates `CAND-002` and `CAND-MAINPY-002`; source configuration is unsafe, but runtime file/network behavior needs validation.
- `TC-003`: Temp key exposure on host. Duplicates `CAND-003` and `CAND-MAINPY-003`; source writes predictable files, but ACL/log exposure needs deployment review.

## Related But Separate Findings

- TF-001, TF-002, TF-003, and TF-004 all can lead to process authority, but remain separate because each has a different source, sink, and broken control.
- TF-006, TF-010, TF-011, and TF-009 can combine in token-forgery or token-theft paths, but remain separate because they affect different controls: token verification, key storage, cookie hardening, and output encoding.
- TF-005 and TF-009 both involve `/listservices`, but SQL query integrity and HTML output encoding are separate issues.

## Coverage

Triage covered all supplied findings and candidates from `Scan Report-4` and `Scan Report-5`. The review used prior context from repository intelligence, architecture/threat model, security baseline, scan results, and direct source evidence. No dynamic validation, dependency advisory lookup, exploit testing, or source modification was performed.
