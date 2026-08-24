# Mojing original Comfy public API client (M3 fixture scope)

This package is a completely Mojing-authored client boundary for constructing requests to the public API route families named by the Mojing product specification. It captures Workflow JSON, API Format and image-metadata payloads as immutable source snapshots, preserves unknown payloads, separates source/graph/execution fidelity, and exposes a versioned compatibility information model.

The included compatibility declaration is `fixture-only`: no ComfyUI Core, Frontend or Desktop code is imported, linked, copied, modified, installed, run or packaged; no real instance, event stream, history, cancellation, execution equivalence, Frontend island or distribution combination has been tested. The fixed nodes and payloads are invented Mojing test data and are not copied from a third-party installation.

The client has no built-in network implementation. Callers must inject a transport, and remote targets require `allowRemote: true`; connection permission, credentials, asset exposure, approval, formal writes and authoritative data remain outside this open package. Decision 19 assigns Apache-2.0 only to this Mojing-authored artifact and its declared public exports. `private: true` prevents organization-external publication without separate authorization.
