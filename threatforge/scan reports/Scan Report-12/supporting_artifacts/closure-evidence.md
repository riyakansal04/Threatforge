# Closure Evidence Notes

## Lifecycle Trace

The closure decision used the full lifecycle:

1. Scan Reports 4 and 5 identified duplicate findings.
2. Scan Report 6 deduplicated them into logical findings TF-001 through TF-011.
3. Scan Report 7 prioritized remediation.
4. Scan Report 9 documented implementation of fixes in `main.py`.
5. Scan Report 10 verified the original attack paths: 11/11 findings verified fixed and 16/16 focused checks passed.
6. Scan Report 11 checked related paths: 37/37 checks passed for the underlying weaknesses and identified regression candidate TF-008-R1.

## Closure Outcome

Closed:

- TF-001
- TF-002
- TF-003
- TF-004
- TF-005
- TF-006
- TF-007
- TF-009
- TF-010
- TF-011

Rework required:

- TF-008, because TF-008-R1 shows a signed unviewable config selector can trigger a `TypeError`.

## TF-008 Closure Blocker

The original AES-CBC padding/decryption oracle is no longer observed. The blocker is a related-path behavior defect:

```text
TypeError: can only concatenate str (not "NoneType") to str
```

This occurs when a signed selector decodes to a key outside the `viewable` allowlist. The recommended closure condition is to return generic invalid-key handling for decoded keys that are not viewable.

## Source Modification Statement

No source code was modified during this closure assessment. Only report artifacts under `Scan Report-12` were created.
