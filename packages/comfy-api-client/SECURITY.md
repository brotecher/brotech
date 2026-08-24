# Security policy

This artifact is a pre-publication, fixture-tested request-construction library, not a production network or isolation boundary. It intentionally does not implement credential storage, network transport, asset mounting, output takeover, approval or formal writes. Remote target selection requires an explicit caller option, but the caller remains responsible for authorization, address policy, DNS rebinding protection, TLS, credentials, rate/size limits and revocation.

Report suspected vulnerabilities through the repository owner's authorized private channel. Do not place secrets, credentials, personal data, production data or exploit payloads in a public issue. There is currently no public disclosure mailbox or bounty program; organization-external disclosure coordination requires separate authorization.

Passing local tests does not establish real ComfyUI compatibility, production isolation, security certification or safe distribution.
