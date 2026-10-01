# Standard Security Scan: Breakable Flask

## Scan Metadata

- Scan ID: standard-security-scan-breakableflask-20260922
- Repository: breakableflask-master
- Daybreak access advisory: not_granted
- Source code modified: false
- Scan mode: standard single-pass source-backed audit

## Summary

Confirmed findings: 11. Severity distribution: critical 3, high 4, medium 3, low 1. Findings are source-backed and candidates requiring runtime or external validation are listed separately.

## Confirmed Findings

### BF-001: Unauthenticated expression evaluator executes Python code

- Severity: critical
- Category: Code injection
- Confidence: high
- CWE: CWE-95, CWE-94
- Affected area: GET/POST /evaluate
- Code location: main.py:372-379
- Root cause: The /evaluate route reads request.form["expression"] and passes it directly to eval(expression) inside the response construction without authentication, sandboxing, parsing, or allowlisting.
- Attack path: Unauthenticated client sends POST /evaluate with expression; evaluate() assigns expression from request.form; eval(expression) executes in the Flask process; result is rendered.
- Impact: Arbitrary Python code execution in the Flask process context, including access to application globals, key material, database cursor, filesystem, and network resources available to the process.
- Evidence:
  - main.py:372 defines /evaluate for GET and POST.
  - main.py:375-376 assigns expression = request.form["expression"] on POST.
  - main.py:379 calls str(eval(expression)) when expression is present.
- Recommended remediation: Remove eval. If expression support is required, implement a constrained parser/evaluator for a narrow grammar with explicit allowlists and no access to application globals or builtins.

### BF-002: DNS lookup route concatenates request input into os.popen

- Severity: critical
- Category: OS command injection
- Confidence: high
- CWE: CWE-78
- Affected area: GET/POST /lookup
- Code location: main.py:171-172, main.py:353-361
- Root cause: The /lookup route concatenates request.form["address"] into a shell command string and passes it to os.popen via rp().
- Attack path: Unauthenticated client sends POST /lookup with address; lookup() builds "nslookup " + address; rp() calls popen(command).read(); shell interprets attacker-controlled text.
- Impact: Arbitrary operating-system command execution with the Flask process privileges.
- Evidence:
  - main.py:11 imports popen from os.
  - main.py:171-172 defines rp(command) as popen(command).read().
  - main.py:356-360 reads address from the POST form and calls rp("nslookup " + address).
- Recommended remediation: Use a DNS library or subprocess.run with shell=False and an argument list. Validate the address as a hostname or IP address and encode output before rendering.

### BF-003: Client-controlled cookie is deserialized with pickle

- Severity: critical
- Category: Insecure deserialization
- Confidence: high
- CWE: CWE-502
- Affected area: GET/POST /cookie
- Code location: main.py:320-350
- Root cause: The route base64-decodes the client-held value cookie and passes it directly to pickle.loads without a server-side integrity check.
- Attack path: Client sets value cookie to arbitrary base64 pickle bytes; GET /cookie sees the cookie; pickle.loads executes during deserialization; resulting object is rendered.
- Impact: Arbitrary code execution or process-level side effects during deserialization.
- Evidence:
  - main.py:328-329 reads request.cookies["value"] and calls pickle.loads(b64decode(...)).
  - main.py:345-346 creates cookies with base64(pickle.dumps(value)), with no signature or MAC.
- Recommended remediation: Do not use pickle for client-controlled state. Use signed Flask sessions, JSON with authenticated signing, or server-side state keyed by opaque identifiers.

### BF-004: Greeting route renders user input as Jinja template source

- Severity: high
- Category: Server-side template injection
- Confidence: high
- CWE: CWE-1336
- Affected area: GET/POST /sayhi
- Code location: main.py:450-468
- Root cause: The route formats request.form["name"] into a template string before calling render_template_string, making user input part of the template source.
- Attack path: Unauthenticated client posts name; sayhi() interpolates name into a larger template string; render_template_string parses attacker-controlled template syntax.
- Impact: Server-side template expression execution in the Flask/Jinja context, potentially exposing application state and enabling code execution depending on runtime object reachability.
- Evidence:
  - main.py:453-454 places request.form["name"] into an HTML fragment.
  - main.py:456-467 inserts that fragment into a template string.
  - main.py:468 calls render_template_string(template).
- Recommended remediation: Render a fixed template and pass name as a variable so Jinja treats it as data with autoescaping, not as template source.

### BF-005: Product category filter is interpolated into SQL

- Severity: high
- Category: SQL injection
- Confidence: high
- CWE: CWE-89
- Affected area: GET /listservices
- Code location: main.py:49-82, main.py:472-505, main.py:647-656
- Root cause: The category query parameter is formatted into a WHERE clause and executed by cursor.execute as SQL text.
- Attack path: Unauthenticated client requests /listservices?category=...; route formats category into WHERE category = '...'; query_build wraps the SQL; cursor.execute sends it to the active DB.
- Impact: Unauthorized database reads or query manipulation, including potential access to seeded secret_stuff rows depending on backend behavior and DB privileges.
- Evidence:
  - main.py:476 reads category = request.args.get(param).
  - main.py:480-481 formats category into the WHERE clause.
  - main.py:484 executes SELECT * from public_stuff plus the formatted clause.
  - main.py:60-65 defines secret_stuff and main.py:77-80 seeds secret rows.
- Recommended remediation: Use parameterized queries for category values with the active database driver. Keep SQL text static and return generic database errors.

### BF-006: JWT verification trusts attacker-selected algorithms including None and HS256

- Severity: medium
- Category: Authentication bypass
- Confidence: high
- CWE: CWE-347, CWE-287
- Affected area: GET /user, GET /user/jwks, GET/POST /user/login
- Code location: main.py:29-36, main.py:216-279, main.py:510-537, main.py:540-573
- Root cause: verify_token reads the unverified JWT header and dispatches to RS256, HS256, or None verification while /user trusts the returned sub claim for admin state.
- Attack path: Client supplies authentication cookie; verify_token uses jwt.get_unverified_header(token); alg None accepts empty signature or HS256 reuses VERIFY_KEY as HMAC key; /user grants admin response when sub equals admin.
- Impact: Unauthorized transition to the application admin response state. The repository does not contain additional admin-only operations beyond that response, limiting demonstrated impact.
- Evidence:
  - main.py:32 allows RS256, HS256, and None.
  - main.py:242-263 accepts alg None with an empty signature after claim checks.
  - main.py:267-279 dispatches based on jwt.get_unverified_header(token).
  - main.py:216-239 verifies HS256 with the key parameter and main.py:274-275 passes VERIFY_KEY.
  - main.py:531-537 exposes RSA public key material through /user/jwks.
  - main.py:516-522 grants admin when claims sub equals ADMIN_USER.
- Recommended remediation: Pin verification to a server-selected algorithm such as RS256. Remove None and HS256 from this RSA token flow, and do not make authorization decisions solely from a client-held subject string.

### BF-007: XML route parses untrusted XML with DTD and network-capable settings

- Severity: high
- Category: XML external entity processing
- Confidence: medium
- CWE: CWE-611
- Affected area: GET/POST /xml
- Code location: main.py:392-411
- Root cause: The XML parser is created with no_network=False, load_dtd=True, and huge_tree=True before parsing attacker-controlled XML.
- Attack path: Unauthenticated client posts XML; xml() creates permissive lxml parser; etree.fromstring parses attacker-controlled bytes; parser may load external DTDs/resources and process oversized trees depending on lxml/libxml2 behavior.
- Impact: Potential local file disclosure, SSRF/external resource access, and resource exhaustion depending on runtime parser behavior and deployment access.
- Evidence:
  - main.py:396 reads XML from request.form["xml"].
  - main.py:397 creates etree.XMLParser(no_network=False, dtd_validation=False, load_dtd=True, huge_tree=True).
  - main.py:399 parses xml.encode() with etree.fromstring(..., parser).
  - requirements.txt:5 requires lxml.
- Recommended remediation: Use defusedxml or configure lxml with no_network=True, load_dtd=False, resolve_entities=False, and huge_tree=False for untrusted XML. Enforce request size limits.

### BF-008: Config selector exposes AES-CBC padding/decryption oracle

- Severity: low
- Category: Cryptographic oracle
- Confidence: medium
- CWE: CWE-203, CWE-327
- Affected area: GET /config
- Code location: main.py:24-45, main.py:140-168, main.py:417-446
- Root cause: The route decrypts attacker-supplied AES-CBC ciphertext and returns exception text from unpad/decode failures, while successful plaintext is checked against all CONFIG keys.
- Attack path: Client supplies key query parameter; route hex-decodes and decrypts it using process KEY; unpad raises distinguishable errors; route returns str(e); valid plaintext can select CONFIG keys.
- Impact: Remote oracle over selector ciphertext validity and risk of selector forgery. Direct hidden-secret rendering is constrained by current byte/string behavior for hidden CONFIG values.
- Evidence:
  - main.py:140-148 raises Bad padding from unpad.
  - main.py:163-168 decrypts AES-CBC and calls unpad.
  - main.py:422 reads key from query string.
  - main.py:430-433 decrypts attacker-controlled ciphertext and returns str(e) on errors.
  - main.py:435 checks decrypted_key against all CONFIG keys, not only viewable keys.
- Recommended remediation: Use authenticated encryption or signed tokens for selectors, return one generic error for invalid tokens, and restrict decrypted selectors to the same viewable allowlist.

### BF-009: User-controlled values are reflected into HTML without escaping

- Severity: medium
- Category: Cross-site scripting
- Confidence: high
- CWE: CWE-79
- Affected area: GET/POST /cookie and GET /user
- Code location: main.py:325-334, main.py:519-526
- Root cause: Route handlers concatenate user-controlled values and exception strings into HTML responses instead of rendering them as escaped template variables.
- Attack path: Attacker submits value to /cookie or supplies token/claims/error text through /user; route concatenates raw value into HTML; victim browser executes injected markup/script.
- Impact: JavaScript execution in the application origin, enabling page tampering and possible bearer-cookie theft where cookies are script-accessible.
- Evidence:
  - main.py:326 assigns cookieValue = request.form["value"].
  - main.py:334 concatenates str(cookieValue) into the response body.
  - main.py:519-523 interpolates claims sub into HTML.
  - main.py:525-526 concatenates token exception text into HTML.
- Recommended remediation: Escape all response data derived from users or render fixed templates with autoescaped variables. Avoid reflecting raw exception messages.

### BF-010: Generated JWT private key is written to predictable temporary path

- Severity: medium
- Category: Sensitive key storage
- Confidence: medium
- CWE: CWE-522
- Affected area: Startup key initialization
- Code location: main.py:107-123
- Root cause: When key file environment variables are absent, startup writes generated private.pem and public.pem to tempfile.gettempdir() with predictable names and prints the paths.
- Attack path: Same-host attacker or process reads temp private.pem or observes logs; attacker signs RS256 token with admin subject; /user accepts valid RS256 token.
- Impact: Local key disclosure can lead to JWT forgery for the running application. Exploitability depends on host filesystem permissions and log exposure.
- Evidence:
  - main.py:107-109 uses configured key files only if both env vars are set.
  - main.py:111-114 builds predictable temp paths private.pem and public.pem.
  - main.py:116-121 generates keys and writes the private key to disk.
  - main.py:122-124 prints private and public key paths.
  - main.py:179-190 uses the private key to sign JWTs.
- Recommended remediation: Require explicit key management for non-development use. If local generation remains, avoid writing private keys to shared temp paths; use a private directory with restrictive permissions and do not print sensitive paths.

### BF-011: Authentication cookie is set without Secure, HttpOnly, or SameSite

- Severity: low
- Category: Session cookie hardening
- Confidence: high
- CWE: CWE-614, CWE-1004
- Affected area: POST /user/login and GET /user
- Code location: main.py:540-551, main.py:510-516
- Root cause: The login route sets the bearer JWT cookie with only a value and expiry; it omits Secure, HttpOnly, and SameSite attributes.
- Attack path: Victim authenticates; browser stores script-accessible/cross-site-sendable cookie; network, same-origin script, or cross-site context may expose or abuse the bearer token depending on deployment.
- Impact: Increases likelihood and impact of token theft/replay, especially when combined with XSS or non-localhost deployment.
- Evidence:
  - main.py:550 calls resp.set_cookie(AUTH_COOKIE, token, expires=exp).
  - main.py:513-516 reads that cookie as the bearer authentication token.
  - main.py:581 allows listen address to be configured beyond default localhost.
- Recommended remediation: Set httponly=True, secure=True when served over HTTPS, and an appropriate SameSite value. Keep localhost-only demo behavior separated from deployable configuration.

## Candidates Requiring Further Validation
- CAND-001: Live dependency CVE status - No network advisory lookup was performed; dependency files were reviewed offline only.
- CAND-002: Exact lxml external entity behavior on deployed runtime - Source establishes unsafe parser options, but file/network reachability and entity expansion behavior depend on lxml/libxml2 runtime and deployment policy.
- CAND-003: Generated temp key file read permissions on target host - Source writes predictable temp files, but local exploitability depends on OS account and temp directory permissions.

## Coverage

- Complete: True
- Reviewed files: main.py, README.md, requirements.txt, database-requirements.txt, docker_database_setup.md, vulnerability_index.md, COPYRIGHT.txt, .gitignore
- Assessed surfaces: /cookie, /lookup, /evaluate, /xml, /config, /sayhi, /listservices, /user, /user/jwks, /user/login, startup/database bootstrap, dependency/configuration files
- Excluded as source: Scan Report-* generated report folders

## Supporting Artifacts

- assessment.json
- assessment.sarif
- coverage.json
- scan-manifest.json
- supporting_artifacts/evidence_index.md

## Completion Check

- Repository intelligence, threat model, and pre-scan baseline were used as context.
- Security surfaces listed in the request were assessed.
- Investigation followed source/data flow beyond pattern matching.
- Confirmed findings are separated from candidates requiring further validation.
- JSON, SARIF, Markdown, coverage, manifest, and supporting artifacts were produced.
- Source code was not modified.
