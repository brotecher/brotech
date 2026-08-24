# Mojing protocol `1.0.0`

## Version boundary

The eight families are `PRT-ID`, `CAP`, `NODE`, `WORKFLOW`, `RUN`, `CHANGE`, `APP`, and `CANVAS`. Every family version is the exact opaque string `1.0.0`. Compatibility is proven through explicit `compatible`, `incompatible`, or `unknown` outcomes; `unknown` is never treated as compatible.

## Required compatibility paths

The paths StableRef→all families, APP→WORKFLOW, WORKFLOW→NODE/CAP/CANVAS, NODE→CAP, RUN→WORKFLOW/NODE/CAP/data, and CHANGE→review/formal acceptance must all be `compatible`. A missing rule, input, version, or contract result makes the path `unknown`.

## Responsibility boundary

- CanvasKernel owns domain-neutral nodes, edges, typed ports, connection rules, selection, layout, serialization and test seams. It contains no domain Schema or supplier types.
- Workflow Adapter maps approved workflow semantics, form/preview/review state and ChangeSet decisions to the Kernel. Layout-only changes do not create a domain ChangeSet.
- The XYFlow adapter remains outside the public CANVAS contract. `@xyflow/react@12.11.2` is the current implementation dependency, not a public protocol type.

## Cross-cutting protocol boundary

| Topic           | Defined in protocol `1.0.0`                                                                               | Outside this protocol version                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Cost            | estimate/actual/fixed mode, amount, unit, source and budget outcome; zero may not be fabricated           | real pricing, billing and payment before a paid capability is enabled                 |
| Side effects    | none/read/candidate/formal-write/delete/external-send/permission-change and approval mode                 | real external integration and compensation before the first corresponding integration |
| Timeout         | scope, start point, terminal outcome, cost and candidate handling                                         | distributed clocks and recovery implementation                                        |
| Retry           | retryable errors, maximum attempts, fixed/no backoff, version and idempotency requirements                | supplier-specific and long-running scheduling; before supplier integration            |
| Cancel          | request/confirmation state, terminal state and late-result discard                                        | cross-device recovery and hard termination guarantee                                  |
| Cache           | key covers capability, implementation, input, permission and data exact versions; writes are not reusable | distributed cache infrastructure after cache correctness evidence                     |
| Idempotency     | key scope, effect identity, same-key/same-input result and same-key/different-input conflict              | distributed locking implementation                                                    |
| Publish         | immutable version, dependencies, permission, compatibility, validation, approval and rollback entry       | marketplace, signature, purchase and team distribution                                |
| Dependency lock | exact protocol references and compatibility outcomes                                                      | runtime, package manager and resolved dependency lock implementation                  |
| App lifecycle   | install/enable/disable/upgrade/rollback/uninstall, data owner and no silent permission growth             | licensing, organization deployment, telemetry and billing                             |

## Place and relation compatibility

Legacy `place` maps read-only to `mj.core/location`; legacy `relation` maps read-only to `mj.core/relationship`. Both are compatible representation differences because StableRef and product behavior remain intact. Any later write migration requires an explicit product change.

This document defines protocol compatibility only; it does not authorize product writes or external side effects.
