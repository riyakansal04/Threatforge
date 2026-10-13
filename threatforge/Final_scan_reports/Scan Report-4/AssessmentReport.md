# Standard Security Scan Report

## Summary

Target: `C:\Users\riyakansal\OneDrive - Nagarro\Desktop\Codebase`

Scan type: Standard Security Scan

Managed scan id: `273eb7b9-0470-443d-8f09-1c9bd5cf012f`

Inputs reused:

- `Scan Report-1\ApplicationIntelligence.json`
- `Scan Report-2\ThreatModel.json`
- `Scan Report-2\ThreatRecords.json`
- `Scan Report-3\ScanPlan.json`
- `Scan Report-3\ScanFocus.json`

This scan was a static, read-only assessment of the authorized scope. It did not modify source code and did not execute exploit payloads or destructive tests.

## Findings

| ID | Severity | Confidence | Title | Related threats |
| --- | --- | --- | --- | --- |
| BF-STD-001 | High | High | Client-controlled cookie is deserialized with pickle | T001 |
| BF-STD-002 | High | High | DNS lookup route concatenates form input into an OS command | T002 |
| BF-STD-003 | High | High | Expression evaluation route executes user input with eval | T003 |
| BF-STD-004 | Medium | High | XML parser enables DTD loading and network access for user-supplied XML | T004 |
| BF-STD-005 | Medium | High | Config endpoint decrypts attacker-controlled ciphertext and returns padding errors | T005 |
| BF-STD-006 | High | High | Greeting route renders user input as Jinja template source | T006 |
| BF-STD-007 | High | High | Category query parameter is concatenated into SQL | T007, T009 |
| BF-STD-008 | High | High | JWT verifier accepts None and HS256 algorithms based on untrusted token header | T008 |

### BF-STD-001: Client-Controlled Cookie Is Deserialized With Pickle

The `/cookie` route reads the browser-controlled `value` cookie and passes it through `b64decode` into `pickle.loads` (`main.py:328-329`). The same route writes cookie values with `pickle.dumps` (`main.py:345-346`), but there is no authenticity check on values returned by the client.

This is a confirmed static vulnerability because a request-controlled cookie crosses directly into Python pickle deserialization. The scan did not execute a crafted pickle payload, so runtime payload behavior remains untested.

Impact: unsafe pickle deserialization can lead to server-side code execution or denial of service in the Flask process.

### BF-STD-002: DNS Lookup Route Concatenates Form Input Into An OS Command

The `/lookup` route reads `request.form['address']`, concatenates it into `"nslookup " + address`, and passes the string to `rp()` (`main.py:356-360`). The helper calls `popen(command).read()` (`main.py:171-172`).

This is a confirmed static command-injection path. Exploitability depends on runtime shell behavior and process privileges, but the source path from HTTP input to command execution is direct.

Impact: an attacker may execute host commands with the Flask process authority.

### BF-STD-003: Expression Evaluation Route Executes User Input With Eval

The `/evaluate` route reads `request.form['expression']` and calls `eval(expression)` (`main.py:375-379`).

This is a confirmed static code-injection path. No sandbox, restricted globals, or expression allowlist is visible.

Impact: attacker-controlled Python expression execution can compromise the process, access in-memory secrets, or disrupt service.

### BF-STD-004: XML Parser Enables DTD Loading And Network Access

The `/xml` route parses user-supplied XML using `etree.XMLParser(no_network=False, dtd_validation=False, load_dtd=True, huge_tree=True)` and `etree.fromstring` (`main.py:395-400`).

This is a confirmed unsafe XML parser configuration for untrusted XML. Runtime entity behavior depends on lxml/libxml2 version and environment, so the exact file/network impact requires dynamic validation.

Impact: potential local file disclosure, server-side network interaction, or parser resource exhaustion.

### BF-STD-005: Config Endpoint Decrypts Chosen Ciphertext And Returns Padding Errors

The `/config` route accepts a `key` query parameter, unhexlifies it, decrypts it with AES-CBC, and returns exception text on failure (`main.py:428-433`). The decrypt path calls `unpad`, which raises `Bad padding` exceptions on padding errors (`main.py:140-168`).

This is a confirmed oracle-style cryptographic weakness. The scan did not measure response differences over multiple ciphertexts, but the source confirms chosen ciphertext decryption and error disclosure.

Impact: attackers may be able to recover or forge encrypted config-key values and expose non-viewable config entries.

### BF-STD-006: Greeting Route Renders User Input As Jinja Template Source

The `/sayhi` route interpolates `request.form['name']` into a string that is later passed to `render_template_string` (`main.py:453-468`).

This is confirmed server-side template injection by static dataflow: user input becomes Jinja template source rather than a template variable.

Impact: template expression execution can disclose server-side data and may lead to code execution depending on reachable objects.

### BF-STD-007: Category Query Parameter Is Concatenated Into SQL

The `/listservices` route reads `category`, formats it into a quoted `WHERE` clause, then passes the constructed SQL to `cursor.execute` (`main.py:476-484`). The application also seeds both `public_stuff` and `secret_stuff` tables during startup (`main.py:49-82`, `main.py:647-656`).

This is confirmed SQL injection by static source review. Exact impact depends on selected database backend, driver statement handling, and database credentials.

Impact: unauthorized data reads, query manipulation, error disclosure, and possibly database modification depending on backend privileges.

### BF-STD-008: JWT Verifier Accepts None And HS256 Algorithms

The JWT verifier allows `RS256`, `HS256`, and `None` (`main.py:32`). `verify_token` dispatches verification logic based on the unverified token header (`main.py:267-277`). The None branch accepts an empty signature segment and returns claims after basic claim checks (`main.py:242-263`). The `/user` route trusts the `sub` claim to display admin state (`main.py:515-523`), and `/user/jwks` publishes RSA public key parameters (`main.py:531-536`).

This is a confirmed authentication design weakness. The scan did not submit forged tokens, but the source establishes the unsafe accepted algorithms and trust decision.

Impact: attackers may forge an admin subject claim if they can construct claims satisfying issuer, audience, and time checks.

## Suspected Issues

No separate suspected issues were recorded. All reportable issues above have direct source evidence. Runtime validation is still recommended for exploit confirmation and environment-specific impact.

## Limitations

- No runtime payloads were executed.
- No external database backend was selected or tested.
- Dependency advisories were not checked against exact installed versions because no lockfile or runtime inventory is present.
- Production exposure, process user, network egress, and filesystem permission boundaries remain unknown.

## Deduplication Notes

No prior canonical findings were found in `Scan Report-1` through `Scan Report-3`. Threat records from `Scan Report-2` were treated as planning hypotheses and linked to findings; they were not treated as prior findings.

