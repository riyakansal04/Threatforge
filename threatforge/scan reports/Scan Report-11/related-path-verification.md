# Related-Path Remediation Verification

Report: Scan Report-11  
Target: All validated ThreatForge findings  
Module: `main.py`  
Scope: Related-path regression check only; no broad repository security scan was performed.  
Source code modified: No

## Summary

The same underlying security weakness was **not observed** through related application paths for all 11 remediated findings.

Runtime related-path checks: **37/37 passed**.

One related regression candidate was identified and linked to TF-008:

| ID | Classification | Detail |
| --- | --- | --- |
| TF-008-R1 | New or regression issue introduced | A valid signed selector for an unviewable config key does not expose the secret, but it raises `TypeError: can only concatenate str (not "NoneType") to str`. This requires a valid signature for an unviewable key; no external signing route was identified. |

## Per-Finding Results

| Finding | Related-Path Classification | Determination |
| --- | --- | --- |
| TF-001 unsafe eval | Security weakness no longer observed | Calls, imports, attributes, and comprehensions were rejected by `safe_eval_expression`; arithmetic still works. |
| TF-002 command injection | Security weakness no longer observed | Shell metacharacter variants failed before DNS lookup; `rp` remains disabled. |
| TF-003 pickle deserialization | Security weakness no longer observed | Unsigned JSON, tampered signed cookies, and legacy pickle cookies are rejected. |
| TF-004 SSTI | Security weakness no longer observed | Related template payloads render inertly through the static-template variable path. |
| TF-005 SQL injection | Security weakness no longer observed | UNION, OR, and stacked-query variants did not expose secrets or alter the table; legitimate filtering still works. |
| TF-006 JWT confusion | Security weakness no longer observed | HS256 and unsigned admin tokens are rejected; JWKS advertises RS256 only. |
| TF-007 XXE | Security weakness no longer observed | File and external SYSTEM payloads did not disclose external content. |
| TF-008 config oracle | Security weakness no longer observed; new/regression issue introduced | Original oracle/secret exposure not observed; signed unviewable selector causes a server error. |
| TF-009 HTML injection | Security weakness no longer observed | Related output paths escape dynamic data or return generic errors. |
| TF-010 temporary key file exposure | Security weakness no longer observed | Fallback key material is in memory; temporary key filenames are absent. |
| TF-011 missing cookie flags | Security weakness no longer observed | Value and auth cookies include HttpOnly/SameSite; HTTPS-context cookies include Secure. |

## Regression Candidate

**TF-008-R1: signed unviewable config selector raises server error**

Evidence:

```text
REGRESSION-CANDIDATE: TF-008 signed unviewable selector raises TypeError: can only concatenate str (not "NoneType") to str
```

Reasoning: `/config` decodes the signed token into `decrypted_key`. If the decoded key is not in the `viewable` allowlist, `config_out` remains `None`, but the response-building expression checks `if decrypted_key` and concatenates `config_out`. This does not recreate the original config oracle or expose `secret_admin_value`, but it is a related robustness/security regression candidate if a valid signed token for an unviewable key can be obtained.

Recommended follow-up: return the same generic invalid-key response whenever the decoded key is not in `viewable`, before building the config-value HTML.

## Runtime Evidence

```text
37/37 related-path regression checks passed
REGRESSION-CANDIDATE: TF-008 signed unviewable selector raises TypeError: can only concatenate str (not "NoneType") to str
```

## Coverage

Checked related endpoints and helpers:

- `/evaluate`, `safe_eval_expression`
- `/lookup`, `dns_lookup`, `rp`
- `/cookie`, `make_cookie_value`, `read_cookie_value`, signing helpers
- `/sayhi`, `render_template_string`
- `/listservices`, request-driven `cursor.execute`
- `/user`, `/user/login`, `/user/jwks`, JWT helpers
- `/xml`, `etree.XMLParser`
- `/config`, config token helpers and viewable allowlist
- JWT fallback key initialization
- cookie writers under HTTP and HTTPS request contexts

Limitations: non-sqlite database drivers were not executed live; request-driven SQL control flow was reviewed statically. No broad repository scan or exhaustive fuzzing was performed by design.
