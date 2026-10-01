# Implementation Notes

This report is suggestion-only. Source code was not modified.

## Recommended Fix Order

1. `TF-001` - replace `eval`.
2. `TF-002` - remove shell command execution.
3. `TF-003` - replace pickle cookie state.
4. `TF-004` - fix template-source injection.
5. `TF-006` - pin JWT verification to RS256.
6. `TF-005` - parameterize SQL.
7. `TF-007` - harden XML parser settings.
8. `TF-009` - centralize escaped/template rendering.
9. `TF-010` - stop predictable temp private key writes.
10. `TF-008` - replace CBC selector tokens with signed/authenticated tokens.
11. `TF-011` - add auth cookie flags.

## Batch Advice

The first four findings all protect the same shared-process boundary. They can be remediated as one high-priority batch if the team is ready to validate several routes at once. Otherwise, fix and validate them one at a time in priority order.

## Compatibility Notes

- The app appears intentionally vulnerable for training. If preserving vulnerable behavior is a learning goal, implement fixes behind an explicit safe mode rather than silently leaving deployable defaults vulnerable.
- Multiple fixes interact: output escaping and cookie flags both reduce token-theft impact; JWT pinning and key storage both protect token integrity.
