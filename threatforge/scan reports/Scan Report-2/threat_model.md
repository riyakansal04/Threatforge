# Architecture-Level Threat Modeling Assessment: Breakable Flask

## Scope

This assessment builds on `Scan Report-1` and the implementation in `main.py`. It focuses on architecture-level threats supported by actual routes, helper functions, data stores and runtime relationships. It does not repeat the full repository inventory except where needed to explain a security boundary. It does not generate remediation.

No `SECURITY.md` policy was found in the repository. Source review was read-only and no application runtime execution was performed.

## High-Value Assets And Sensitive Data

| Asset | Why It Matters | Evidence |
|---|---|---|
| Python process authority | The Flask process owns application memory, route handlers, database cursor, crypto/JWT keys and any OS/file/network permissions granted to the process. | `main.py:296`, `main.py:510-573`, `main.py:622-661` |
| OS command/process boundary | `/lookup` crosses from HTTP input into `os.popen`, granting access to an operating-system command execution surface. | `main.py:11`, `main.py:171-172`, `main.py:353-367` |
| JWT signing and verification keys | `SIGN_KEY` issues authentication tokens; `VERIFY_KEY` is used to validate them and is exported through `/user/jwks`. | `main.py:107-123`, `main.py:179-190`, `main.py:267-279`, `main.py:531-537` |
| Authentication cookie and admin authorization state | The `authentication` cookie controls `/user`; the `sub` claim controls whether the response enters admin state. | `main.py:29-36`, `main.py:513-528`, `main.py:547-550` |
| `CONFIG` hidden entries | `CONFIG` stores base64-encoded `KEY` and `ADMIN_SECRET` under names not normally listed as viewable. | `main.py:24-45`, `main.py:424-443` |
| Relational database contents | `public_stuff` is routed to users; `secret_stuff` is seeded but not directly exposed by normal route behavior. | `main.py:49-82`, `main.py:472-505`, `main.py:647-656` |
| External database credentials and connections | CLI arguments can provide database user, password, host and port; the process connects and may create `breakdb`. | `main.py:581-586`, `main.py:622-642`, `README.md:46-48` |
| Local filesystem and network-reachable resources | XML parsing, OS command execution and Python/template execution may reach resources available to the process. | `main.py:171-172`, `main.py:397-400`, `main.py:468` |

## Critical Business Functions And Privileged Operations

- JWT login and admin-state decision: `/user/login` issues a token for `guest`; `/user` verifies the cookie token and treats `sub == admin` as admin success. Evidence: `main.py:540-573`, `main.py:510-528`.
- Database bootstrap and query execution: startup connects to SQLite or external DBs, creates tables and seeds data; `/listservices` executes queries through the global cursor. Evidence: `main.py:622-656`, `main.py:472-505`.
- Configuration selector encryption/decryption: `/config` encrypts viewable config key names and decrypts user-supplied selectors. Evidence: `main.py:417-446`.
- Process and parser execution surfaces: `/lookup`, `/evaluate`, `/xml`, `/sayhi` and `/cookie` transfer HTTP-controlled data into OS commands, Python evaluation, XML parsing, template rendering and deserialization. Evidence: `main.py:320-411`, `main.py:450-468`.

## Security-Sensitive Entry Points

| Entry point | Trust boundary | Sensitive consumer |
|---|---|---|
| `GET/POST /cookie` | Client cookie/form data to Python deserialization and response rendering | `pickle.loads`, `pickle.dumps`, `set_cookie` |
| `GET/POST /lookup` | Client form field to OS command string | `os.popen` via `rp()` |
| `GET/POST /evaluate` | Client form field to Python interpreter evaluation | `eval` |
| `GET/POST /xml` | Client form field to XML parser with DTD/network options | `lxml.etree.XMLParser`, `etree.fromstring` |
| `GET /config` | Client query parameter to AES decrypt/unpad and config lookup | `decrypt`, `CONFIG` |
| `GET/POST /sayhi` | Client form field to server-side template engine | `render_template_string` |
| `GET /listservices` | Client query parameter to SQL query string and DB cursor | `cursor.execute` |
| `GET /user`, `GET /user/jwks`, `GET/POST /user/login` | Client cookie/form/token data to authentication and authorization logic | JWT creation/verification, admin check |

## Trust Relationships And Boundaries

- External unauthenticated HTTP clients are trusted to supply route parameters, form bodies and cookies, but route handlers transfer those values into privileged local consumers.
- The Flask process is trusted by the database: startup creates schema and seed data, and route code reuses a global cursor. Evidence: `main.py:647-656`, `main.py:484`.
- The authentication boundary is a client-held JWT cookie. The server trusts claims after `verify_token` dispatches by the token header algorithm. Evidence: `main.py:513-528`, `main.py:267-279`.
- The key-management boundary is split between environment-provided key files and generated temp files. Evidence: `main.py:107-123`.
- External database trust is conditional on deployment. For non-SQLite databases, credentials and host/port are passed as CLI options and the server connection may create `breakdb`. Evidence: `main.py:581-586`, `main.py:622-633`.

## Threat Actors And Capabilities

- Unauthenticated remote or local web user: can send HTTP GET/POST requests, choose query parameters/form values, and set cookies in their own browser/client. They do not initially control the Flask process, filesystem, database server or signing key.
- Authenticated `guest`: can obtain a normal JWT through `/user/login` using the documented `guest:guest` flow and can read `/user/jwks`. Evidence: `main.py:543-550`, `main.py:558-573`, `main.py:531-537`.
- Network-positioned caller to the configured listen address: relevant if the app is started with a non-loopback `--address`; default is loopback. Evidence: `main.py:578`, `README.md:42`.
- Operator/deployer: can choose database backend, key files, address and port. This actor already has configuration authority and is not treated as an external attacker.

## Per-Threat Traces

The following scenarios are source-backed threat hypotheses for architecture-level modeling. They are not presented as validated findings, exploit instructions, or remediation guidance.

### T1: Python Evaluation Grants Process-Level Authority

| Field | Trace |
|---|---|
| Threat scenario | An unauthenticated client submits expression content that is evaluated by the server-side Python interpreter, crossing from HTTP input into process-level execution context. |
| Threat actor | Unauthenticated web client able to reach `/evaluate`. |
| Entry point | `GET/POST /evaluate`. |
| Affected component | `evaluate()` route and Python interpreter. |
| Affected asset | Flask process authority, in-memory secrets, database cursor, filesystem/network permissions available to the process. |
| Trust boundaries crossed | External HTTP client to Flask route; Flask route to Python interpreter execution context. |
| Attack path | Client sends POST form field `expression`; route assigns `request.form['expression']`; route calls `eval(expression)`; result is stringified and rendered. |
| Preconditions | Attacker can send POST requests to the app; `/evaluate` route is reachable; expression evaluation has access to Python globals/imported modules according to runtime semantics. |
| Potential impact | Process-level code execution or inspection of in-memory state and accessible resources, depending on runtime permissions. |
| Existing controls | Route requires POST for expression submission; otherwise no route-level auth is checked. Python exceptions are not explicitly handled in the route. |
| Security gaps | No authentication boundary before the sensitive consumer; no separation between user input and interpreter evaluation; interpreter context shares process authority with keys, config and DB cursor. |
| Supporting source evidence | `main.py:372-386`, imports/globals at `main.py:2-21`, app/global setup at `main.py:24-82`, DB cursor setup at `main.py:647-656`. |
| Assumptions or unknowns | Actual exposed network scope depends on `--address`; process OS permissions are deployment-specific. |

### T2: DNS Lookup Crosses Into OS Command Execution

| Field | Trace |
|---|---|
| Threat scenario | An unauthenticated client controls part of a command string executed through the operating system command interface. |
| Threat actor | Unauthenticated web client able to reach `/lookup`. |
| Entry point | `GET/POST /lookup`. |
| Affected component | `lookup()` route and `rp()` helper. |
| Affected asset | OS process boundary, Flask process host environment, filesystem/network resources available to the process. |
| Trust boundaries crossed | External HTTP client to Flask route; Flask route to OS command/process boundary. |
| Attack path | Client submits POST form field `address`; route builds `"nslookup " + address`; route calls `rp()`; `rp()` executes `popen(command).read()`; output is rendered. |
| Preconditions | Attacker can send POST requests; app host has a shell/command environment compatible with `popen`; target command execution inherits process permissions. |
| Potential impact | Execution of unintended OS-level commands or access to host resources reachable by the app process, depending on shell behavior and deployment permissions. |
| Existing controls | None observed beyond requiring the route interaction and the command prefix `nslookup `. |
| Security gaps | HTTP input is concatenated into a shell command; no authentication or argument boundary is implemented before `popen`. |
| Supporting source evidence | `main.py:11`, `main.py:171-172`, `main.py:353-367`. |
| Assumptions or unknowns | Shell parsing behavior and available commands depend on OS and deployment; README default binds to loopback unless configured otherwise. |

### T3: Cookie Deserialization Transfers Client Cookie State Into Python Object Loading

| Field | Trace |
|---|---|
| Threat scenario | A client-controlled cookie is decoded and passed to Python deserialization during a GET request. |
| Threat actor | Web client able to set its own `value` cookie and request `/cookie`. |
| Entry point | `GET/POST /cookie`. |
| Affected component | `cookie()` route and Python pickle deserializer. |
| Affected asset | Python process authority and application memory; response integrity for cookie display. |
| Trust boundaries crossed | Client-controlled cookie store to Flask request; request cookie bytes to Python deserialization. |
| Attack path | Client sends cookie named `value`; route base64-decodes `request.cookies['value']`; route calls `pickle.loads(...)`; resulting object is converted to string and rendered. |
| Preconditions | Attacker can control the `value` cookie in their request; route receives a GET request with the cookie present; pickle payload is syntactically accepted by the runtime. |
| Potential impact | Process-level effects during deserialization or unexpected object creation, depending on payload and runtime environment. |
| Existing controls | POST-created cookie values are generated with `pickle.dumps` and base64; no server-side signing or verification of cookie provenance is present. |
| Security gaps | The route trusts client-held cookie contents as valid serialized Python data; no authentication, integrity check or safe serialization boundary is established. |
| Supporting source evidence | `main.py:320-350`, especially `main.py:328-346`; `pickle` import at `main.py:8`. |
| Assumptions or unknowns | Browser constraints do not prevent a custom HTTP client from setting the cookie; runtime impact depends on available Python modules and process permissions. |

### T4: Server-Side Template Rendering Crosses From Form Input Into Jinja Evaluation

| Field | Trace |
|---|---|
| Threat scenario | A client-controlled name is interpolated into a template string before Jinja rendering, letting untrusted text enter the template evaluation boundary. |
| Threat actor | Unauthenticated web client able to submit `/sayhi`. |
| Entry point | `GET/POST /sayhi`. |
| Affected component | `sayhi()` route and Flask/Jinja `render_template_string`. |
| Affected asset | Template execution context, Flask process state and any reachable runtime objects. |
| Trust boundaries crossed | External HTTP form input to Flask route; constructed server-side string to Jinja template engine. |
| Attack path | Client submits `name`; route formats it into `name = '<br>Hello %s!...'`; route formats `name` into `template`; route calls `render_template_string(template)`. |
| Preconditions | Attacker can submit POST requests; Jinja evaluates template syntax present in the constructed template. |
| Potential impact | Server-side template expression evaluation and access to template/runtime context, with impact depending on available objects and sandboxing behavior. |
| Existing controls | None observed before template rendering; route is unauthenticated. |
| Security gaps | User input becomes part of the template source instead of data passed to a fixed template; no explicit escaping or sandbox boundary is established before rendering. |
| Supporting source evidence | `main.py:450-468`, Flask import at `main.py:21`. |
| Assumptions or unknowns | Exact accessible template globals depend on Flask/Jinja runtime version and context. |

### T5: SQL Query Construction Can Cross From Public Filter Input Into Database Authority

| Field | Trace |
|---|---|
| Threat scenario | A client-controlled category filter is interpolated into a SQL query executed through the application database cursor. |
| Threat actor | Unauthenticated web client able to request `/listservices?category=...`. |
| Entry point | `GET /listservices`. |
| Affected component | `listservices()` route, global DB cursor, selected database backend. |
| Affected asset | `public_stuff`, `secret_stuff`, database metadata, and database connection authority. |
| Trust boundaries crossed | External query parameter to Flask route; route string construction to SQL parser/database engine. |
| Attack path | Client supplies `category`; route builds `where = " WHERE category = '<category>'"`; route executes `cursor.execute(query_build('SELECT * from public_stuff{}'.format(where)))`; results are rendered. |
| Preconditions | Attacker can reach `/listservices`; database setup has completed and global `cursor` exists; backend SQL dialect accepts the resulting query shape. |
| Potential impact | Unauthorized database reads or manipulation of query semantics, including potential access to seeded `secret_stuff`, depending on backend behavior and DB privileges. |
| Existing controls | Query is limited by route to selecting from `public_stuff` before interpolation; execution is inside a `try/except` that returns errors as response text. |
| Security gaps | User input is embedded into SQL text rather than bound as data; the same database connection created/seeded application tables and remains available to the route. |
| Supporting source evidence | `main.py:472-505`, schema/seed data at `main.py:49-82`, cursor/bootstrap at `main.py:647-656`, backend selection at `main.py:597-617`. |
| Assumptions or unknowns | Multi-statement support and comment/escape behavior vary by backend; DB user privileges depend on CLI-supplied credentials and external DB configuration. |

### T6: JWT Algorithm Trust Boundary Can Permit Admin-State Bypass

| Field | Trace |
|---|---|
| Threat scenario | A client-held JWT controls the `/user` authorization decision, while verification dispatch trusts the token header algorithm across RS256, HS256 and None paths. |
| Threat actor | Unauthenticated client or authenticated `guest` able to submit an `authentication` cookie; `guest` can obtain a normal token via `/user/login`. |
| Entry point | `GET /user`, `GET /user/jwks`, `GET/POST /user/login`. |
| Affected component | JWT creation/verification helpers and `jwtmain()` admin check. |
| Affected asset | Admin authorization state and integrity of authentication claims. |
| Trust boundaries crossed | Client-controlled cookie to token parser; unverified JWT header to verification algorithm dispatch; verified claims to authorization decision. |
| Attack path | Client places token in `authentication` cookie; `/user` calls `verify_token(token, VERIFY_KEY)`; `verify_token` uses `jwt.get_unverified_header(token)` and dispatches to RS256, HS256 or None; `/user` grants admin response when `claims['sub'] == 'admin'`; `/user/jwks` exposes public key material that is part of the JWT trust context. |
| Preconditions | Attacker can set the auth cookie; target accepts one of the enabled algorithm paths; claims satisfy issuer/audience/time checks in the chosen verifier. For `guest`, `/user/login` supplies baseline credentials `guest:guest`. |
| Potential impact | Unauthorized transition from guest/unauthenticated state to admin response state. |
| Existing controls | RS256 verification uses PyJWT with audience and issuer; manual HS256/None paths check audience, issuer, time fields and signature/empty signature conditions; `/user` requires a `sub` claim. |
| Security gaps | The server allows multiple algorithms including `None`; algorithm choice comes from untrusted token headers; authorization relies only on the token subject after verification dispatch. |
| Supporting source evidence | constants at `main.py:29-36`; key initialization `main.py:107-123`; token helpers `main.py:179-279`; login `main.py:540-573`; user route `main.py:510-528`; JWKS `main.py:531-537`; vulnerability index context `vulnerability_index.md:16-18`. |
| Assumptions or unknowns | Exact exploitability depends on PyJWT behavior, token construction and runtime clock; the modeled impact is the app's admin response state, not a broader admin backend because no other admin function exists. |

### T7: Config Selector Decryption Exposes A Cryptographic Oracle Toward Hidden Config Values

| Field | Trace |
|---|---|
| Threat scenario | A client-controlled `key` query parameter is decrypted by the server, and decryption/padding errors are returned, creating a boundary from unauthenticated input into crypto state associated with hidden config entries. |
| Threat actor | Unauthenticated web client able to request `/config?key=...`. |
| Entry point | `GET /config`. |
| Affected component | AES-CBC `decrypt`/`unpad` helpers and `config()` route. |
| Affected asset | `CONFIG` hidden entries, including base64 references to `KEY` and `ADMIN_SECRET`; crypto key material in process memory. |
| Trust boundaries crossed | External query parameter to hex decoder; decoded bytes to AES-CBC decrypt/unpad; decrypted selector to config lookup. |
| Attack path | Route creates encrypted links for viewable `app_` keys; client supplies `key`; route calls `unhexlify`, `decrypt(kv, KEY)`, `unpad`; exceptions are returned as response text; if decrypted text names any `CONFIG` key, route displays that value. |
| Preconditions | Attacker can query `/config`; attacker can observe response differences/errors; runtime `KEY` remains stable for the process lifetime. |
| Potential impact | Disclosure of hidden config values or oracle-assisted inference about encrypted selector validity, depending on cryptographic interaction and request volume. |
| Existing controls | Only keys starting with `app_` are linked by the page; unknown or invalid decrypted keys are not displayed unless they match `CONFIG.keys()`. |
| Security gaps | The decrypt/unpad operation is exposed to unauthenticated callers; exception strings are returned; successful decrypted selectors are checked against all config keys, not only the viewable list. |
| Supporting source evidence | `main.py:24-45`, AES helpers `main.py:140-168`, config route `main.py:417-446`, vulnerability index context `vulnerability_index.md:12-13`. |
| Assumptions or unknowns | Practical disclosure depends on request observability and cryptographic oracle properties; no rate limiting or monitoring code was found. |

### T8: XML Parser Boundary Can Reach Local Or Network Resources

| Field | Trace |
|---|---|
| Threat scenario | Untrusted XML is parsed with DTD loading and network-enabled parser options, crossing from client input into XML parser resource resolution behavior. |
| Threat actor | Unauthenticated web client able to submit XML to `/xml`. |
| Entry point | `GET/POST /xml`. |
| Affected component | `xml()` route and `lxml.etree` parser. |
| Affected asset | Local files and network destinations reachable by XML parser/runtime; response confidentiality of parsed/serialized XML output. |
| Trust boundaries crossed | External HTTP form input to Flask route; XML bytes to parser entity/DTD processing; parser output to HTTP response. |
| Attack path | Client submits `xml`; route constructs `etree.XMLParser(no_network=False, dtd_validation=False, load_dtd=True, huge_tree=True)`; route parses with `etree.fromstring`; serialized result is escaped and returned. |
| Preconditions | Attacker can send POST XML; parser/runtime supports relevant external resource resolution; target resources are reachable by process permissions/network. |
| Potential impact | Disclosure or interaction with local/network resources through XML parsing behavior, plus resource-consumption risk from large/complex XML enabled by parser settings. |
| Existing controls | Serialized XML is passed through `html.escape` before response rendering; no `try/except` is active around parser execution. |
| Security gaps | Parser is configured to load DTDs with network access; untrusted input is parsed directly; route has no authentication or resource policy. |
| Supporting source evidence | `main.py:392-411`, `lxml` import at `main.py:12`, vulnerability index context `vulnerability_index.md:10-11`. |
| Assumptions or unknowns | Actual file/network access depends on libxml2/lxml behavior, deployment network policy and process filesystem permissions. |

## Threat Relationships

- Process-authority convergence: T1, T2, T3 and T4 all move unauthenticated HTTP input toward code/process execution authority. If any one succeeds, it may enable access to the same downstream assets: `SIGN_KEY`, `VERIFY_KEY`, `KEY`, `ADMIN_SECRET`, `cursor`, database credentials in process arguments, local files and network resources.
- Authentication bypass and data access linkage: T6 can produce admin state, but the current app exposes no separate admin-only data plane. T1/T2/T3/T4 would be higher-leverage than T6 because they can bypass the route-level auth model entirely by reaching process authority.
- Database exposure linkage: T5 targets database data directly. T1/T2/T3/T4 could also reach database state indirectly through the global cursor or database client modules, while T5 depends on SQL dialect and route query construction.
- Config and key material linkage: T7 targets hidden config values and crypto state. Process-authority paths T1/T2/T3/T4 could also read process memory or files depending on runtime capability; T6 depends on JWT trust and may be aided by key-material exposure if such exposure occurs.
- Parser/resource-boundary linkage: T8 is a local/network resource access path through XML parsing. T2 and process-authority paths can also reach similar host/network assets through different components.

## Security Assumptions, Unknowns And Architectural Weaknesses

- Default listen address is `127.0.0.1`, but CLI can set a different address; external exposure is deployment-dependent. Evidence: `main.py:578`, `README.md:42`.
- No centralized authentication middleware protects the sensitive routes; only `/user` has a token-based decision. Evidence: routes at `main.py:299-573`.
- Sensitive consumers are embedded directly in route handlers in a single process, so failure of one boundary can expose assets owned by other workflows. Evidence: `main.py:24-82`, `main.py:296-573`.
- No tests, CI policy, deployment manifest or production WSGI config were found in the repository intelligence pass.
- No `SECURITY.md` policy was found, so expected security invariants are inferred from implementation and user task scope.
- The application is intentionally vulnerable by project purpose. This model still treats each boundary as an architectural threat scenario rather than remediation advice or exploit validation.

## Completion Check

- High-value assets and sensitive data: addressed.
- Critical business functions and privileged operations: addressed.
- Security-sensitive entry points: addressed.
- Trust boundaries and trust relationships: addressed.
- Authentication and authorization boundaries: addressed.
- Threat actors and attacker capabilities: addressed.
- Threat scenarios, abuse cases and attack paths: addressed with source-backed per-threat traces.
- Preconditions, existing controls, security gaps, assumptions and unknowns: addressed per threat.
- Relationships between threats: addressed.
- No remediation was generated.
- Source code was not modified.
