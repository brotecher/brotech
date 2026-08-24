# Security policy

This artifact is pre-publication open middleware, not a production isolation or authorization service. Supported review covers deterministic registration, external-grant validation, invocation coordination, cancellation signal propagation, revocation and minimal audit behavior in the current workspace fixtures.

The host intentionally cannot create approval, perform formal writes, store credentials, retain grants or access authoritative data. Callers remain responsible for authenticating the external authority, delivering grants securely, isolating adapter code, applying resource/network limits and validating adapter output before any candidate review or formal action.

Report suspected vulnerabilities through the repository owner's authorized private channel. Do not place secrets, credentials, personal data, production data or exploit payloads in a public issue. There is currently no public disclosure mailbox or bounty program; organization-external disclosure coordination requires separate authorization.
