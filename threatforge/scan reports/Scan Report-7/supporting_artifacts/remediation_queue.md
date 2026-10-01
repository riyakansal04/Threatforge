# Remediation Queue

## Immediate Attention

1. `TF-001` - Unauthenticated Python eval code execution.
2. `TF-002` - OS command injection in DNS lookup.
3. `TF-003` - Pickle deserialization of client cookie.
4. `TF-004` - Server-side template injection.

These are first because they expose unauthenticated input to process or host execution boundaries with minimal controls. They dominate the risk landscape by potentially exposing keys, database state, config, host files, and downstream application logic.

## Near-Term Remediation

5. `TF-006` - JWT algorithm confusion and None acceptance.
6. `TF-005` - SQL injection in listservices category filter.
7. `TF-007` - Unsafe XML parser configuration.

These should follow the execution-class issues. They affect authentication integrity, database authority, and parser/file/network resource boundaries.

## Planned Remediation

8. `TF-009` - Raw HTML rendering of attacker-influenced values.
9. `TF-010` - Predictable temporary JWT private key storage.
10. `TF-008` - AES-CBC config selector oracle.
11. `TF-011` - Authentication cookie missing security attributes.

These remain important, especially in combination with auth/token issues, but have lower standalone exploitability or more deployment-dependent impact than the first two queues.

## Further Validation Track

1. `TC-002` - Validate exact lxml external resource behavior.
2. `TC-003` - Validate generated temp key exposure through host ACLs/logs.
3. `TC-001` - Run dependency advisory/SCA lookup.

## Capacity Note

No capacity limit was supplied. If only three fixes can be handled in the first cycle, address `TF-001`, `TF-002`, and `TF-003`.
