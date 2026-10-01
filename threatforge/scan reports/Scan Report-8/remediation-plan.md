# Remediation Plan: ThreatForge Findings

## Proposed Remediation And Expected Security Improvement

This is a **suggestion-only** remediation report. It proposes fixes priority-wise and does not modify source code.

The proposed remediation strategy is to close the actual broken trust boundaries in `main.py`, not just suppress individual payload examples. The highest priority work removes unauthenticated routes from direct process/host execution paths, then hardens authentication, database access, XML parsing, output encoding, key storage, config selector integrity, and cookie flags.

Expected improvement: untrusted HTTP input should remain data, not become Python code, shell commands, pickled objects, Jinja source, SQL syntax, JWT verifier choices, XML external resource requests, or raw executable browser markup.

## Priority Remediation Queue

### 1. TF-001: Unauthenticated Python Eval Code Execution

- Affected code: `main.py:372-379`
- Root cause: `request.form["expression"]` is passed directly to `eval`.
- Proposed remediation: remove `eval`; if arithmetic support is required, use a constrained AST evaluator that accepts only numeric constants and arithmetic operators.
- Preserve behavior: `/evaluate` still supports simple arithmetic.
- Validation: confirm `1+2` works; confirm imports, builtins, attributes, calls, and comprehensions are rejected.

### 2. TF-002: OS Command Injection In DNS Lookup

- Affected code: `main.py:171-172`, `main.py:353-361`
- Root cause: `address` is concatenated into `os.popen`.
- Proposed remediation: remove shell execution; use a DNS/socket resolver or `subprocess` with `shell=False` and fixed arguments.
- Preserve behavior: `/lookup` still resolves normal hostnames/IPs.
- Validation: confirm shell metacharacter payloads do not execute.

### 3. TF-003: Pickle Deserialization Of Client Cookie

- Affected code: `main.py:320-350`
- Root cause: client cookie is deserialized with `pickle.loads`.
- Proposed remediation: replace pickle with signed JSON or Flask signed sessions.
- Preserve behavior: submitted cookie value can still be displayed.
- Validation: confirm tampered cookies and pickle payloads are rejected.

### 4. TF-004: Server-Side Template Injection

- Affected code: `main.py:450-468`
- Root cause: user input becomes Jinja template source.
- Proposed remediation: use a fixed template and pass `name` as a variable.
- Preserve behavior: `/sayhi` still renders a greeting.
- Validation: confirm `{{7*7}}` is not evaluated.

### 5. TF-006: JWT Algorithm Confusion And None Acceptance

- Affected code: `main.py:29-36`, `main.py:211-279`, `main.py:510-537`
- Root cause: untrusted JWT `alg` header controls verifier choice and permits `None`/HS256.
- Proposed remediation: pin verification to server-selected RS256; remove `None` and HS256 from this flow.
- Preserve behavior: valid RS256 login token still works.
- Validation: confirm `alg=None` and HS256 tokens are rejected.

### 6. TF-005: SQL Injection In `listservices`

- Affected code: `main.py:472-505`, `main.py:647-656`
- Root cause: category query parameter is interpolated into SQL.
- Proposed remediation: use DB-API parameter binding and generic DB errors.
- Preserve behavior: service listing and category filtering still work.
- Validation: confirm quote/comment/UNION payloads do not change query semantics.

### 7. TF-007: Unsafe XML Parser Configuration

- Affected code: `main.py:392-411`
- Root cause: untrusted XML parsed with DTD loading, network access, and `huge_tree`.
- Proposed remediation: set `no_network=True`, `load_dtd=False`, `resolve_entities=False`, `huge_tree=False`; catch parse errors safely.
- Preserve behavior: simple XML still parses.
- Validation: confirm external entity payloads are not resolved.

### 8. TF-009: Raw HTML Rendering Of Attacker-Influenced Values

- Affected code: `main.py:325-334`, `main.py:484-500`, `main.py:519-526`
- Root cause: user/token/database/error values are concatenated into HTML.
- Proposed remediation: use autoescaped templates or `html.escape`; avoid raw exception reflection.
- Preserve behavior: cookie values, service rows, and user status still render.
- Validation: confirm script payloads render as text.

### 9. TF-010: Predictable Temporary JWT Private Key Storage

- Affected code: `main.py:107-123`
- Root cause: generated private key is written to predictable temp path and path is printed.
- Proposed remediation: require explicit key files for non-development use; if demo fallback remains, keep keys in memory or a private restricted directory and do not print private key paths.
- Preserve behavior: app can still start in local demo mode if required.
- Validation: confirm no predictable private key file is created and JWT login still works.

### 10. TF-008: AES-CBC Config Selector Oracle

- Affected code: `main.py:140-168`, `main.py:417-446`
- Root cause: `/config` decrypts attacker-supplied AES-CBC ciphertext and returns distinct errors.
- Proposed remediation: use signed opaque tokens or authenticated encryption; return generic errors; allow only viewable `app_` keys.
- Preserve behavior: config links still show viewable app settings.
- Validation: confirm hidden config keys cannot be selected and tampered tokens get generic errors.

### 11. TF-011: Authentication Cookie Missing Security Attributes

- Affected code: `main.py:540-551`, `main.py:510-516`
- Root cause: auth cookie lacks `HttpOnly`, `Secure`, and `SameSite`.
- Proposed remediation: set `httponly=True`, appropriate `samesite`, and `secure=True` for HTTPS/deployments.
- Preserve behavior: login still sets a cookie read by `/user`.
- Validation: confirm `Set-Cookie` contains expected flags.

## Validation Candidates

- `TC-002`: Validate exact lxml/libxml2 external resource behavior, or harden parser immediately.
- `TC-003`: Review temp directory ACLs, user separation, and logs for JWT key exposure.
- `TC-001`: Run authorized SCA/advisory lookup for `requirements.txt`.

## Validation Information

No implementation was authorized for this report, so validation is a proposed post-fix plan. Minimum validation after any implemented batch:

- `python -m py_compile main.py`
- focused Flask test-client checks for remediated routes
- negative security checks for the original payload class
- positive control checks for intended normal behavior

## Status

- Source code modified: false
- Remediation applied: false
- Report mode: suggestion only
