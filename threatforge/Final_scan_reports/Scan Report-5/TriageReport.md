# Finding Triage Report

## Scope And Inputs

This triage reviewed the eight findings from `Scan Report-4/findings.json` and preserved their original identifiers. The assessment reused the existing architecture, threat model, scan plan, scan focus, SARIF, and scan report artifacts from `Scan Report-1` through `Scan Report-4`.

No source code or configuration was modified. No exploit payloads, runtime requests, dependency advisory lookups, or dynamic validation were performed. The conclusions below are static technical assessments of the evidence already produced by the completed Standard Security Scan.

## Technical Summary

| Finding | Verdict | Rank | Duplicate | Key conclusion |
|---|---:|---:|---|---|
| BF-STD-003 | confirmed | 1 | none | `/evaluate` sends form input directly to `eval`. |
| BF-STD-002 | confirmed | 2 | none | `/lookup` concatenates form input into an `os.popen` command. |
| BF-STD-001 | confirmed | 3 | none | `/cookie` deserializes a browser-controlled cookie with `pickle.loads`. |
| BF-STD-006 | confirmed | 4 | none | `/sayhi` renders request input as Jinja template source. |
| BF-STD-008 | confirmed | 5 | none | JWT verification accepts `None` and `HS256` based on an untrusted header. |
| BF-STD-007 | confirmed | 6 | none | `/listservices` formats a query parameter into SQL. |
| BF-STD-004 | confirmed | 7 | none | `/xml` parses untrusted XML with DTD loading and network access enabled. |
| BF-STD-005 | confirmed | 8 | none | `/config` exposes chosen-ciphertext CBC decrypt behavior and padding errors. |

All eight findings are evidence-supported. None are duplicates. Several are related because they share trust boundaries, assets, or attack-path themes, but their root causes and sinks are distinct.

## Per-Finding Assessment

### BF-STD-003: Python eval expression injection

Evidence supports the claim. `main.py` reads `request.form['expression']` and passes it to `eval(expression)` in the `/evaluate` response path. The code evidence establishes a direct HTTP form input to Python interpreter sink. No authentication, parser allowlist, sandbox, or restricted globals are visible in the reviewed source.

The root cause is execution of request-controlled expression text as Python code. The finding is related to BF-STD-002 and BF-STD-006 through a shared unauthenticated execution/interpreter boundary, but it is not a duplicate because the sink is Python `eval`.

Uncertainty: runtime object reachability and exact payload behavior were not tested.

### BF-STD-002: OS command injection in lookup

Evidence supports the claim. The helper `rp(command)` calls `os.popen(command).read()`, and `/lookup` builds that command with `"nslookup " + address` using `request.form['address']`. This establishes a direct request input to shell-command execution path.

The root cause is command-string construction from untrusted input. It is related to BF-STD-003 and BF-STD-006 because all three can affect process or host execution authority, but the sink and attack mechanics differ.

Uncertainty: shell-specific metacharacter handling was not validated dynamically.

### BF-STD-001: Pickle deserialization from client cookie

Evidence supports the claim. `/cookie` decodes `request.cookies['value']` and passes it to `pickle.loads`. The same workflow writes the cookie with `pickle.dumps`, but the returned client value is not signed or authenticated.

The root cause is using Python pickle as a client-side serialization format and trusting browser-controlled bytes on return. It is related to BF-STD-008 because both trust browser cookies, but the sink is deserialization rather than JWT verification.

Uncertainty: no malicious pickle payload was executed.

### BF-STD-006: Jinja template injection

Evidence supports the claim. `/sayhi` interpolates `request.form['name']` into a string, then interpolates that value into template source passed to `render_template_string`. The data is not passed as a bound template variable.

The root cause is building executable template source from request input. The finding is related to BF-STD-003 because both involve server-side interpretation of request-controlled text, but Jinja evaluation and Python `eval` are distinct mechanisms.

Uncertainty: Jinja object reachability and runtime exploit impact were not tested.

### BF-STD-008: JWT None/HS256 algorithm confusion

Evidence supports the claim. `ALLOWED_ALGORITHMS` includes `RS256`, `HS256`, and `None`; `verify_token` dispatches verification behavior from `jwt.get_unverified_header(token)`; the `None` branch accepts an empty signature and returns claims when checks pass; `/user` trusts the resulting `sub` claim for admin display state; and `/user/jwks` exposes public key material.

The root cause is token-verification behavior selected by an untrusted JWT header while insecure algorithms remain enabled. Issuer, audience, and time checks are present, but in the unsigned path those claim values can be attacker controlled, so they do not contradict the finding.

Uncertainty: no crafted token was submitted to confirm runtime acceptance.

### BF-STD-007: SQL injection in listservices

Evidence supports the claim. `/listservices` reads `category` from the query string and formats it into a SQL `WHERE` clause before passing the built query to `cursor.execute`. No parameter binding is visible.

The root cause is dynamic SQL construction from untrusted input. Its concrete impact depends on database backend, driver behavior, and configured database privileges, which is why the scan plan separated backend validation into `SF-05`.

Uncertainty: no SQL payload was executed against SQLite or any optional external database backend.

### BF-STD-004: XXE-enabled XML parser

Evidence supports the unsafe parser configuration. `/xml` parses request-controlled XML with `etree.XMLParser(no_network=False, load_dtd=True, huge_tree=True)` and then calls `etree.fromstring`. Output escaping occurs after parsing and does not control parser-side file or network access.

The root cause is parsing untrusted XML with DTD loading and network access enabled. It is related to BF-STD-005 because both may affect confidentiality of server-side resources, but the mechanisms differ.

Uncertainty: installed `lxml`/`libxml2` behavior and local file/network reachability were not tested.

### BF-STD-005: CBC padding-oracle pattern

Evidence supports the oracle pattern. The `/config` route accepts a `key` query parameter, unhexlifies it, decrypts it with AES-CBC, and returns raw exception text. The decrypt/unpad path raises `Bad padding` for padding failures.

The root cause is unauthenticated chosen-ciphertext decryption with observable error details and no authentication check before decrypting. It is related to BF-STD-004 through confidentiality impact and BF-STD-008 through cryptographic security objectives.

Uncertainty: iterative ciphertext testing was not performed, so practical plaintext recovery or forgery remains unvalidated.

## Duplicate And Relationship Analysis

No true duplicates were identified. The deduplication decision used root cause, route, input source, sink, and attack condition.

Related findings:

- BF-STD-002, BF-STD-003, and BF-STD-006 share process or host execution objectives but use distinct sinks.
- BF-STD-001 and BF-STD-008 share the browser-controlled cookie trust boundary but protect different assets and use different parsers.
- BF-STD-004 and BF-STD-005 share confidentiality objectives for server-side resources or secrets.
- BF-STD-005 and BF-STD-008 both involve cryptographic correctness, but one is a decryption oracle and the other is token verification failure.
- BF-STD-007 is connected to the deployment-dependent database authority captured in threat `T009`; it has no duplicate finding.

## False-Positive Reasoning

No finding had evidence that contradicted the vulnerability claim. Missing runtime validation was not treated as proof that a finding is false. Controls that might appear mitigating were evaluated narrowly:

- Base64 encoding of pickle data does not provide integrity.
- HTML escaping after XML parsing does not prevent parser-side XXE effects.
- JWT issuer, audience, and time checks do not compensate for accepting unsigned attacker-controlled claims.
- Public table selection in the SQL query does not remove SQL injection caused by unbound input.
- Normal `/config` page links do not prevent arbitrary `key` query values.

## Limitations And Unresolved Questions

- Runtime exploitability was not validated for any finding.
- Dependency versions and advisory exposure were not resolved from a lockfile or installed package inventory.
- Exact database impact depends on the selected backend and privileges.
- Exact XML behavior depends on installed `lxml`/`libxml2` behavior and environment access.
- The codex-security triage contract reference file was unavailable in the installed plugin, so the structured output uses a compatible canonical Finding extension.

