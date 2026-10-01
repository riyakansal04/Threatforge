# Supporting Evidence

## Static Verification

`python -m py_compile main.py` completed successfully.

Focused sink/control pattern scan reviewed the following post-remediation indicators:

- `ALLOWED_ALGORITHMS = ['RS256']`
- Hardened `etree.XMLParser(no_network=True, dtd_validation=False, load_dtd=False, resolve_entities=False, huge_tree=False)`
- Parameterized service query at `cursor.execute(query_build('SELECT * from public_stuff{}'.format(where)), tuple(params))`
- Cookie-setting paths include `httponly=True`, `samesite='Lax'`, and `secure=request.is_secure`
- No remaining `eval(`, `popen`, `pickle`, `private.pem`, `public.pem`, `verify_token_none`, `verify_token_hs256`, or `create_token_hs256` finding paths

## Runtime Verification

```text
Environment variables "PRIVATE_KEY_FILE" and "PUBLIC_KEY_FILE" not set, generating in-memory temporary keys.
PASS: TF-001 arithmetic expressions still work
PASS: TF-001 code execution call rejected
PASS: TF-002 shell metachar lookup rejected
PASS: TF-011 cookie HttpOnly present
PASS: TF-003/TF-009 signed JSON cookie displayed escaped
PASS: TF-003 legacy pickle cookie rejected safely
PASS: TF-004 SSTI payload rendered as text, not evaluated
PASS: TF-005 normal category query still works
PASS: TF-005 SQL injection payload does not expose secret table
PASS: TF-011 auth cookie HttpOnly present
PASS: TF-006 valid RS256 login remains accepted
PASS: TF-006 alg None JWT rejected generically
PASS: TF-007 XXE entity is not resolved
PASS: TF-008 config listing still renders
PASS: TF-008 tampered config selector fails generically
PASS: TF-008 signed config selector resolves approved key

16/16 focused verification checks passed
```

## Source Modification Statement

No source code was modified during this verification stage. Only report artifacts under `Scan Report-10` were created.
