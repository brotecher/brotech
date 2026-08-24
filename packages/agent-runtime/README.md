# @mojing/agent-runtime

这是 M3 的本地 Agent Runtime 技术实现。它不连接墨境闭源控制面、私有批准通道或付费中间件；任务包、工具、权限、限制、检查点、结果和证据使用版本化公开 TypeScript 契约。

决策 19 已将 Agent Runtime 列入采用 Apache-2.0 的墨境原创开放中间层制品。产品所有者已授权将八个开放制品发布到指定的公开 GitHub 仓库，但目标地址尚未提供，公开获取和真实独立第三方验证尚未完成；当前包仍保持 `private: true` 以阻止误发 npm 注册源，不宣称已经发布。

包同时导出厂商无关的模型规划契约。`requestAgentModelPlan` 在接收提供方步骤前固定 Runtime 版本、工作流、夹具、输入、工具精确版本、输出 Schema 与允许差异，并分开记录提供方、模型、连接、适配参数、用量和证据；不可用或不符合契约的提供方会失败关闭。

应用中的本地与云接口确定性夹具只用于验证该契约和失败路径。它们不是真实本地生成模型、真实云供应商或第二真实 Agent，不具备对应真实验收资格。

`createExternalAgentModelProvider` 允许调用方注入真实模型传输，但只接受结构化完成结果，再把步骤重新绑定到请求中精确登记的工具版本；传输实现、鉴权和供应商 SDK 不进入 Runtime。`requestReadOnlyAgentReview` 对第二 Agent 使用单独的只读契约，固定无工具、非人工批准和不写正式数据。仓库的 `accept:m3-real-model` 驱动器只使用合成数据，可把本地 Ollama 与一个显式配置的 OpenAI-compatible 云连接接到同一 Runtime；云密钥只按调用者给出的环境变量名在进程边界注入，不进入命令参数、日志或证据文件。

构建后可在任意本地目录运行固定演示：

```sh
pnpm --filter @mojing/agent-runtime build
pnpm --filter @mojing/agent-runtime demo -- \
  --checkpoint=/tmp/mojing-agent-runtime-checkpoint.json \
  --result=/tmp/mojing-agent-runtime-result.json
```

演示只使用本地固定数据、三个已登记的确定性工具和 JSON 文件检查点，输出 `answer = 42` 的隔离候选、零墨境按工具调用附加费和 `formalWrite = false` 的运行证据。参数路径由运行者明确提供；演示不读取 `.env`、凭据、项目数据库或网络。
