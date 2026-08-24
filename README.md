# 墨境开放协议与运行组件

这不是完整的墨境产品，而是一套公开的“接头、规则和基础运行零件”。你可以用它描述墨境兼容的数据、开发适配器，或在不连接墨境闭源系统的情况下运行一个受限 Agent。

## 它能做什么

- `protocol-spec`：定义 Workflow、Node、Run 等数据格式，并校验数据是否合规。
- `adapter-sdk`：让第三方工具、模型或服务以统一方式接入。
- `agent-runtime`：在明确的工具、权限和费用上限内运行 Agent，并留下结构化证据。
- 其余包提供能力匹配、受限网关、适配器宿主、开放工具一致性检查和原创 Comfy 公共 API 客户端。

它不包含墨境界面、闭源控制面、正式审批、正式写入、用户数据、凭据或商业策略。

## 五分钟运行

### 不写代码：在网页点一次完成验收

1. 打开 [GitHub Actions 的“墨境一键验收”页面](https://github.com/brotecher/brotech/actions/workflows/owner-acceptance.yml)。
2. 点击右侧 **Run workflow**，再点击绿色的 **Run workflow**。
3. 等待运行结果变成绿色，然后打开该次运行的 **Summary**。
4. 看到“✅ 墨境公开制品验收通过”即表示验证成功；页面底部还可以下载中文验收证据。

这个流程只读取公开源码和合成数据，不需要你填写密钥，也不会写入正式数据。

### 开发者：在本地运行

需要 Node.js 24.19.0 和 pnpm 11.21.0：

```sh
git clone https://github.com/brotecher/brotech.git
cd brotech
pnpm install --ignore-scripts
pnpm run build
pnpm run example:agent
pnpm run example:adapter
```

第一个示例会用本地合成数据计算 `19 + 23 = 42`；第二个示例会调用一个零费用、无正式写入的固定文本适配器。两者都不读取凭据、不访问网络，也不修改正式数据。

更详细的解释见[中文入门指南](docs/zh-CN/quickstart.md)。如果你准备开发自己的适配器，请从 [`packages/adapter-sdk`](packages/adapter-sdk) 和 [`packages/protocol-spec`](packages/protocol-spec) 开始。

## 验证仓库

```sh
pnpm test
pnpm run typecheck
```

八个制品采用 Apache-2.0，社区贡献采用 DCO。各包保持 `private: true`，因为没有授权发布到 npm 注册源；这不影响从本 GitHub 仓库获取和使用源码。发布边界和状态见 [`PUBLICATION.json`](PUBLICATION.json)。

## English

This repository contains eight Apache-2.0 Mojing protocol and middleware artifacts, not the private Mojing product or control plane. Start with the Chinese quickstart above; package-level API and governance details are available under `packages/`.
