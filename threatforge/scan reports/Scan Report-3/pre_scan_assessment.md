# Pre-Scan Security Baseline And Scan Focus

## Scope

This pre-scan assessment correlates the repository intelligence in `Scan Report-1`, the architecture-level threat model in `Scan Report-2`, and direct implementation evidence from `main.py`. It establishes a security baseline and recommends where later scan capabilities should focus. It does not perform a vulnerability scan, assign final vulnerability severity, generate remediation, or modify source code.

## Security Baseline

### Architecture Security Shape

The application is a single-process Flask app implemented in `main.py`. Route handlers, cryptographic helpers, JWT helpers, parser/evaluation helpers, database bootstrap and runtime startup all share the same module/global process context. Evidence: `main.py:24-82`, `main.py:86-168`, `main.py:179-293`, `main.py:296-573`, `main.py:577-661`.

The dominant security characteristic is that unauthenticated HTTP entry points transfer client-controlled values directly into high-authority consumers: Python `eval`, `os.popen`, `pickle.loads`, `lxml.etree`, Jinja `render_template_string`, AES decrypt/unpad, JWT verification and SQL cursor execution. Evidence: `main.py:320-350`, `main.py:353-367`, `main.py:372-386`, `main.py:392-411`, `main.py:417-446`, `main.py:450-505`, `main.py:510-573`.

Default runtime is local Flask on `127.0.0.1:4000` using SQLite `:memory:`, with CLI options for address, port and alternate database backends. Evidence: `main.py:577-589`, `main.py:597-661`, `README.md:40-54`.

### Security-Critical Modules And Components

| Component | Security role | Related threats | Evidence |
|---|---|---|---|
| Flask route layer | Receives all external HTTP input and dispatches it to local consumers. | T1-T8 | `main.py:296-573` |
| Python execution path | `/evaluate` passes form input to `eval`. | T1 | `main.py:372-386` |
| OS command path | `/lookup` builds a command and calls `popen`. | T2 | `main.py:171-172`, `main.py:353-367` |
| Cookie serialization path | `/cookie` deserializes client cookie data with pickle. | T3 | `main.py:320-350` |
| Jinja rendering path | `/sayhi` constructs a template from form input and renders it. | T4 | `main.py:450-468` |
| Database layer | Startup creates/loads DB state; `/listservices` executes SQL using global cursor. | T5 | `main.py:49-82`, `main.py:472-505`, `main.py:597-656` |
| JWT authentication layer | `/user/login`, `/user`, `/user/jwks` issue, verify and expose JWT trust material. | T6 | `main.py:29-36`, `main.py:107-123`, `main.py:179-279`, `main.py:510-573` |
| Config crypto layer | `/config` exposes AES-CBC decrypt/unpad behavior and looks up `CONFIG`. | T7 | `main.py:24-45`, `main.py:140-168`, `main.py:417-446` |
| XML parser layer | `/xml` parses request XML with DTD loading and network-enabled options. | T8 | `main.py:12`, `main.py:392-411` |
| Startup/configuration | CLI/environment controls address, database connection and key-file loading. | Cross-cutting | `main.py:107-123`, `main.py:577-661` |

### High-Value Assets And Sensitive Data Paths

| Asset or data path | Why it matters | Related components | Evidence |
|---|---|---|---|
| Flask process authority | Holds globals, keys, DB cursor and host privileges for all workflows. | Route layer, execution paths, database layer | `main.py:24-82`, `main.py:296-573`, `main.py:647-661` |
| JWT signing/verification state | Controls authentication cookie validity and admin-state decision. | JWT helpers, `/user*` routes | `main.py:107-123`, `main.py:179-279`, `main.py:510-573` |
| `CONFIG` hidden entries | Contains base64-encoded `KEY` and `ADMIN_SECRET` values in memory. | Config crypto path | `main.py:24-45`, `main.py:417-446` |
| Database contents | `public_stuff` is route-exposed; `secret_stuff` is seeded but not normal-route exposed. | DB bootstrap, `/listservices` | `main.py:49-82`, `main.py:472-505`, `main.py:647-656` |
| Local files and network destinations | Reachability depends on process and parser/command behavior. | `/lookup`, `/xml`, execution paths | `main.py:171-172`, `main.py:397-400` |
| External DB credentials/config | CLI can pass DB username/password/host/port; app may create/use `breakdb`. | Startup/configuration, DB layer | `main.py:581-586`, `main.py:622-642`, `README.md:46-48` |

### Security-Sensitive APIs And Entry Points

| Entry point | Data source | Sensitive consumer | Related threat |
|---|---|---|---|
| `GET/POST /cookie` | `form:value`, `cookie:value` | `pickle.loads`, `pickle.dumps`, `set_cookie` | T3 |
| `GET/POST /lookup` | `form:address` | `os.popen` via `rp()` | T2 |
| `GET/POST /evaluate` | `form:expression` | Python `eval` | T1 |
| `GET/POST /xml` | `form:xml` | `lxml.etree.XMLParser`, `etree.fromstring` | T8 |
| `GET /config` | `query:key` | AES decrypt/unpad and `CONFIG` lookup | T7 |
| `GET/POST /sayhi` | `form:name` | `render_template_string` | T4 |
| `GET /listservices` | `query:category` | SQL string construction and `cursor.execute` | T5 |
| `GET /user` | `cookie:authentication` | JWT parser/verifier and admin check | T6 |
| `GET /user/jwks` | none | RSA public key material exposure | T6 |
| `GET/POST /user/login` | `form:username`, `form:password` | JWT issuance and cookie setting | T6 |

### Privileged And High-Impact Business Operations

- Admin-state decision: `/user` displays admin success when verified JWT claims contain `sub == admin`. Evidence: `main.py:513-522`.
- Token issuance: `/user/login` accepts `guest:guest`, creates an RS256 token and sets the `authentication` cookie. Evidence: `main.py:543-550`.
- Database bootstrap and use: startup creates databases/tables and inserts seed data; `/listservices` reads through the global cursor. Evidence: `main.py:622-656`, `main.py:472-505`.
- Process-local sensitive operations: `/evaluate`, `/lookup`, `/cookie`, `/sayhi`, `/xml` and `/config` cross from web input to interpreter, OS, deserializer, template engine, parser and decryptor boundaries. Evidence: `main.py:320-468`.

### Authentication And Authorization Surfaces

Authentication is isolated to the `/user*` flow. There is no global authentication middleware protecting the other sensitive routes. Evidence: route definitions at `main.py:299-573`.

The auth boundary is a client-held JWT in the `authentication` cookie. Verification dispatches based on token header algorithm among `RS256`, `HS256` and `None`; authorization checks only the `sub` claim against `ADMIN_USER`. Evidence: `main.py:29-36`, `main.py:267-279`, `main.py:510-528`.

Key material is loaded from `PRIVATE_KEY_FILE`/`PUBLIC_KEY_FILE` when present or generated into temporary files otherwise. Evidence: `main.py:107-123`.

### External Trust Boundaries And Integrations

- OS command execution boundary through `os.popen`. Evidence: `main.py:11`, `main.py:171-172`.
- Optional external database boundary for PostgreSQL, MySQL, MSSQL and Oracle. Evidence: `database-requirements.txt:2-5`, `main.py:597-617`, `docker_database_setup.md:7-97`.
- Local filesystem key-file boundary through `PRIVATE_KEY_FILE` and `PUBLIC_KEY_FILE`. Evidence: `main.py:107-109`.
- XML parser file/network resolution boundary through parser configuration. Evidence: `main.py:397-400`.

### Relevant Security Controls

| Control or constraint | Applies to | Evidence | Baseline note |
|---|---|---|---|
| Default loopback binding | Runtime exposure | `main.py:578`, `README.md:42` | Exposure changes if `--address` is set differently. |
| JWT audience/issuer/time checks | `/user` token verification | `main.py:211-263` | Present in RS256 and manual HS256/None verification paths. |
| `sub` claim requirement | `/user` authorization | `main.py:516-522` | Admin state depends on `sub == admin`. |
| `html.escape` on XML output | `/xml` response rendering | `main.py:400-404` | Applies after XML parsing, not before parser resource handling. |
| Linked config keys limited to `app_` prefix | `/config` page generation | `main.py:424-427` | Decrypted query selectors are checked against all `CONFIG` keys. |
| SQL execution wrapped in `try/except` | `/listservices` | `main.py:483-487` | Exceptions are returned as response text. |
| Database type CLI choices | Startup | `main.py:581` | Backend behavior differs across supported engines. |

### Limited Visibility And Unresolved Behavior

- No `SECURITY.md`, production deployment manifest, WSGI server config, CI workflow or test suite was identified in the prior intelligence pass.
- The actual exposure of routes depends on runtime `--address` and host/network configuration. Evidence: `main.py:578`, `README.md:42`.
- External database behavior depends on selected backend, driver behavior, DB user privileges and server configuration. Evidence: `main.py:597-642`.
- Process-level impact depends on host permissions, environment, installed commands and runtime context.
- XML external resource behavior depends on lxml/libxml2 behavior and deployment filesystem/network policy. Evidence: `main.py:397-400`.
- JWT exploitability details depend on runtime PyJWT behavior, token construction and clock validation; pre-scan does not validate exploitability.

## Important Dependencies Between Security-Critical Components

- Process authority is shared: route handlers, config, keys and DB cursor live in one Python process, so process-level paths can affect assets outside their original feature area. Evidence: `main.py:24-82`, `main.py:296-573`, `main.py:647-661`.
- JWT trust depends on key initialization and algorithm dispatch: `SIGN_KEY`/`VERIFY_KEY` setup feeds token creation and verification; `/user/jwks` exposes public verification material. Evidence: `main.py:107-123`, `main.py:179-279`, `main.py:531-537`.
- Database runtime depends on startup: `/listservices` assumes `cursor` and `query_build` exist from the `__main__` startup path. Evidence: `main.py:472-505`, `main.py:577-656`.
- Config crypto depends on process-lifetime `KEY`: `/config` encrypts links and decrypts user-supplied selectors using the same module-level key. Evidence: `main.py:24-45`, `main.py:140-168`, `main.py:417-446`.

## Threat Convergence Priorities

| Convergence area | Threats | Why it should guide later scans | Evidence |
|---|---|---|---|
| Process authority via direct execution consumers | T1, T2, T3, T4 | Multiple independent entry points may converge on the same process-level assets: keys, config, DB cursor and host permissions. | `main.py:320-386`, `main.py:450-468`, `main.py:24-82` |
| Database authority and data exposure | T5 plus indirect T1-T4 | `/listservices` directly reaches SQL; process-level paths may also reach cursor or DB modules. | `main.py:49-82`, `main.py:472-505`, `main.py:647-656` |
| Authentication and key material | T6 plus T1-T4 and T7 | JWT authorization can be affected directly by token verification behavior or indirectly by process/config/key exposure. | `main.py:107-123`, `main.py:179-279`, `main.py:510-573` |
| Host/file/network resources | T2, T8 plus process-level T1/T4 | OS command execution and XML parser behavior both cross toward host or network resources. | `main.py:171-172`, `main.py:397-400` |
| Cryptographic decision oracles | T6, T7 | JWT and config flows both make security decisions based on attacker-influenced encoded/cryptographic material. | `main.py:140-168`, `main.py:267-279`, `main.py:417-446` |

## Subsequent Scan Focus

### Standard Scan Focus

| Field | Recommendation |
|---|---|
| Target module/component/API/flow | Whole repository, with primary attention to `main.py` route handlers, helper functions and startup path. |
| Relevant security concern or threat context | Baseline scan should cover all externally reachable route-to-sensitive-consumer flows and shared-process consequences. |
| Related asset or business function | Flask process authority, authentication/admin state, database contents, config secrets, host/file/network resources. |
| Related threat scenario or attack path | T1 through T8. |
| Reason the scan focus is valuable | The repo is small and monolithic; a whole-repo pass can correlate all route flows, globals and startup-dependent resources without scope fragmentation. |
| Supporting repository evidence | `main.py:24-82`, `main.py:296-573`, `main.py:577-661`, `README.md:40-54`. |

### Deep Scan Focus

| Field | Recommendation |
|---|---|
| Target module/component/API/flow | High-authority route convergence paths: `/evaluate`, `/lookup`, `/cookie`, `/sayhi`, `/listservices`, `/config`, `/xml`, and `/user*`. |
| Relevant security concern or threat context | Multiple distinct trust-boundary failures converge on process authority, database authority, key material and host resources. |
| Related asset or business function | Process authority, JWT keys/admin authorization, `CONFIG` hidden entries, DB tables, local/network resources. |
| Related threat scenario or attack path | Process-authority convergence T1-T4; database linkage T5; authentication/key-material linkage T6-T7; parser/resource linkage T8. |
| Reason the scan focus is valuable | Deep review should reduce variance across several independent high-impact paths and inspect cross-threat relationships rather than only isolated line-level patterns. |
| Supporting repository evidence | `main.py:320-350`, `main.py:353-386`, `main.py:392-468`, `main.py:472-573`, `main.py:647-656`, `Scan Report-2/threat_model.json`. |

### Module Scan Focus

| Field | Recommendation |
|---|---|
| Target module/component/API/flow | `main.py` logical modules: JWT/auth helpers and `/user*`; DB bootstrap and `/listservices`; config crypto and `/config`; parser/evaluation/execution routes. |
| Relevant security concern or threat context | Although physically one file, the code has distinct security modules with separate trust boundaries and shared globals. |
| Related asset or business function | Authentication/admin state, database contents, hidden config values, process/OS/template/parser authority. |
| Related threat scenario or attack path | JWT module T6; DB module T5; config crypto T7; parser/execution routes T1-T4 and T8. |
| Reason the scan focus is valuable | Module-oriented review can preserve logical boundaries inside the monolith and inspect each module's caller/callee relationships and shared-state dependencies. |
| Supporting repository evidence | JWT/auth `main.py:29-36`, `main.py:107-123`, `main.py:179-279`, `main.py:510-573`; DB `main.py:49-82`, `main.py:472-505`, `main.py:597-656`; config crypto `main.py:140-168`, `main.py:417-446`; execution/parser routes `main.py:320-468`. |

### Exploitable Scan Focus

| Field | Recommendation |
|---|---|
| Target module/component/API/flow | Reachability-oriented validation candidates for `/evaluate`, `/lookup`, `/cookie`, `/sayhi`, `/listservices`, `/config`, `/xml` and `/user*`, without expanding beyond authorized app behavior. |
| Relevant security concern or threat context | Determine which source-backed threat paths are practically reachable under actual runtime semantics and default or documented configurations. |
| Related asset or business function | Process authority, host resources, DB contents, hidden config, authentication/admin state. |
| Related threat scenario or attack path | T1-T8, with emphasis on preconditions and controls recorded in `Scan Report-2`. |
| Reason the scan focus is valuable | The pre-scan baseline identifies many intentional threat paths; an exploitable scan should distinguish source-backed theoretical reachability from practically demonstrable behavior without assigning final severity at this stage. |
| Supporting repository evidence | `main.py:320-573`, `main.py:577-661`, `README.md:40-54`, `vulnerability_index.md:1-18`, `Scan Report-2/threat_model.md`. |

## Completion Check

- Architecture, business functionality, assets, data flows, trust boundaries and threat scenarios were correlated.
- Security-critical modules/components, assets, entry points, privileged operations, auth surfaces, external trust boundaries, controls, unknowns and dependencies were addressed.
- A pre-scan security baseline was built from implementation evidence.
- Focus was determined for Standard Scan, Deep Scan, Module Scan and Exploitable Scan.
- Each scan focus includes target, concern, related asset/function, related threat, value rationale and supporting evidence.
- Threat convergence areas were identified.
- No actual vulnerability scan was performed.
- No final vulnerability severity was assigned.
- No remediation was generated.
- Source code was not modified.
