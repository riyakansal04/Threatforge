# Application Architecture Report

## Scope

Source analyzed: `C:\Users\riyakansal\OneDrive - Nagarro\Desktop\Codebase`

Output folder: `C:\Users\riyakansal\.codex\visualizations\2026\10\05\01a10aea-c4d8-7943-ae98-a306548a2037\Scan Report-1`

The workspace root is not a Git repository: `git rev-parse --show-toplevel` returned `fatal: not a git repository`. The analysis therefore treats the listed files as the application source package rather than a Git checkout.

Files observed:

- `main.py`
- `README.md`
- `requirements.txt`
- `database-requirements.txt`
- `docker_database_setup.md`
- `vulnerability_index.md`
- `COPYRIGHT.txt`

No source code was modified.

## Executive Summary

The application is **Breakable Flask**, a deliberately vulnerable, single-file Flask web application for learning and testing exploitation of common web application vulnerability classes. This purpose is directly stated in the README, which calls it "A simple vulnerable Flask application" and says it is used to "test out and learn exploitation of common web application vulnerabilities" (`README.md:4-8`).

Architecturally, the app is intentionally flat. `main.py` contains configuration constants, cryptographic helpers, JWT helpers, route handlers, database bootstrap logic, and the Flask server startup. There are no separate packages, template files, service modules, migrations, or ORM models in the observed file inventory. Each HTTP handler reads request data directly and constructs HTML or JSON responses inline.

The most important runtime path is:

1. Module import initializes secrets/config, key material, Flask app, and routes.
2. Direct script execution parses CLI options.
3. Startup code chooses a database driver, opens a database connection, creates missing tables, and seeds rows.
4. Flask starts on the configured address and port.
5. Requests are handled by route functions in `main.py`.

This is confirmed by `main.py:24-45`, `main.py:107-124`, `main.py:296-540`, and `main.py:577-661`.

## Application Purpose And Functionality

The application exists as a training and test bed for vulnerable web behaviors. The README lists the intended vulnerability classes, including Python code injection, operating system command injection, pickle deserialization, XXE, padding oracle, server-side template injection, SQL injection, and JWT none/algorithm confusion (`README.md:10-18`). `vulnerability_index.md` maps each numbered route to the corresponding training behavior (`vulnerability_index.md:7-14`).

The index route at `/` is the functional launchpad. It returns links to `/cookie`, `/lookup`, `/evaluate`, `/xml`, `/config`, `/sayhi`, `/listservices`, and `/user` (`main.py:299-316`). This supports the conclusion that the main business workflow is not a conventional domain workflow; it is a catalog of isolated vulnerability demonstration workflows.

### Primary Workflows

**Cookie workflow, `/cookie`**

The handler accepts a POSTed `value`, serializes it with `pickle.dumps`, base64-encodes it, and stores it in a cookie. On a later request it reads the `value` cookie, base64-decodes it, and deserializes it with `pickle.loads` (`main.py:320-346`). `vulnerability_index.md:7` identifies this route as the Python pickle deserialization case.

**DNS lookup workflow, `/lookup`**

The handler accepts `address` from a POST form and passes `"nslookup " + address` to the `rp()` helper (`main.py:353-360`). The helper uses `os.popen(command).read()` (`main.py:171-172`). This establishes a direct path from HTTP form input to host command execution. `vulnerability_index.md:8` identifies this route as operating system command injection.

**Expression evaluation workflow, `/evaluate`**

The handler accepts an `expression` form field and evaluates it with Python `eval(expression)`, returning the stringified result (`main.py:372-379`). `vulnerability_index.md:9` identifies this as code injection.

**XML parsing workflow, `/xml`**

The handler accepts XML from a form, creates `etree.XMLParser(no_network=False, dtd_validation=False, load_dtd=True, huge_tree=True)`, parses the submitted XML, and returns serialized XML output (`main.py:392-405`). `vulnerability_index.md:10` maps this route to XXE.

**Configuration lookup workflow, `/config`**

The app defines a `CONFIG` dictionary with encryption/admin secrets and app metadata (`main.py:39-45`). The `/config` handler lists encrypted links for keys beginning with `app_`, decrypts a `key` query parameter using AES-CBC helpers, and returns the corresponding config value (`main.py:417-443`). The encryption helpers are implemented at `main.py:156-168`. `vulnerability_index.md:11` maps this route to the padding oracle training behavior.

**Greeting workflow, `/sayhi`**

The handler accepts a `name`, interpolates it into an HTML template string, and calls `render_template_string(template)` (`main.py:450-468`). `vulnerability_index.md:12` identifies this as server-side template injection.

**Products/services workflow, `/listservices`**

The handler reads an optional `category` query parameter, constructs a SQL `WHERE` clause when present, runs `SELECT * from public_stuff...` through a global database cursor, fetches rows, and builds an HTML table (`main.py:472-490`). This workflow depends on startup database bootstrapping, which creates and seeds `public_stuff` from `DATABASE_TABLES` and `DATABASE_CONTENTS` (`main.py:49-82`, `main.py:647-656`). `vulnerability_index.md:13` maps this route to SQL injection.

**JWT workflow, `/user`, `/user/login`, `/user/jwks`**

The login handler accepts username/password, checks for `guest:guest`, signs an RS256 JWT, and stores it in the `authentication` cookie (`main.py:34-36`, `main.py:540-550`). The `/user` handler reads that cookie, verifies the token, checks the `sub` claim, and displays either an admin or non-admin message (`main.py:510-528`). `/user/jwks` exposes RSA public key parameters as JWKS (`main.py:531-536`). JWT helper functions are implemented at `main.py:179-278`. `vulnerability_index.md:14` maps this route group to JWT none algorithm and algorithm confusion.

## Technology Stack And Components

### Confirmed Stack

- Python 3: `main.py:1`, `README.md:25`
- Flask web framework: `main.py:21`, `main.py:296`, `requirements.txt:2`
- Jinja rendering through Flask `render_template_string`: `main.py:21`, `main.py:468`
- PyJWT: `main.py:4`, `main.py:190`, `main.py:213`, `main.py:293`
- lxml: `main.py:12`, `main.py:397`, `requirements.txt:5`
- pycryptodome: `main.py:14-16`, `requirements.txt:7`
- Default SQLite backend: `README.md:42`, `main.py:583`, `main.py:612-614`, `main.py:640-642`
- Optional PostgreSQL, MySQL, MSSQL, and Oracle support: `main.py:583`, `main.py:598-618`, `database-requirements.txt:2-5`

### Component Responsibilities

**Flask application shell**

`app = Flask(__name__)` creates the route registry and web app (`main.py:296`). Decorated functions from `main.py:299-540` define the HTTP interface. `app.run(host=args.address, port=args.port)` starts the development server (`main.py:661`).

**Route handlers**

The route handlers are the application's effective controllers and services. Each route parses request input and performs the relevant behavior inline. There is no observed separate controller, service, or view/template layer.

**Cryptographic helper component**

AES-CBC helpers `pad`, `unpad`, `encrypt`, and `decrypt` support `/config` (`main.py:140-168`, `main.py:424-431`). RSA helper functions generate/import keys and public key material (`main.py:86-124`, `main.py:531-536`). JWT helpers create and verify tokens (`main.py:179-278`).

**Database bootstrap component**

Startup code parses database options (`main.py:579-589`), selects a driver (`main.py:598-618`), connects and creates/chooses a database (`main.py:620-645`), then creates missing tables and inserts seed data (`main.py:647-656`). The `/listservices` handler later uses the module-level `cursor` and `query_build` function assigned during startup (`main.py:484`, `main.py:594`, `main.py:647`).

This connection is directly observable as variable references, but the global sharing behavior is inferred from Python runtime semantics: `cursor` and `query_build` are created inside the `if __name__ == "__main__"` block and referenced by `listservices`.

## Architecture And Execution Flow

### Startup Flow

1. Imports load standard libraries, Flask, lxml, pycryptodome, and JWT (`main.py:2-21`).
2. Random AES/admin secrets and app constants are initialized (`main.py:24-45`).
3. Database table metadata and seed data are declared (`main.py:47-82`).
4. RSA signing/verification keys are read from `PRIVATE_KEY_FILE` and `PUBLIC_KEY_FILE` when present, otherwise generated and written to the temp directory (`main.py:107-124`).
5. Flask app and route handlers are registered (`main.py:296-540`).
6. Script execution parses CLI arguments (`main.py:577-592`).
7. The selected database driver is imported and connection/list-table behavior is configured (`main.py:598-618`).
8. The database is connected, table existence is checked, missing tables are created, and seed data is inserted (`main.py:620-656`).
9. Flask starts with the selected host and port (`main.py:661`).

The README confirms the default operational shape: running `./main.py` starts the web server at `http://127.0.0.1:4000` and uses in-memory sqlite3 (`README.md:40-44`).

### Request Flow

Each request enters through Flask and is dispatched to one route function. Inputs come from:

- `request.form` for POST workflows: `/cookie`, `/lookup`, `/evaluate`, `/xml`, `/sayhi`, `/user/login`
- `request.args` for query-string workflows: `/config`, `/listservices`
- `request.cookies` for cookie workflows: `/cookie`, `/user`

Outputs are inline HTML strings, Flask responses from `make_response`, or JSON text for `/user/jwks`.

### Confirmed Versus Inferred Paths

Confirmed:

- `/lookup` input flows to `os.popen` via `rp()` (`main.py:357-360`, `main.py:171-172`).
- `/evaluate` input flows to Python `eval()` (`main.py:375-379`).
- `/xml` input flows to lxml parser (`main.py:395-400`).
- `/listservices` category input flows into a dynamically built SQL query (`main.py:476-484`).
- `/user/login` accepted credentials create a JWT cookie, and `/user` later verifies that cookie (`main.py:540-550`, `main.py:510-516`).

Inferred:

- The `/listservices` handler uses the startup-created `cursor`. This is inferred from Python's module-global variable lookup because `cursor` is assigned under the script startup block and referenced in the handler (`main.py:647`, `main.py:484`).
- If this module were imported by an external WSGI server without executing the `__main__` block, `/listservices` would lack the startup-created `cursor` and `query_build`. No external WSGI configuration was found, so direct script execution is the confirmed execution mode.

## Interfaces And Integrations

### HTTP Interface

| Route | Methods | Handler | Role | Evidence |
| --- | --- | --- | --- | --- |
| `/` | GET | `index` | Route catalog | `main.py:299-316` |
| `/cookie` | GET, POST | `cookie` | Cookie serialization workflow | `main.py:320-348` |
| `/lookup` | GET, POST | `lookup` | DNS lookup via OS command | `main.py:353-368` |
| `/evaluate` | GET, POST | `evaluate` | Python expression evaluation | `main.py:372-387` |
| `/xml` | GET, POST | `xml` | XML parsing | `main.py:392-413` |
| `/config` | GET | `config` | Encrypted config lookup | `main.py:417-446` |
| `/sayhi` | GET, POST | `sayhi` | Personalized template-rendered greeting | `main.py:450-468` |
| `/listservices` | GET | `listservices` | Product/service table listing | `main.py:472-504` |
| `/user` | GET | `jwtmain` | JWT-authenticated user page | `main.py:510-528` |
| `/user/jwks` | GET | `jwks` | RSA public JWKS endpoint | `main.py:531-536` |
| `/user/login` | GET, POST | `login` | Guest login and JWT issuance | `main.py:540-572` |

### External Integrations

**Host operating system**

`/lookup` executes `nslookup` using `os.popen` (`main.py:171-172`, `main.py:360`). This is a direct application-to-host integration.

**Relational databases**

The application supports SQLite by default and can connect to PostgreSQL, MySQL, MSSQL, or Oracle depending on CLI arguments (`main.py:583`, `main.py:598-618`). Docker setup guidance for the optional external databases is documentation-only and not invoked by app code (`docker_database_setup.md:7-101`).

**Filesystem**

When key environment variables are missing, generated RSA keys are written to the system temporary directory (`main.py:111-124`).

## Data Architecture

The app has three important data categories: in-memory config, relational tables, and cookies.

### In-Memory Config

`CONFIG` stores `encrypto_key`, `secret_admin_value`, `app_name`, `app_version`, and `app_philosophy` (`main.py:39-45`). `/` uses `app_name` in the page title (`main.py:303`). `/config` filters keys beginning with `app_`, encrypts links to those names, decrypts a selected query parameter, and returns the selected config value (`main.py:423-436`).

### Relational Tables

`DATABASE_TABLES` defines two tables (`main.py:49-66`):

- `public_stuff`: `id`, `name`, `category`, `description`
- `secret_stuff`: `name`, `description`

`DATABASE_CONTENTS` provides seed rows for both tables (`main.py:69-82`). Startup code creates missing tables and inserts seed rows (`main.py:650-656`).

Only `public_stuff` is directly queried by an observed route. `/listservices` reads `category`, builds a query against `public_stuff`, executes it, fetches rows, and renders them (`main.py:472-490`). No route directly queries `secret_stuff` in the observed source.

### Cookies

The `value` cookie stores a base64-encoded pickle payload for `/cookie` (`main.py:329`, `main.py:346`). The `authentication` cookie stores a JWT for `/user` (`main.py:35`, `main.py:515`, `main.py:550`).

## Security-Relevant Implementation

This section identifies security-relevant implementation points because they are architectural facts. It is not a threat model, security scan, or remediation plan.

### Authentication And Authorization

Authentication is implemented only for the JWT route group. The accepted user is hard-coded as `guest` (`main.py:34`). `/user/login` accepts credentials only when username and password both equal `guest`, then issues a JWT cookie (`main.py:543-550`).

Authorization is represented by a display check on the JWT `sub` claim. If `sub == "admin"`, `/user` displays "Admin achieved!"; otherwise it displays a non-admin message (`main.py:519-523`). There is no observed role database, session store, or policy module.

### Cryptography And Key Material

The app generates a random AES key and admin secret at startup (`main.py:24-26`). AES-CBC encryption/decryption is used by `/config` (`main.py:156-168`, `main.py:424-431`).

RSA JWT signing keys are read from environment-specified files when `PRIVATE_KEY_FILE` and `PUBLIC_KEY_FILE` are set. Otherwise, generated private/public keys are stored in temp files and used in memory (`main.py:107-124`). `/user/jwks` exposes the RSA public key values (`main.py:531-536`).

### Sensitive Operations

The following sensitive operations are directly present:

- `pickle.loads` on a client-controlled cookie (`main.py:329`)
- OS command execution through `os.popen` (`main.py:171-172`, `main.py:360`)
- Python `eval()` on a form value (`main.py:379`)
- XML parsing with DTD loading and network access enabled (`main.py:397`)
- AES-CBC decryption behavior exposed through `/config` errors (`main.py:428-433`)
- Dynamic template rendering from form-derived string data (`main.py:454-468`)
- Dynamic SQL construction from a query parameter (`main.py:476-484`)
- JWT verification dispatch by unverified header algorithm, including HS256 and None branches (`main.py:32`, `main.py:267-277`)

The README and vulnerability index confirm these are intentional teaching surfaces, not accidental discoveries (`README.md:10-18`, `vulnerability_index.md:7-14`).

## Assumptions And Unknowns

- Production deployment is unknown. No Dockerfile, WSGI entrypoint, Procfile, service manifest, or deployment configuration was found.
- Automated test coverage is unknown or absent in the observed files. No tests or test configuration appeared in the file inventory.
- Exact dependency versions are unknown because the requirements files use lower bounds rather than a lockfile.
- The direct script execution path is confirmed. Import-based deployment behavior is uncertain because database initialization occurs inside `if __name__ == "__main__"` (`main.py:577-661`).
- The analysis did not run the application or interact with routes; conclusions are based on static repository evidence and documentation.

