# Deduplication Map

| Logical ID | Consolidated Finding | Source Findings | Decision |
|---|---|---|---|
| TF-001 | Unauthenticated Python eval code execution | BF-001, MAINPY-001 | Duplicate: same route, sink, source, and root cause. |
| TF-002 | OS command injection in DNS lookup | BF-002, MAINPY-002 | Duplicate: same `rp("nslookup " + address)` path. |
| TF-003 | Pickle deserialization of client cookie | BF-003, MAINPY-003 | Duplicate: same `pickle.loads` on client cookie. |
| TF-004 | Server-side template injection | BF-004, MAINPY-004 | Duplicate: same `render_template_string` template-source construction. |
| TF-005 | SQL injection in category filter | BF-005, MAINPY-005 | Duplicate: same SQL interpolation and `cursor.execute`. |
| TF-006 | JWT algorithm confusion | BF-006, MAINPY-006 | Duplicate: same untrusted JWT `alg` dispatch and admin `sub` trust. |
| TF-007 | Unsafe XML parser configuration | BF-007, MAINPY-007 | Duplicate: same lxml parser options. |
| TF-008 | AES-CBC config selector oracle | BF-008, MAINPY-010 | Duplicate: same `/config` decrypt/unpad oracle. |
| TF-009 | Raw HTML rendering of attacker-influenced values | BF-009, MAINPY-008 | Duplicate with scope expansion: MAINPY-008 adds `/listservices`; same missing output-encoding control. |
| TF-010 | Predictable temporary JWT private key storage | BF-010, MAINPY-009 | Duplicate: same startup fallback key-writing behavior. |
| TF-011 | Authentication cookie missing flags | BF-011, MAINPY-011 | Duplicate: same `resp.set_cookie(AUTH_COOKIE, token, expires=exp)`. |

## Related But Separate

- TF-001, TF-002, TF-003, and TF-004 all can lead to process authority, but each has a different source-to-sink path and broken control.
- TF-006, TF-010, TF-011, and TF-009 can combine in token forgery or token theft paths, but each represents a separate control failure.
- TF-005 and TF-009 both touch `/listservices`, but SQL query integrity and output encoding are separate issues.
