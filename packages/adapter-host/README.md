# Mojing Adapter Host

This package is the standalone Mojing-authored open Adapter Host, compatibility-matrix format and general deterministic text reference Adapter. It reuses the public `@mojing/adapter-sdk` contract to register, discover, invoke, cancel and revoke adapter versions while emitting content-minimal ordered audit evidence.

Invocation requires an unexpired, exact adapter-id-and-version-scoped and permission-scoped grant issued by an external authority. The host never grants approval, performs formal writes, retains grants or credentials, stores invocation input, accesses authoritative data, opens a network connection or depends on a private approval channel. The reference Adapter only performs deterministic text transforms and returns a candidate.

The included compatibility matrix is isolated-fixture evidence, not real third-party, production, security or organization-external distribution validation. Decision 19 assigns Apache-2.0 only to this Mojing-authored artifact and its declared public exports. `private: true` prevents external publication without separate authorization.
