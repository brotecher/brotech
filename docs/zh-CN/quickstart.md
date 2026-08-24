# 中文入门指南

## 先用一句话理解

墨境开放协议规定“数据和能力应该怎样描述”，开放运行组件则提供“怎样安全地连接和执行”的基础代码。它们让外部开发者不需要墨境私有源码，也能制作兼容工具。

可以把它想成 USB 标准：公开的是插头形状、通信规则和测试方法，不是电脑里的私人文件，也不是制造商的全部产品。

## 谁会使用

- 想把自己的模型、Agent 或工具接入墨境的开发者。
- 想生成、读取或检查墨境 Workflow、Node、Run 数据的开发者。
- 想在本地运行受限 Agent，并检查权限、费用和执行证据的开发者。
- 想制作迁移工具、测试工具、网关或兼容客户端的团队。

普通墨境最终用户通常不需要直接操作这些包。

## 八个目录分别是什么

| 目录                    | 白话说明                                   |
| ----------------------- | ------------------------------------------ |
| `protocol-spec`         | 数据格式、类型和校验规则                   |
| `adapter-sdk`           | 第三方能力接入的标准接口                   |
| `agent-runtime`         | 受限 Agent 的本地执行器                    |
| `capability-matcher`    | 判断某项能力是否满足要求                   |
| `gateway-core`          | 校验外部授权和调用边界的参考网关           |
| `open-tool-conformance` | 检查 MCP、A2A、OpenAPI、Webhook 等工具语义 |
| `comfy-api-client`      | 完全原创的 Comfy 公共 API 客户端边界       |
| `adapter-host`          | 登记、调用、撤销适配器的独立宿主           |

如果你只是第一次了解，先看 `agent-runtime` 和 `adapter-sdk`，其他目录可以暂时忽略。

## 第一次运行

安装 Node.js 24.19.0 和 pnpm 11.21.0，然后执行：

```sh
git clone https://github.com/brotecher/brotech.git
cd brotech
pnpm install --ignore-scripts
pnpm run build
```

运行最小 Agent：

```sh
pnpm run example:agent
```

成功时会输出一个 JSON 结果，其中包含：

- `answer: 42`：Agent 调用了本地工具计算 19 + 23。
- `formalWrite: false`：结果只是候选，没有正式写入。
- `platformSurcharge.amount: 0`：没有墨境按工具调用附加费。

运行最小适配器：

```sh
pnpm run example:adapter
```

成功时会输出转换后的文本、适配器证据和 `formalWrite: false`。

## 下一步：开发自己的适配器

1. 阅读 `packages/adapter-sdk/PUBLIC_EXPORTS.json`，确认哪些 API 是稳定公共出口。
2. 用 `defineAdapter` 声明名称、版本、能力、权限、成本和兼容范围。
3. 实现 `run`，只返回候选结果和证据，不执行正式写入。
4. 明确披露不支持的取消、恢复或流式能力。
5. 运行构建、单测和一致性检查，并提供 SBOM、许可证和安全说明。

公开示例故意使用合成数据。接入真实服务时，凭据、生产授权、正式审批和正式写入必须留在你自己的安全边界中，不能塞进适配器源码。

## 它不能给你什么

公开仓库不会提供：

- 墨境闭源界面或控制平面。
- 正式审批权或正式数据写入权。
- 墨境用户数据、数据库、凭据或长期密钥。
- 供应商商业选择、生产安全认证或兼容性承诺。
- npm 发布包；当前只授权 GitHub 源码发布。

## 如何反馈“文档看不懂”

请在 GitHub Issue 中写明你停在哪一步、执行了什么命令、看到了什么结果，以及你原本以为会发生什么。场景 33 和 35 的独立验证入口分别是 [Issue #2](https://github.com/brotecher/brotech/issues/2) 和 [Issue #1](https://github.com/brotecher/brotech/issues/1)。
