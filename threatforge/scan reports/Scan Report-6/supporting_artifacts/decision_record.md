# Triage Decision Record

## Context Used

- Repository intelligence established that `main.py` is the monolithic Flask app containing all routes, helpers, database bootstrap, and startup.
- Architecture and threat model identified the route trust boundaries and shared-process impact.
- Security baseline and prior scan results supplied the initial finding set.
- Source evidence in `main.py` was re-read to verify each claim.
- No `SECURITY.md` was present; this is recorded as a policy proof gap.

## Classification Rules Applied

- `Confirmed`: implementation evidence supports the reported weakness, the path is reachable in the documented app surface, no existing control defeats the issue, and source code has not addressed it.
- `Requires validation`: static evidence identifies a plausible issue or runtime-dependent impact, but dependency state, host ACLs, parser runtime behavior, or deployment controls are needed to close the proof gap.
- `False positive`: not used; no supplied finding was defeated by static evidence.
- `Already addressed`: not used; source code still contains the reported vulnerable paths.
- `Likely valid`: not used; each reported implementation issue had enough static evidence for confirmed classification.

## Key Decisions

- The 11 findings in `Scan Report-4` and the 11 findings in `Scan Report-5` are duplicates by implementation evidence, not merely by title. Each pair points to the same route/helper, same broken control, and same sink.
- The XSS finding was consolidated as one logical finding because the root control is the same missing output encoding across string-built HTML responses. The focused scan expanded the affected paths to include `/listservices`; the consolidated record preserves that expanded evidence.
- XML parser and temp key findings are confirmed as source-level weaknesses, but their maximum practical impact still has runtime/deployment validation candidates.
- Dependency CVE status remains `Requires validation` because no online advisory lookup was performed.
