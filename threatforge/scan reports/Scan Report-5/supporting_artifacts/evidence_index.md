# Evidence Index

## Context Inputs Used

- `Scan Report-1/repository_intelligence.md`: established that `main.py` contains the whole Flask application, routes, helpers, database bootstrap, and startup path.
- `Scan Report-1/architecture.md`: confirmed route-to-helper relationships and shared process state.
- `Scan Report-2/threat_model.md`: supplied threat traces T1 through T8 for process authority, auth/JWT, database, config crypto, and parser/resource boundaries.
- `Scan Report-3/pre_scan_assessment.md`: supplied baseline focus areas and security-critical components.
- `Scan Report-4/assessment.json`: supplied prior confirmed findings and candidates.
- `requirements.txt`: confirmed security-relevant libraries including Flask, Jinja2, lxml, and PyCryptodome.
- `vulnerability_index.md`: confirmed the app is intentionally vulnerable and maps numbered routes to intended vulnerability classes.

## Source Evidence Anchors

- `main.py:107-123`: JWT key loading or predictable temp key generation.
- `main.py:140-168`: AES-CBC padding, encryption, and decryption helpers.
- `main.py:171-172`: `rp()` wrapper around `os.popen`.
- `main.py:211-279`: JWT verification helpers and untrusted algorithm dispatch.
- `main.py:320-350`: `/cookie` route, client cookie deserialization, raw response concatenation.
- `main.py:353-367`: `/lookup` route, command construction.
- `main.py:372-386`: `/evaluate` route, `eval`.
- `main.py:392-411`: `/xml` route, lxml parser settings.
- `main.py:417-446`: `/config` route, decryption oracle and config selection.
- `main.py:450-468`: `/sayhi` route, `render_template_string` with user-controlled template source.
- `main.py:472-505`: `/listservices` route, SQL construction and DB/error rendering.
- `main.py:510-537`: `/user` and `/user/jwks`, JWT trust and admin state.
- `main.py:540-573`: `/user/login`, JWT issuance and cookie flags.
- `main.py:577-661`: startup, address selection, database connector selection, schema creation, seed inserts, server run.

## Candidate Validation Gaps

- Dependency CVE status was not checked online.
- lxml/libxml2 exact external resource behavior was not reproduced at runtime.
- Temporary key file exposure depends on host ACLs and log handling.
