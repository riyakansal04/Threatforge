# Related-Path Evidence

## Static Evidence Highlights

- Routes are defined in `main.py`: `/cookie`, `/lookup`, `/evaluate`, `/xml`, `/config`, `/sayhi`, `/listservices`, `/user`, `/user/jwks`, `/user/login`.
- Related helpers are also in `main.py`: `safe_eval_expression`, `dns_lookup`, `rp`, signing helpers, config token helpers, and JWT helpers.
- The original high-risk sinks are absent or constrained:
  - No `eval(` use remains.
  - No `popen` or subprocess shell path remains.
  - No `pickle` import/use remains.
  - JWT verification is RS256-only.
  - XML parser disables network, DTD loading, and entity resolution.
  - Dynamic HTML output paths use escaping or Jinja variable binding.

## Runtime Evidence

```text
PASS: TF-001 eval bypass rejected
PASS: TF-001 eval bypass rejected
PASS: TF-001 eval bypass rejected
PASS: TF-001 eval bypass rejected
PASS: TF-001 arithmetic preserved
PASS: TF-002 shell syntax rejected
PASS: TF-002 shell syntax rejected
PASS: TF-002 shell syntax rejected
PASS: TF-002 shell syntax rejected
PASS: TF-002 shell syntax rejected
PASS: TF-002 rp disabled
PASS: TF-003 unsigned JSON rejected
PASS: TF-003 tampered signed cookie rejected
PASS: TF-003 pickle cookie rejected
PASS: TF-004 template payload inert
PASS: TF-004 template payload inert
PASS: TF-004 template payload inert
PASS: TF-005 SQLi variant blocked
PASS: TF-005 SQLi variant blocked
PASS: TF-005 SQLi variant blocked
PASS: TF-005 table intact
PASS: TF-006 HS256 rejected
PASS: TF-006 unsigned rejected
PASS: TF-006 JWKS RS256 only
PASS: TF-007 DTD/entity no disclosure
PASS: TF-007 DTD/entity no disclosure
PASS: TF-008 visible signed selector works
PASS: TF-008 no secret disclosure on signed unviewable selector
PASS: TF-008 malformed selector generic
PASS: TF-009 cookie escaped
PASS: TF-009 eval error not reflected
PASS: TF-009 JWT subject escaped
PASS: TF-010 fallback keys in memory
PASS: TF-011 HTTP value flags
PASS: TF-011 HTTP auth flags
PASS: TF-011 HTTPS value Secure
PASS: TF-011 HTTPS auth Secure
REGRESSION-CANDIDATE: TF-008 signed unviewable selector raises TypeError: can only concatenate str (not "NoneType") to str

37/37 related-path regression checks passed
```

## Source Modification Statement

No source code was modified during related-path verification. Only report artifacts under `Scan Report-11` were created.
