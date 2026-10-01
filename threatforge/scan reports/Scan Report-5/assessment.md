# Focused Security Scan: `main.py`

## Scan Metadata

- Scan ID: `focused-main-py-security-scan-20260923`
- Target: `main.py`
- Repository: `breakableflask-master`
- Output directory: `Scan Report-5`
- Daybreak access advisory: `not_granted`
- Source code modified: false
- Scope: focused module scan of `main.py`; supporting files and previous scan reports were used only as untrusted context.

## Summary

Confirmed findings: 11.

Severity distribution: critical 3, high 4, medium 2, low 2.

The scan used the previous repository intelligence, architecture/threat model, security baseline, and standard scan findings to focus on `main.py`, which owns the Flask routes, JWT/key handling, crypto selector handling, database bootstrap and query execution, XML parsing, command execution, and application startup.

## Confirmed Findings

### MAINPY-001: Unauthenticated Expression Evaluator Executes Python Code

- Severity: critical
- Category: Code injection
- Confidence: high
- CWE: CWE-95, CWE-94
- Affected area: `GET/POST /evaluate`
- Code location: `main.py:372-379`
- Root cause: The route reads `request.form["expression"]` and evaluates it with Python `eval` inside the Flask process. No authentication, sandbox, parser, allowlist, or restricted global context is applied.
- Attack path: An unauthenticated client sends `POST /evaluate`; `main.py:375-376` copies the form value into `expression`; `main.py:379` passes it to `eval`; the result is rendered.
- Impact: Arbitrary Python execution with access to module globals, keys, config, database cursor after startup, imported modules, filesystem, and network permissions of the Flask process.
- Evidence: `main.py:372`, `main.py:375-376`, `main.py:379`; prior threat model T1.
- Recommended remediation: Remove `eval`. If expression support is required, implement a constrained parser/evaluator with no access to builtins, imports, globals, or process state.

### MAINPY-002: DNS Lookup Route Concatenates Request Input Into `os.popen`

- Severity: critical
- Category: OS command injection
- Confidence: high
- CWE: CWE-78
- Affected area: `GET/POST /lookup`
- Code location: `main.py:171-172`, `main.py:353-361`
- Root cause: User-controlled `address` text is concatenated into a shell command and passed to `os.popen`.
- Attack path: A client posts `address`; the route builds `nslookup ` plus that value; `rp()` calls `popen(command).read()`, allowing shell interpretation of attacker-controlled text.
- Impact: Operating-system command execution as the Flask process user.
- Evidence: `main.py:11`, `main.py:171-172`, `main.py:356-360`.
- Recommended remediation: Use a DNS library or `subprocess.run(..., shell=False)` with a fixed argument list. Validate hostnames/IPs and escape output.

### MAINPY-003: Client-Controlled Cookie Is Deserialized With Pickle

- Severity: critical
- Category: Insecure deserialization
- Confidence: high
- CWE: CWE-502
- Affected area: `GET/POST /cookie`
- Code location: `main.py:320-350`
- Root cause: The route base64-decodes a client-held cookie and passes it to `pickle.loads` without signing or provenance checks.
- Attack path: A client sends a crafted `value` cookie; `/cookie` decodes and unpickles it before rendering the object.
- Impact: Arbitrary code execution or process-level side effects during unpickling.
- Evidence: `main.py:328-329`, `main.py:345-346`.
- Recommended remediation: Do not use pickle for client state. Use signed Flask sessions, JSON with authenticated signing, or server-side state keyed by opaque identifiers.

### MAINPY-004: Greeting Route Renders User Input As Jinja Template Source

- Severity: high
- Category: Server-side template injection
- Confidence: high
- CWE: CWE-1336
- Affected area: `GET/POST /sayhi`
- Code location: `main.py:450-468`
- Root cause: The route interpolates user input into the template source before calling `render_template_string`.
- Attack path: A client posts `name`; `main.py:454` formats it into HTML; `main.py:456-467` inserts it into the template; `main.py:468` renders that source through Jinja.
- Impact: Server-side template expression execution, potentially exposing process state and reaching code execution through runtime objects.
- Evidence: `main.py:454`, `main.py:456-468`.
- Recommended remediation: Render a fixed template and pass `name` as a variable so Jinja treats it as escaped data.

### MAINPY-005: Product Category Filter Is Interpolated Into SQL

- Severity: high
- Category: SQL injection
- Confidence: high
- CWE: CWE-89
- Affected area: `GET /listservices`
- Code location: `main.py:472-505`, `main.py:647-656`
- Root cause: The `category` query parameter is inserted into a SQL `WHERE` clause and executed by the global cursor.
- Attack path: A client requests `/listservices?category=...`; `main.py:480-481` formats the value into SQL; `main.py:484` executes the query.
- Impact: Query manipulation and unauthorized database access, including possible access to seeded `secret_stuff` data depending on backend behavior and privileges.
- Evidence: `main.py:476`, `main.py:480-484`, `main.py:60-65`, `main.py:77-80`.
- Recommended remediation: Use parameterized queries for all category values and avoid returning raw database errors.

### MAINPY-006: JWT Verification Trusts Attacker-Selected Algorithms

- Severity: high
- Category: Authentication bypass
- Confidence: high
- CWE: CWE-347, CWE-287
- Affected area: `GET /user`, `GET /user/jwks`, `GET/POST /user/login`
- Code location: `main.py:29-36`, `main.py:211-279`, `main.py:510-573`
- Root cause: `verify_token` dispatches verification based on an untrusted token header and allows `RS256`, `HS256`, and `None`; `/user` grants admin state solely from the `sub` claim.
- Attack path: A client supplies an `authentication` cookie; `jwt.get_unverified_header` selects the verification path; the `None` path accepts empty signatures after claim checks and HS256 reuses `VERIFY_KEY`; `/user` grants admin when `sub == admin`.
- Impact: Unauthorized transition to the app's admin response state.
- Evidence: `main.py:32`, `main.py:216-279`, `main.py:516-522`, `main.py:531-537`.
- Recommended remediation: Pin verification to a server-selected algorithm, remove `None` and HS256 from the RSA flow, and bind admin authorization to trusted server-side policy.

### MAINPY-007: XML Route Parses Untrusted XML With DTD And Network-Capable Settings

- Severity: high
- Category: XML external entity and resource processing
- Confidence: medium
- CWE: CWE-611
- Affected area: `GET/POST /xml`
- Code location: `main.py:392-411`
- Root cause: The route creates an lxml parser with `load_dtd=True`, `no_network=False`, and `huge_tree=True` for attacker-controlled XML.
- Attack path: A client posts XML; the parser is built at `main.py:397`; `etree.fromstring` parses attacker-controlled bytes at `main.py:399`.
- Impact: Potential local file disclosure, SSRF or network access, and parser resource exhaustion depending on runtime behavior.
- Evidence: `main.py:396-399`, `requirements.txt`.
- Recommended remediation: Use `defusedxml` or configure lxml with `no_network=True`, `load_dtd=False`, `resolve_entities=False`, and `huge_tree=False`. Enforce request size limits.

### MAINPY-008: User-Controlled Values Are Reflected Into HTML Without Escaping

- Severity: medium
- Category: Cross-site scripting
- Confidence: high
- CWE: CWE-79
- Affected area: `/cookie`, `/user`, `/listservices`
- Code location: `main.py:325-334`, `main.py:484-500`, `main.py:519-526`
- Root cause: Handlers concatenate user-controlled values, JWT claim values, database values, and exception text into HTML instead of using escaped template variables.
- Attack path: A client stores HTML/script in a cookie value, supplies a token whose `sub` or error text is reflected by `/user`, or influences rendered database/error output through `/listservices`.
- Impact: Script execution in the application origin, with increased token theft risk because the auth cookie is not HttpOnly.
- Evidence: `main.py:326`, `main.py:334`, `main.py:486`, `main.py:491-500`, `main.py:519-526`.
- Recommended remediation: Use autoescaped templates and avoid reflecting raw exception messages.

### MAINPY-009: Generated JWT Private Key Is Written To Predictable Temporary Path

- Severity: medium
- Category: Sensitive key storage
- Confidence: medium
- CWE: CWE-522
- Affected area: startup JWT key initialization
- Code location: `main.py:107-123`
- Root cause: When key-file environment variables are missing, startup writes `private.pem` and `public.pem` to `tempfile.gettempdir()` with predictable names and prints their paths.
- Attack path: A same-host actor or process reads the temp private key or logs; they can sign an RS256 token with `sub=admin`; `/user` accepts it.
- Impact: Local key disclosure can lead to JWT forgery for the running app.
- Evidence: `main.py:107-124`, `main.py:179-190`.
- Recommended remediation: Require explicit key management for non-development use. Store generated keys in a private directory with restrictive permissions and do not print sensitive paths.

### MAINPY-010: Config Selector Exposes AES-CBC Padding/Decryption Oracle

- Severity: low
- Category: Cryptographic oracle
- Confidence: medium
- CWE: CWE-203, CWE-327
- Affected area: `GET /config`
- Code location: `main.py:24-45`, `main.py:140-168`, `main.py:417-446`
- Root cause: The route decrypts attacker-supplied AES-CBC ciphertext and returns distinct exception text; successful plaintext is checked against all `CONFIG` keys.
- Attack path: A client supplies `key`; the route hex-decodes and decrypts it; padding/decode errors are returned directly; valid plaintext can select any config key.
- Impact: Remote oracle over selector ciphertext validity and possible selector forgery. Direct hidden-secret rendering is constrained by current byte/string behavior.
- Evidence: `main.py:140-168`, `main.py:424-435`.
- Recommended remediation: Use authenticated encryption or signed opaque tokens, return a generic invalid-token error, and enforce a viewable-key allowlist after decryption.

### MAINPY-011: Authentication Cookie Is Missing Security Attributes

- Severity: low
- Category: Session cookie hardening
- Confidence: high
- CWE: CWE-614, CWE-1004
- Affected area: `POST /user/login`, `GET /user`
- Code location: `main.py:540-551`, `main.py:510-516`
- Root cause: The JWT bearer cookie is set with value and expiry only; `Secure`, `HttpOnly`, and `SameSite` are omitted.
- Attack path: A user logs in; the browser stores a script-accessible and cross-site-sendable bearer token; `/user` trusts that cookie.
- Impact: Increased token theft and replay risk, especially when combined with XSS or non-localhost deployment.
- Evidence: `main.py:550`, `main.py:513-516`, `main.py:578`.
- Recommended remediation: Set `httponly=True`, `secure=True` when served over HTTPS, and an appropriate `SameSite` value.

## Candidates Requiring Further Validation

- `CAND-MAINPY-001`: Live dependency vulnerability status. `requirements.txt` was reviewed offline; no network advisory lookup was performed.
- `CAND-MAINPY-002`: Exact lxml external resource behavior depends on lxml/libxml2 runtime behavior and deployment policy.
- `CAND-MAINPY-003`: Temp key exposure depends on host ACLs, process user separation, and log exposure.

## Coverage

- Complete for requested target: true
- Reviewed source file: `main.py`
- Supporting context read: `requirements.txt`, `vulnerability_index.md`, and prior `Scan Report-1` through `Scan Report-4` artifacts.
- Assessed categories: authentication and authorization, APIs and interfaces, sensitive data and data access, privileged operations, security controls/trust boundaries, external integrations, dependencies/configuration, and module-specific risks.
- Source code modified: false.
