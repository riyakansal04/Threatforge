# Priority Rationale

## Why Immediate Attention Starts With TF-001 Through TF-004

The threat model shows that `/evaluate`, `/lookup`, `/cookie`, and `/sayhi` converge on process authority. These paths have unauthenticated reachability and weak or absent controls. Because `main.py` is a shared-process monolith, process compromise can expose JWT keys, config secrets, database cursor state, filesystem and network resources, and can bypass later application controls entirely.

## Why Auth And Database Follow

`TF-006` breaks the JWT verification boundary, but the current app's admin state is limited to a response. `TF-005` is directly reachable and affects database integrity/confidentiality, but backend dialect and DB privileges influence impact. Both are important and should be near-term rather than deferred.

## Why XML Is Near-Term

`TF-007` is unauthenticated and easy to harden, but exact XXE/SSRF/file-disclosure behavior depends on runtime lxml/libxml2 and deployment policy. It remains near-term because the unsafe parser configuration itself is source-confirmed.

## Why Planned Items Are Still Security-Relevant

`TF-009`, `TF-010`, `TF-008`, and `TF-011` have meaningful security value, especially in combinations: XSS plus non-HttpOnly auth cookie, key exposure plus JWT forgery, and config oracle plus sensitive process state. They are planned rather than immediate because their standalone exploitability or impact is lower or more deployment-dependent.

## Not Severity Alone

The queue intentionally places `TF-004` above some high-severity/auth/database issues because remediation is simple and exploitability is strong. It also keeps low-severity `TF-011` in the planned queue despite low complexity because direct execution and auth/data boundaries carry more immediate risk.
