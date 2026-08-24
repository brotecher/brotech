# @mojing/protocol-spec

墨境公开中立规范制品：协议 `1.0.0` 的 Schema、生成类型、兼容规则、验证规则、固定样例和运行时验证器。包根公共出口只包含中立协议 metadata、类型与验证器，不包含网关、能力路由、Agent Runtime、Adapter SDK、正式批准、正式写入、密钥、商业策略或权威数据能力。

当前仓库已完成制品准备与本地隔离验证，源码现已发布于 `https://github.com/brotecher/brotech`。`private: true` 继续防止未授权的 npm 注册源发布；`license: Apache-2.0` 记录决策 19 对墨境原创制品的许可证裁决。

## Authoritative source

This directory contains the authoritative source for Mojing protocol version `1.0.0`.

Authority flows in one direction:

```text
protocol-registry.json
→ schemas/*.schema.json and rules/protocol-rules.json
→ generated/protocol-types.ts
→ examples/*.json and docs/protocol.md
```

The registry is an index and does not redefine fields or rules. JSON Schema files are the single source for data shape and local constraints. The rule list is the single source for cross-object, state-transition, permission, compatibility and formal-write invariants that Schema alone cannot express. TypeScript is generated and must never be edited by hand. Examples and documentation cite protocol versions, Schema IDs and rule IDs.

The schemas use JSON Schema Draft 2020-12 and intentionally allow only: `$schema`, `$id`, `$defs`, `$ref`, `title`, `type`, `properties`, `required`, `additionalProperties`, `items`, `minItems`, `maxItems`, `uniqueItems`, `minLength`, `pattern`, `enum`, `const`, and `minimum`. The validator fails on any undeclared keyword rather than silently ignoring it.

Protocol validation uses local fixtures only. It does not require a network, real model, database, secret, user data, fee, or formal write.
