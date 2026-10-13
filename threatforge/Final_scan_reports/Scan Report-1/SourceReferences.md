# Source References

## Repository Purpose

- `README.md:1` names the project "Breakable Flask".
- `README.md:4` describes it as "A simple vulnerable Flask application."
- `README.md:6-8` states it is for testing and learning exploitation of common web application vulnerabilities and was intended as a simple single-file vulnerable app.
- `README.md:10-18` lists the intentionally present vulnerability classes.
- `vulnerability_index.md:7-14` maps the numbered routes to vulnerability categories.

## Runtime And Dependencies

- `main.py:1` uses a Python 3 shebang.
- `main.py:2-21` imports standard libraries, JWT, lxml, pycryptodome, and Flask.
- `requirements.txt:1-8` lists base runtime dependencies.
- `database-requirements.txt:1-5` lists optional database driver dependencies.
- `README.md:40-54` documents running the app and alternate database configuration.

## Configuration, Secrets, And Data Definitions

- `main.py:24-36` defines random key material, app metadata, JWT constants, and user names.
- `main.py:39-45` defines the `CONFIG` dictionary.
- `main.py:47-82` defines database name, table metadata, and seed data.
- `main.py:86-124` defines RSA key helper functions and key-loading/generation behavior.

## Cryptographic And Token Helpers

- `main.py:140-168` implements padding, AES-CBC encryption, and AES-CBC decryption helpers.
- `main.py:179-190` creates RS256 JWTs.
- `main.py:193-208` manually creates HS256 JWTs.
- `main.py:211-278` verifies RS256, HS256, and None JWT variants.
- `main.py:283-293` defines an additional HS256 token helper.

## Flask Routes

- `main.py:296` creates the Flask app object.
- `main.py:299-316` implements `GET /`.
- `main.py:320-348` implements `GET|POST /cookie`.
- `main.py:353-368` implements `GET|POST /lookup`.
- `main.py:372-387` implements `GET|POST /evaluate`.
- `main.py:392-413` implements `GET|POST /xml`.
- `main.py:417-446` implements `GET /config`.
- `main.py:450-468` implements `GET|POST /sayhi`.
- `main.py:472-504` implements `GET /listservices`.
- `main.py:510-528` implements `GET /user`.
- `main.py:531-536` implements `GET /user/jwks`.
- `main.py:540-572` implements `GET|POST /user/login`.

## Startup And Database Flow

- `main.py:577-592` parses command-line arguments.
- `main.py:594` defines the SQL query suffix helper.
- `main.py:598-618` selects database drivers and list queries.
- `main.py:620-645` connects to the selected database.
- `main.py:647-656` discovers existing tables, creates missing tables, and inserts seed data.
- `main.py:661` starts the Flask server.
- `docker_database_setup.md:7-101` documents optional Docker database setup.

## Security-Relevant Operations Identified As Architecture Facts

- `main.py:329` deserializes a client cookie with `pickle.loads`.
- `main.py:171-172` executes commands through `os.popen`.
- `main.py:360` passes a form-derived address into `nslookup`.
- `main.py:379` evaluates form input with `eval`.
- `main.py:397` creates an XML parser with network access and DTD loading.
- `main.py:428-433` returns decrypt/unpad errors from `/config`.
- `main.py:454-468` interpolates form input into a template rendered by Jinja.
- `main.py:476-484` builds SQL with a query-string parameter.
- `main.py:267-277` dispatches JWT verification based on the unverified `alg` header.

