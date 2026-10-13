# Threat Model Report

## Scope And Method

This threat model reuses `Scan Report-1\ApplicationIntelligence.json` as the primary architecture source. It does not repeat application discovery, run the application, send exploit inputs, perform a security scan, assign final vulnerability severity, or recommend code fixes.

The output describes plausible threat scenarios based on the application's actual components, interfaces, data flows, and security-relevant implementation. Each scenario is a hypothesis grounded in source evidence, not a confirmed runtime exploit finding.

## Application Context

Breakable Flask is a deliberately vulnerable, single-file Flask application for learning and checking exploitation of common web application vulnerability classes. The README states this purpose directly and lists the vulnerability classes intentionally present (`README.md:4-18`). The prior ApplicationIntelligence model confirms the application is built around a single `main.py` file containing Flask route handlers, crypto/JWT helpers, database bootstrap logic, and server startup.

The confirmed normal execution path is direct script execution: `main.py` parses CLI options, chooses and initializes a database, then runs the Flask development server (`main.py:577-661`). The documented default bind is `127.0.0.1:4000` with in-memory SQLite (`README.md:42-44`), but the CLI allows a different address, port, database type, database filename, and database credentials (`main.py:580-589`).

## Assets And Security Objectives

| Asset | Why it matters | Objectives | Evidence |
| --- | --- | --- | --- |
| Application host execution context | Several routes can bridge HTTP input into Python or OS execution behavior. | Preserve process integrity, prevent untrusted code/command execution, preserve availability. | `main.py:171-172`, `main.py:379`, `main.py:397`, `main.py:468` |
| JWT authentication cookies and claims | `/user` uses the JWT `sub` claim to decide whether to display admin state. | Preserve token integrity and trusted identity claims. | `main.py:510-528`, `main.py:540-550` |
| In-memory config and crypto material | CONFIG includes secret-bearing values, AES key material is used for config links, and RSA keys sign/verify tokens. | Preserve confidentiality and integrity of keys/config. | `main.py:24-45`, `main.py:107-124`, `main.py:156-168` |
| Relational database contents | Startup seeds both `public_stuff` and `secret_stuff`; only `public_stuff` is normally queried. | Preserve query integrity and prevent unauthorized reads/writes. | `main.py:49-82`, `main.py:472-490`, `main.py:647-656` |
| Client browser session and rendered content | Cookies store application state, and route responses render request/database-derived HTML. | Preserve cookie integrity and response integrity. | `main.py:332-346`, `main.py:489-500`, `main.py:547-550` |

## Threat Actors And Entry Points

**Unauthenticated HTTP client**

This actor can reach any exposed unauthenticated route and supply form fields, query parameters, and cookies. This actor does not initially control the server process, database, local filesystem, environment variables, or private key material. The actor is plausible because nearly all route handlers are exposed without authentication (`main.py:299-504`), and the app is intended to be run as a web server (`README.md:40-48`).

Relevant entry points:

- `/cookie`
- `/lookup`
- `/evaluate`
- `/xml`
- `/config`
- `/sayhi`
- `/listservices`
- `/user`
- `/user/jwks`
- `/user/login`

**Authenticated guest user**

This actor can authenticate with the documented hard-coded credentials `guest:guest` and receive an authentication cookie. The login route implements this directly (`main.py:543-550`). The actor does not initially have the `admin` subject claim or signing key authority.

Relevant entry points:

- `/user/login`
- `/user`
- `/user/jwks`
- `authentication` cookie

**Application operator or local developer**

This actor can choose runtime configuration: bind address, port, database type, database credentials, database filename, Oracle client library directory, and JWT key file paths (`main.py:107-124`, `main.py:579-589`). Operator behavior is not treated as malicious by default, but configuration choices can change reachability and blast radius.

## Trust Boundaries

| Boundary | Data or authority crossing | Existing controls | Evidence-supported gaps |
| --- | --- | --- | --- |
| HTTP client to Flask route handlers | Form fields, query parameters, cookies | Route-specific logic; JWT check only for `/user` | Many routes are unauthenticated and pass request values directly to sensitive consumers. |
| Flask process to host/Python execution | `address` to `os.popen`; `expression` to `eval` | None visible in these paths | String command construction and direct `eval` use. |
| Flask process to parser/renderer | XML to lxml; name to Jinja | HTML escaping occurs after XML parse output | XML parser has DTD/network enabled; name becomes template source before render. |
| Flask process to database | `category` query parameter to SQL | Base query targets `public_stuff` | Category is string-formatted into SQL. |
| Browser cookies to server trust decisions | `value` cookie to pickle; `authentication` cookie to JWT verification | JWT branch performs claim checks; app-set value cookie is base64-encoded | Pickle data is not authenticated; JWT alg dispatch includes HS256 and None. |
| Startup config to runtime resources | Bind address, database backend, key files | Localhost and in-memory SQLite are defaults | Wider exposure and external DB authority are configurable and deployment-dependent. |

## Threat Scenarios

### T001: Client Cookie Deserialization

An unauthenticated HTTP client can send a controlled `value` cookie to `/cookie`. On non-POST requests, the route checks `request.cookies`, base64-decodes `value`, and passes it to `pickle.loads` (`main.py:328-329`). If a crafted pickle payload triggers behavior during deserialization, execution reaches server-side Python object loading semantics inside the Flask process.

This is plausible because the boundary from browser-controlled cookie to `pickle.loads` is direct. The exact payload behavior is a hypothetical attack condition because this model did not execute exploit inputs. The route is intentionally mapped to pickle deserialization in `vulnerability_index.md:7`.

Potential impact includes server-side code execution, process manipulation, or denial of service in the application process context.

### T002: DNS Lookup Command Execution

An unauthenticated client can POST an `address` to `/lookup`. The handler concatenates the address into `"nslookup " + address`, then passes the resulting string to `rp()` (`main.py:357-360`). `rp()` invokes `os.popen(command).read()` (`main.py:171-172`).

The threat crosses from HTTP form input into the host command context. If the runtime shell honors command syntax supplied in the concatenated address, the actor may influence execution beyond DNS lookup. Exploitability depends on shell behavior, server reachability, and process privileges. The route is intentionally mapped to OS command injection in `vulnerability_index.md:8`.

Potential impact includes host command execution, local resource disclosure/modification, and denial of service.

### T003: Python Expression Evaluation

An unauthenticated client can POST `expression` to `/evaluate`. The handler passes that value directly to `eval(expression)` (`main.py:375-379`). Since the evaluation occurs inside the application process, a successful expression-level attack could interact with imported modules, globals, helper functions, secrets, or process resources depending on the effective eval context.

This scenario is plausible because the direct data flow is source-confirmed. The exact reachable objects and payload behavior were not runtime-tested. The route is intentionally mapped to code injection in `vulnerability_index.md:9`.

Potential impact includes application process compromise, in-memory secret disclosure, database access through process capabilities, or denial of service.

### T004: XML Parser External Resource Access

An unauthenticated client can POST XML to `/xml`. The route creates `etree.XMLParser(no_network=False, dtd_validation=False, load_dtd=True, huge_tree=True)`, then parses the submitted XML (`main.py:395-400`). If lxml/libxml2 resolves attacker-supplied external entity or DTD references in that configuration, parsing can cross from HTTP input into file or network access before the response is rendered.

This scenario is plausible because the parser is explicitly configured with network access allowed and DTD loading enabled. Response escaping with `html.escape` affects HTML rendering of parsed output but occurs after parser-side behavior (`main.py:397-405`). The route is intentionally mapped to XXE in `vulnerability_index.md:10`.

Potential impact includes local file disclosure, server-side network requests, or parser-driven denial of service, depending on runtime parser behavior and host access.

### T005: Config Decryption Oracle

An unauthenticated client can call `/config` with chosen `key` query values. The handler unhexlifies the value, decrypts it using the application AES key, and returns exception text if decryption fails (`main.py:428-433`). The endpoint also exposes encrypted links for viewable `app_*` config keys and marks other config keys as not viewable (`main.py:423-427`).

This creates a plausible oracle-style threat: if padding or decryption error behavior is distinguishable, an actor may reason about ciphertext validity or construct ciphertexts that decrypt to other CONFIG keys. The route is intentionally mapped to padding oracle in `vulnerability_index.md:11`. Runtime exploitability was not measured.

Potential impact includes disclosure of non-viewable CONFIG values or denial of service through malformed ciphertext requests.

### T006: Server-Side Template Execution

An unauthenticated client can POST `name` to `/sayhi`. The route interpolates the supplied name into a template string, then calls `render_template_string(template)` (`main.py:453-468`). If the submitted value contains Jinja template syntax, it becomes part of the server-side template source.

This is plausible because user-controlled data is inserted before rendering, not passed as a template variable. The exact template object reachability was not runtime-tested. The route is intentionally mapped to server-side template injection in `vulnerability_index.md:12`.

Potential impact includes server-side template expression execution, disclosure of process data, escalation to code execution depending on reachable objects, or browser-side active content in the rendered response.

### T007: SQL Query Manipulation

An unauthenticated client can call `/listservices?category=...`. The route builds a WHERE clause by formatting the category into a quoted SQL string, formats that clause into `SELECT * from public_stuff...`, and executes it through a global cursor (`main.py:476-484`).

The threat crosses from HTTP query parameter to database command structure. It is plausible because no parameterized query is used. The precise effect depends on the selected backend, driver behavior, statement handling, and credentials. The seeded `secret_stuff` table is not normally queried by application routes, but it exists in the database model (`main.py:59-81`). The route is intentionally mapped to SQL injection in `vulnerability_index.md:13`.

Potential impact includes unauthorized data reads, possible modification or schema effects depending on database authority, error disclosure, or database denial of service.

### T008: JWT Algorithm Confusion Or None-Algorithm Token Acceptance

A guest user or any client able to set an `authentication` cookie can send a JWT to `/user`. The route reads the cookie and calls `verify_token(token, VERIFY_KEY)` (`main.py:513-516`). `verify_token` reads the unverified header and dispatches based on `alg`; accepted algorithms include `RS256`, `HS256`, and `None` (`main.py:32`, `main.py:267-277`). `/user/jwks` publishes the RSA public key parameters (`main.py:531-536`), and `/user` displays admin state when the token's `sub` claim equals `admin` (`main.py:519-523`).

The plausible attack path is to craft a token that passes one of the non-RS256 branches with `sub` set to `admin`. The None branch accepts an empty signature segment if claims pass checks (`main.py:242-263`). The HS256 branch verifies an HMAC using the provided verify key bytes (`main.py:216-239`). Runtime acceptance depends on exact token construction and claim values.

Potential impact is unauthorized admin identity state in the application. If future admin-only behavior were added, this same trust boundary could become a broader authorization bypass.

### T009: Startup Configuration Expands Reachability Or Authority

The default documented run binds to localhost and uses in-memory SQLite (`README.md:42-44`), but startup options allow changing address, port, database type, database credentials, database filename, and Oracle client library location (`main.py:580-589`). The application also reads RSA key paths from environment variables or writes generated keys to temp files (`main.py:107-124`).

This is not a direct exploit path by itself. It is a deployment-dependent threat relationship: if the app is bound beyond localhost or connected to an external database with meaningful privileges, the impact of the HTTP-originated threats grows. Optional database documentation shows external database setup paths (`docker_database_setup.md:7-101`), and startup code creates or seeds database objects through the selected connection (`main.py:620-656`).

Potential impact includes remote reachability of training routes, database-backed impact beyond in-memory lab data, and key-material handling risks depending on file locations and permissions.

## Threat Relationships

Several threats share assets and boundaries:

- T002 and T003 both target the host execution context through unauthenticated HTTP input, but they use different execution mechanisms: OS command string versus Python eval.
- T003 and T006 both interpret request-controlled text server-side, but through different interpreters: Python and Jinja.
- T004 and T005 both threaten confidentiality through sensitive consumers that act before ordinary response rendering: XML parser behavior and AES-CBC decryption behavior.
- T007 is amplified by T009 because database backend and credentials determine how far SQL manipulation can go.
- T008 and T005 both depend on cryptographic correctness and key/config handling, but target different objectives: token integrity versus config confidentiality.
- T001 and T008 both rely on cookies crossing into server-side trust decisions, but one reaches pickle deserialization and the other reaches JWT verification.
- T002 is amplified by T009 when startup configuration exposes the service beyond localhost or runs the process with broader host authority.

These relationships reduce duplicate scenarios: shared assets are tracked once, while distinct mechanisms and preconditions remain separate threat records.

## Assumptions And Unknowns

- HTTP threats assume the Flask server is reachable by the actor. The confirmed default is localhost; wider exposure is configurable but not confirmed.
- This model treats the app's vulnerable behavior as intentional training design. Risk depends heavily on whether it is isolated in a lab.
- No runtime exploit validation was performed.
- Production topology is unknown. No Dockerfile, WSGI server config, reverse proxy, service manifest, process user, container boundary, or network policy was observed.
- External database permissions are unknown and depend on operator-provided credentials.
- Exact dependency versions are unknown because requirements files specify lower bounds rather than a lockfile.

## Source References

See `SourceReferences.md` in this folder for the supporting line references used by this model.

