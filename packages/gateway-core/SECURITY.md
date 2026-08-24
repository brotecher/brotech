# Security policy

This artifact is pre-publication reference material, not a production security boundary. Supported security review currently covers only the version in this workspace and its deterministic local tests. The reference edge proxy uses injected fixture transport, accepts no network address or credential, rejects offline commands, and cannot verify an external authority's identity itself; a real deployment must provide authenticated lease and signature verification, network isolation, resource limits, safe-stop behavior and device-specific controls outside this package.

Report suspected vulnerabilities through the repository owner's authorized private channel. Do not place secrets, credentials, personal data, production data or exploit payloads in a public issue. There is currently no public disclosure mailbox or bounty program; organization-external disclosure coordination requires separate authorization.

The maintainers will validate scope, preserve evidence, assess affected public exports and dependencies, and record remediation or an explicit limitation before any release decision. Passing local tests does not certify deployment safety.
