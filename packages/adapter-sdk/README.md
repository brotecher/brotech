# Mojing Adapter SDK (local M3 slice)

This workspace package contains the provider-neutral adapter contract, fixed example executors, conformance runner, native-source three-way comparison, and generated-adapter candidate gates used by the M3 local acceptance fixtures.

It deliberately has no runtime dependency on the internal `@mojing/contracts` aggregation package and no database, credential, network, subprocess, or private-control-plane dependency. Its recursive `AdapterValue` is a package-local neutral JSON value contract. Decision 19 assigns Apache-2.0 to this Mojing-authored open middleware artifact. Its source is published at `https://github.com/brotecher/brotech`; `private: true` continues to prevent unauthorized npm registry publication. A passing local suite is not an external compatibility, security, signature, independent-third-party, or production claim.
