# Source References

## Primary Architecture Source

- `Scan Report-1\ApplicationIntelligence.json` was used as the primary source for application architecture, components, interfaces, data flows, storage mechanisms, and security-relevant implementation.
- `Scan Report-1\ApplicationArchitectureReport.md` supplied the narrative architecture and execution-flow analysis.
- `Scan Report-1\SourceReferences.md` supplied previously verified source-reference anchors.

## Purpose And Intent

- `README.md:4` describes the application as a simple vulnerable Flask application.
- `README.md:6-8` states it is for testing and learning exploitation of common web application vulnerabilities.
- `README.md:10-18` lists intentionally present vulnerability classes.
- `vulnerability_index.md:7-14` maps route numbers to vulnerability categories.

## Application Entrypoints And Runtime

- `main.py:21` imports Flask request/response primitives and `render_template_string`.
- `main.py:296` creates the Flask app.
- `main.py:299-316` implements the index route and links the feature routes.
- `main.py:320-572` implements the route handlers analyzed in the threat model.
- `main.py:577-592` parses runtime CLI arguments.
- `main.py:598-618` selects optional database drivers.
- `main.py:620-656` connects to and initializes the selected database.
- `main.py:661` starts the Flask server.
- `README.md:42-48` documents the default local run and an external PostgreSQL example.

## Assets And Sensitive Operations

- `main.py:24-45` initializes random key material, app constants, and CONFIG values.
- `main.py:47-82` defines database tables and seed data, including `public_stuff` and `secret_stuff`.
- `main.py:107-124` reads RSA key files from environment variables or generates/writes temporary keys.
- `main.py:140-168` implements AES-CBC pad, unpad, encrypt, and decrypt helpers.
- `main.py:171-172` executes a command through `os.popen`.
- `main.py:179-278` implements JWT creation and verification helper functions.

## Threat Scenario Evidence

- T001 cookie deserialization: `main.py:320-346`, especially `main.py:328-329` and `main.py:346`; `vulnerability_index.md:7`.
- T002 command execution: `main.py:171-172`, `main.py:353-360`; `vulnerability_index.md:8`.
- T003 Python eval: `main.py:372-379`; `vulnerability_index.md:9`.
- T004 XML parser behavior: `main.py:392-405`, especially `main.py:397`; `vulnerability_index.md:10`.
- T005 config decryption oracle: `main.py:39-45`, `main.py:140-168`, `main.py:417-443`; `vulnerability_index.md:11`.
- T006 server-side template rendering: `main.py:450-468`; `vulnerability_index.md:12`.
- T007 SQL query manipulation: `main.py:49-82`, `main.py:472-490`, `main.py:583`, `main.py:647-656`; `vulnerability_index.md:13`.
- T008 JWT algorithm selection: `main.py:32`, `main.py:179-190`, `main.py:216-277`, `main.py:510-536`, `main.py:540-550`; `vulnerability_index.md:14`.
- T009 deployment/configuration amplification: `README.md:42-52`, `main.py:107-124`, `main.py:580-589`, `main.py:620-656`, `docker_database_setup.md:7-101`.

## Assumptions And Unknowns

- Production deployment topology is unknown; no deployment manifest, WSGI entrypoint, reverse proxy, container spec, or service configuration was observed in the file inventory.
- No runtime route execution, exploit validation, or security scan was performed for this threat model.
- Database privileges for external backends are deployment-specific and depend on operator-provided credentials.
- Network exposure is deployment-specific. The documented default is localhost, but bind address is configurable.

