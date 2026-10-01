# Security Finding Closure Assessment

Report: Scan Report-12  
Target: All validated ThreatForge logical findings  
Module: `main.py`  
Source code modified: No

## Decision Summary

10 findings are ready to close as **Closed - Fix Verified**.

1 finding, **TF-008**, is **Rework Required - Partially Resolved** because the original config oracle is fixed, but related-path verification found a regression candidate: a valid signed selector for an unviewable config key raises a `TypeError` instead of returning a generic invalid-key response.

| Finding | Closure Decision |
| --- | --- |
| TF-001 eval RCE | Closed - Fix Verified |
| TF-002 command injection | Closed - Fix Verified |
| TF-003 pickle cookie deserialization | Closed - Fix Verified |
| TF-004 SSTI | Closed - Fix Verified |
| TF-005 SQL injection | Closed - Fix Verified |
| TF-006 JWT algorithm confusion | Closed - Fix Verified |
| TF-007 unsafe XML parser | Closed - Fix Verified |
| TF-008 config selector oracle | Rework Required - Partially Resolved |
| TF-009 raw HTML rendering | Closed - Fix Verified |
| TF-010 temporary JWT key files | Closed - Fix Verified |
| TF-011 missing cookie flags | Closed - Fix Verified |

## Closure Basis

The assessment used the full lifecycle evidence:

- Original findings from Scan Reports 4 and 5
- Triage, deduplication, and correlation from Scan Report 6
- Priority decisions from Scan Report 7
- Remediation plan and implemented remediation from Scan Reports 8 and 9
- Targeted verification from Scan Report 10
- Related-path verification from Scan Report 11
- Current `main.py` implementation evidence

## Closed Findings

The following findings have sufficient closure evidence:

- **TF-001**: `eval` attack path removed; constrained AST evaluator rejects code execution payloads while arithmetic still works.
- **TF-002**: shell command path removed; DNS lookup validates input and shell metacharacter variants are rejected.
- **TF-003**: pickle deserialization removed; signed JSON cookies reject unsigned, tampered, and legacy pickle-like values.
- **TF-004**: user input no longer becomes Jinja template source; SSTI payloads render inertly.
- **TF-005**: service filter query is parameterized; SQLi variants did not expose secrets or alter the table.
- **TF-006**: JWT verification is RS256-only; HS256 and unsigned admin tokens are rejected.
- **TF-007**: XML parser disables unsafe DTD/entity/network behavior; XXE probes did not disclose external content.
- **TF-009**: dynamic HTML output is escaped or rendered as data; representative XSS paths are blocked.
- **TF-010**: fallback JWT keys remain in memory; predictable temp key files are gone.
- **TF-011**: cookie writers set HttpOnly and SameSite, with Secure under HTTPS request context.

## Rework Required

**TF-008: AES-CBC config selector padding/decryption oracle**

Closure decision: **Rework Required - Partially Resolved**

The original security condition has been substantially addressed: `/config` no longer accepts unauthenticated AES-CBC ciphertext, malformed selectors fail generically, and approved signed selectors work.

Closure is blocked by related-path evidence from Scan Report 11:

```text
TF-008-R1: signed unviewable selector raises TypeError: can only concatenate str (not "NoneType") to str
```

No secret disclosure was observed, and no external signing route was identified. Still, application behavior is not fully consistent with the intended generic invalid-key handling. Before closing TF-008, `/config` should return a generic invalid-key response whenever the decoded key is outside the `viewable` allowlist.

## Overall Conclusion

The remediation set is effective for the original attack paths. Close the 10 verified findings now. Keep TF-008 open for focused rework on the related config-selector error path, then re-run targeted and related-path verification for TF-008 only.
