# Repository Intelligence Assessment: Breakable Flask

## Scope And Purpose

This repository contains a deliberately vulnerable, single-file Python Flask web application named Breakable Flask. The README describes it as "A simple vulnerable Flask application" intended to test and learn exploitation of common web application vulnerabilities, and specifically says it was created as a simple app to run exploitation checks against. Evidence: `README.md:1-17`.

The application's business functionality is a training/testbed site exposing small web workflows: cookie storage and retrieval, DNS lookup, Python expression evaluation, XML parsing, configuration viewing, personalized greeting rendering, product/service listing, and JWT-based login. The index route links to these workflows. Evidence: `main.py:299-318`.

Repository scope is narrow. The codebase consists of `main.py`, dependency lists, README/setup documentation, Docker database setup guidance, a vulnerability index, copyright, and `.gitignore`. No package/module tree, templates directory, static assets, migration files, CI configuration, or test suite were present in the repository file listing.

This assessment documents architecture and runtime intelligence only. It does not perform vulnerability assessment, threat prioritization, exploitation guidance, or remediation.

## Languages, Frameworks, Runtimes And Dependencies

- Primary language/runtime: Python 3, using a shebang of `#!/usr/bin/env python3`. Evidence: `main.py:1`.
- Web framework: Flask, with `Flask`, `request`, `make_response`, and `render_template_string`. Evidence: `main.py:21`, `requirements.txt:2`.
- Template/runtime dependency: Jinja2 via Flask and explicit `render_template_string`. Evidence: `main.py:21`, `main.py:468`, `requirements.txt:4`.
- XML parser: `lxml.etree`. Evidence: `main.py:12`, `main.py:397-400`, `requirements.txt:5`.
- Cryptography: PyCryptodome AES, random bytes, and RSA key handling. Evidence: `main.py:14-16`, `main.py:86-168`, `requirements.txt:7`.
- JWT: PyJWT imported as `jwt`. Evidence: `main.py:4`, `main.py:190`, `main.py:213`.
- Standard-library data/OS helpers: `pickle`, `base64`, `binascii`, `os`, `popen`, `argparse`, `sqlite3`. Evidence: `main.py:7-18`, `main.py:613`.
- Optional database drivers: `psycopg2-binary`, `pymysql`, `pymssql`, `cx-Oracle`, and `cryptography`. Evidence: `database-requirements.txt:1-5`; dynamic imports at `main.py:599-617`.

## Repository Structure

- `main.py`: Entire application implementation, including constants, cryptographic helpers, JWT helpers, Flask route handlers, CLI parsing, database bootstrap and server startup.
- `requirements.txt`: Required Python packages for the base Flask application.
- `database-requirements.txt`: Optional database client dependencies for external database backends.
- `README.md`: Purpose, dependency installation and runtime instructions.
- `docker_database_setup.md`: Instructions for running optional database servers in Docker.
- `vulnerability_index.md`: Educational mapping between numbered route comments and intended vulnerability categories.
- `COPYRIGHT.txt`, `.gitignore`: License/copyright and ignore metadata.

## Architecture And Layers

The application is a monolithic Flask script with no separate package layers. The observable layers are logical rather than directory-based:

- Configuration/constants layer: application metadata, crypto/JWT settings, database schema and seed data. Evidence: `main.py:24-82`.
- Crypto/JWT helper layer: RSA key generation/import, AES-CBC padding/encryption/decryption, JWT creation and verification helpers. Evidence: `main.py:86-168`, `main.py:179-293`.
- Web interface layer: Flask app and route handlers. Evidence: `main.py:296-573`.
- Persistence/bootstrap layer: CLI-selected database module, connection creation, table creation and seed inserts. Evidence: `main.py:577-656`.
- Runtime process layer: Flask development server started by `app.run`. Evidence: `main.py:661`.

The route layer directly uses globals from the helper and persistence layers. Examples: `/config` uses `CONFIG`, `KEY`, `encrypt`, and `decrypt`; `/listservices` uses global `cursor`, `query_build`, and `DATABASE_TABLES`; `/user` uses `VERIFY_KEY` and JWT verification helpers; `/user/login` uses `SIGN_KEY` and `create_token_rsa`. Evidence: `main.py:422-443`, `main.py:476-485`, `main.py:515-522`, `main.py:547-550`.

## Startup And Bootstrap Sequence

Actual startup is established from the `if __name__ == "__main__"` block.

1. Module import initializes configuration constants and random values such as `KEY` and `ADMIN_SECRET`. Evidence: `main.py:24-45`.
2. Module import initializes JWT signing/verification keys. If `PRIVATE_KEY_FILE` and `PUBLIC_KEY_FILE` are set, their contents are read; otherwise RSA keys are generated and written to the OS temp directory as `private.pem` and `public.pem`. Evidence: `main.py:107-123`.
3. Flask app object is created globally. Evidence: `main.py:296`.
4. On direct execution, argparse defines listen address/port, debug count, database type, database connection parameters, SQLite filename and Oracle client location. Evidence: `main.py:577-589`.
5. `query_build` is set differently for Oracle versus other database types. Evidence: `main.py:594`.
6. A database module and database/table listing query are selected based on `--database_type`. Evidence: `main.py:597-617`.
7. The application connects to the selected database. For non-SQLite/non-Oracle external databases, it first connects at server level, creates `breakdb` if missing, reconnects to `breakdb`, and enables autocommit. For Oracle it builds a DSN and connects. For SQLite it connects to `--database_filename`, defaulting to `:memory:`. Evidence: `main.py:622-642`.
8. The startup code creates missing tables from `DATABASE_TABLES` and inserts seed rows from `DATABASE_CONTENTS`. Evidence: `main.py:647-656`.
9. If database setup fails, the process prints an error and exits with status 1. Evidence: `main.py:657-659`.
10. Flask starts listening with the configured host and port. Evidence: `main.py:661`.

README runtime instructions align with this flow: default execution runs at `http://127.0.0.1:4000` with in-memory SQLite; alternate database engines require CLI options and an external database server. Evidence: `README.md:40-54`.

## Runtime Processes, Services, Workers And Jobs

The repository defines one runtime process: the Flask web server started by `main.py`. No workers, queues, scheduled jobs, background tasks, ASGI/WSGI production wrapper, or service manager configuration were found.

Optional external services are database servers for PostgreSQL, MySQL, MSSQL and Oracle. They are not part of the application process, but setup instructions are documented for Docker. Evidence: `docker_database_setup.md:7-97`.

## APIs, Routes And Externally Accessible Interfaces

All externally accessible application interfaces are Flask routes in `main.py`:

- `GET /`: index page linking to all workflows. Evidence: `main.py:299-318`.
- `GET, POST /cookie`: reads form field `value`, sets cookie `value`, or reads cookie `value`. Evidence: `main.py:320-350`.
- `GET, POST /lookup`: reads form field `address`, invokes the DNS lookup helper and displays output. Evidence: `main.py:353-367`; helper at `main.py:171-172`.
- `GET, POST /evaluate`: reads form field `expression`, evaluates it and displays the result. Evidence: `main.py:372-386`.
- `GET, POST /xml`: reads form field `xml`, parses it with `lxml.etree`, and displays serialized XML. Evidence: `main.py:392-411`.
- `GET /config`: reads query parameter `key`, decrypts it with the app key, and displays selected `CONFIG` values. Evidence: `main.py:417-446`.
- `GET, POST /sayhi`: reads form field `name`, injects it into a greeting template, and renders via Flask/Jinja. Evidence: `main.py:450-468`.
- `GET /listservices`: reads query parameter `category`, queries `public_stuff`, and renders a table. Evidence: `main.py:472-505`.
- `GET /user`: reads `authentication` cookie, verifies JWT, and displays user/admin status. Evidence: `main.py:510-528`.
- `GET /user/jwks`: emits RSA public key parameters as JSON Web Key Set-like JSON. Evidence: `main.py:531-537`.
- `GET, POST /user/login`: accepts username/password form fields, issues an auth cookie for `guest:guest`, and links back to `/user`. Evidence: `main.py:540-573`.

No REST API blueprint, OpenAPI document, webhook receiver, or non-HTTP interface was found.

## Major Request And Execution Flows

### Index Navigation

`GET /` returns static HTML with links to each route. It reads `CONFIG['app_name']` for the page title. Evidence: `main.py:299-318`, `main.py:39-45`.

### Cookie Workflow

`POST /cookie` reads `request.form['value']`, serializes it with `pickle.dumps`, base64-encodes it, and stores it in a `value` cookie. `GET /cookie` reads the `value` cookie when present, base64-decodes it, and deserializes it with `pickle.loads`, then renders the value. Evidence: `main.py:325-346`.

### DNS Lookup Workflow

`POST /lookup` reads `request.form['address']`, concatenates it into `nslookup <address>`, executes via `rp()`, and renders the command output with line breaks converted to `<br>`. `rp()` wraps `os.popen(command).read()`. Evidence: `main.py:171-172`, `main.py:356-363`.

### Expression Evaluation Workflow

`POST /evaluate` reads `request.form['expression']`, passes it to Python `eval`, stringifies the result, and renders it in the response. Evidence: `main.py:375-382`.

### XML Parsing Workflow

`POST /xml` reads `request.form['xml']`, creates an `etree.XMLParser` with network access and DTD loading options, parses the submitted XML bytes with `etree.fromstring`, serializes the document, HTML-escapes it, and renders it. Evidence: `main.py:395-404`.

### Configuration Viewing Workflow

`GET /config` builds links for `CONFIG` keys beginning with `app_`. Link values are produced by encrypting config key names with AES-CBC and hex-encoding the result. When `key` is supplied, it hex-decodes and decrypts the key, then displays the selected config value when present. Evidence: `main.py:39-45`, `main.py:140-168`, `main.py:422-443`.

### Greeting Workflow

`POST /sayhi` reads `request.form['name']`, inserts it into an HTML greeting string, interpolates that into a larger template string, and renders it with `render_template_string`. Evidence: `main.py:453-468`.

### Product And Services Workflow

On startup, the database bootstrap creates `public_stuff` and `secret_stuff` when absent and seeds rows. Evidence: `main.py:49-82`, `main.py:647-656`. `GET /listservices` derives column names for `public_stuff` from `DATABASE_TABLES`, optionally builds a `WHERE category = '<category>'` clause from the `category` query parameter, executes the query through the global cursor, and renders a table with category filter links. Evidence: `main.py:472-505`.

### JWT Login Workflow

`GET /user/login` renders a login form and states the default credentials are `guest:guest`. `POST /user/login` compares submitted username/password to `ALLOWED_USER`, creates an RS256 token with `create_token_rsa`, sets the `authentication` cookie, and redirects the user by link to `/user`. Evidence: `main.py:29-36`, `main.py:179-190`, `main.py:543-550`, `main.py:558-573`.

`GET /user` reads the `authentication` cookie, passes it and `VERIFY_KEY` to `verify_token`, checks the `sub` claim, and renders either admin success or current-user status with a link to `/user/jwks`. Evidence: `main.py:510-528`. `verify_token` dispatches to RS256, HS256 or None verification based on unverified JWT headers and `ALLOWED_ALGORITHMS`. Evidence: `main.py:32`, `main.py:211-279`.

`GET /user/jwks` imports `VERIFY_KEY`, extracts RSA modulus/exponent, base64url-encodes them and returns JSON. Evidence: `main.py:531-537`.

## Databases, Data Models And Persistence

The application supports SQLite, PostgreSQL, MySQL, MSSQL and Oracle through dynamic imports and DB-API-style cursors. Evidence: `main.py:597-617`.

Default persistence is SQLite with `--database_filename=:memory:`, so data is in-memory unless a filename is supplied. Evidence: `main.py:587`, `main.py:641-642`; README default runtime note at `README.md:40-44`.

The logical database name for external database engines is `breakdb`. Evidence: `main.py:47`, `main.py:627-633`.

Data model:

- `public_stuff`: columns `id integer NOT NULL`, `name varchar(40)`, `category varchar(20) NOT NULL`, `description varchar(400)`. Evidence: `main.py:49-59`.
- `secret_stuff`: columns `name varchar(40)`, `description varchar(400)`. Evidence: `main.py:60-66`.

Seed data includes five public product/service/whitepaper rows and three secret rows. Evidence: `main.py:69-82`.

Only `public_stuff` is queried by route code. `secret_stuff` is created and seeded at startup but no direct route references it by name outside database setup. Evidence: route query at `main.py:484`; table definitions and inserts at `main.py:49-82`, `main.py:650-656`.

## Important Data Flows

- Browser form or cookie input to response HTML: `/cookie`, `/lookup`, `/evaluate`, `/xml`, `/sayhi`, `/listservices`, `/user/login`.
- Cookie `value` to `pickle.loads` to rendered HTML: `main.py:328-346`.
- Form `address` to `os.popen` output to rendered HTML: `main.py:356-363`, `main.py:171-172`.
- Form `expression` to `eval` result to rendered HTML: `main.py:375-382`.
- Form `xml` to lxml parser to serialized/escaped output: `main.py:395-404`.
- Query `key` to AES decrypt to `CONFIG` lookup to rendered HTML: `main.py:422-443`.
- Query `category` to SQL statement to DB cursor to rendered table: `main.py:476-500`.
- Login form credentials to JWT to `authentication` cookie to `/user` verification and claim-based rendering: `main.py:543-550`, `main.py:513-528`.
- Environment variables or generated temp files to JWT signing/verification keys: `main.py:107-123`.
- CLI database options to database connection and schema/data bootstrap: `main.py:577-656`.

## External APIs, Integrations And Webhooks

No outbound web APIs or webhook integrations were found.

External/runtime integrations:

- OS command execution through `popen` for DNS lookup. Evidence: `main.py:11`, `main.py:171-172`.
- Optional external databases: PostgreSQL, MySQL, MSSQL and Oracle. Evidence: `main.py:597-617`; Docker guidance in `docker_database_setup.md:7-97`.
- Local filesystem access for JWT key files through `PRIVATE_KEY_FILE` and `PUBLIC_KEY_FILE`, or generated temp key files. Evidence: `main.py:107-123`.
- Oracle client library initialization through `cx_Oracle.init_oracle_client(args.oracle_lib_dir)`. Evidence: `main.py:616-617`.

## Authentication And Authorization

The only authentication implementation is the `/user` workflow:

- Constants define `ALLOWED_USER='guest'`, `ADMIN_USER='admin'`, `AUTH_COOKIE='authentication'`, `ALLOWED_AUDIENCE=APP_NAME`, `ALLOWED_ALGORITHMS=['RS256', 'HS256', 'None']`. Evidence: `main.py:29-36`.
- Login succeeds only when username and password both match `ALLOWED_USER`. Evidence: `main.py:543-550`.
- Successful login creates an RS256 JWT with subject `guest`, sets it as the `authentication` cookie, and expires it after `EXPIRY_WINDOW`. Evidence: `main.py:179-190`, `main.py:547-550`.
- `/user` verifies the cookie token and checks the `sub` claim. It displays admin status only when `sub == ADMIN_USER`; otherwise it displays current user status. Evidence: `main.py:513-528`.
- There is no broader route authorization middleware, session store, role database, or user management system.

## Configuration, Environment And Deployment

Runtime configuration sources:

- Hardcoded constants in `main.py`: app metadata, JWT settings, cookie names, default users, config values, schema and seed data. Evidence: `main.py:24-82`.
- Environment variables: `PRIVATE_KEY_FILE` and `PUBLIC_KEY_FILE` for JWT key material. Evidence: `main.py:107-109`.
- CLI arguments: host, port, debug count, database type, database credentials/host/port, SQLite filename and Oracle library directory. Evidence: `main.py:577-589`.
- Dependency files: `requirements.txt` for base app; `database-requirements.txt` for optional database drivers.
- Docker database setup documentation for external database services. Evidence: `docker_database_setup.md:7-97`.

No Dockerfile, docker-compose file, deployment manifest, WSGI server config, `.env` file, CI deployment workflow, or secrets management config was found.

## Build, Test And CI/CD

Build/install is Python dependency installation via pip:

- Base install: `pip install -r requirements.txt`. Evidence: `README.md:25-29`.
- Optional database dependencies: `pip install -r database-requirements.txt`. Evidence: `README.md:31-34`.

No automated tests, test runner configuration, linting configuration, CI/CD workflow, packaging metadata, or release automation were found in the repository file listing.

## Security-Relevant Interfaces And Sensitive Processing

This section identifies security-relevant surfaces and sensitive processing without assessing vulnerabilities or remediation priority.

- Deserialization and cookie handling occur in `/cookie` through `pickle` and base64. Evidence: `main.py:320-350`.
- OS process invocation occurs in `/lookup` through `os.popen`. Evidence: `main.py:171-172`, `main.py:353-367`.
- Dynamic Python expression evaluation occurs in `/evaluate`. Evidence: `main.py:372-386`.
- XML parsing with DTD/network-related parser settings occurs in `/xml`. Evidence: `main.py:392-411`.
- AES encryption/decryption and padding behavior are exposed indirectly by `/config`. Evidence: `main.py:140-168`, `main.py:417-446`.
- Server-side template rendering of constructed strings occurs in `/sayhi`. Evidence: `main.py:450-468`.
- SQL query construction and execution occur in `/listservices`; database bootstrap creates both public and secret tables. Evidence: `main.py:472-505`, `main.py:647-656`.
- JWT creation, verification, algorithm dispatch and public key exposure occur under `/user`, `/user/login`, and `/user/jwks`. Evidence: `main.py:179-279`, `main.py:510-573`.
- Key material can come from local files or generated temp files. Evidence: `main.py:107-123`.
- Database credentials may be passed via CLI arguments for external databases. Evidence: `main.py:581-586`, `README.md:46-48`.

## Assumptions And Unknowns

- The repository appears intentionally educational based on README and `vulnerability_index.md`; no production deployment context is present.
- Git history could not be inspected because `git status` reported that this directory is not a Git repository.
- No runtime execution was performed because the task requested repository intelligence and source code preservation; startup behavior was established from source and documentation.
- No external database was running or required for this assessment; optional database behavior was inferred from code and Docker setup documentation.
- There may be behavior differences across database engines because each driver/database has distinct SQL dialect and connection semantics; only code-level setup paths were traced.
- The `-d/--debug` count argument is parsed but no direct use of `args.d` was found in runtime startup.

## Completion Check

- Application purpose, business functionality and repository scope: addressed.
- Languages, frameworks, runtimes, libraries and dependency ecosystem: addressed.
- Repository structure and major components: addressed.
- Responsibilities and relationships between components: addressed with source references.
- Application architecture and layers: addressed.
- Entry points and startup/bootstrap sequence: addressed from source.
- Runtime processes, services, workers and scheduled jobs: addressed.
- APIs/routes/controllers/handlers and external interfaces: addressed.
- Request and execution flows through major components: addressed.
- Databases, data models, persistence layers and storage: addressed.
- Important data flows: addressed.
- External APIs, third-party services, integrations and webhooks: addressed.
- Authentication and authorization implementation: addressed.
- Configuration, environment variables and deployment/runtime setup: addressed.
- Build, test and CI/CD structure: addressed.
- Security-relevant interfaces and sensitive processing: identified without vulnerability assessment or remediation.
- Source code was not modified.
