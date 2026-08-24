import {
  AgentRuntime,
  AgentToolRegistry,
  agentTaskPackageSchemaVersion,
} from "../packages/agent-runtime/dist/index.js";

const toolRef = { id: "example.add", typeId: "mj.core/tool", version: "1.0.0" };
const registry = new AgentToolRegistry();

registry.register({
  id: toolRef,
  name: "计算两个合成数字之和",
  permission: "fixture.read",
  effect: "candidate",
  local: true,
  platformSurcharge: { amount: 0, unit: "CNY" },
  execute: (input) => ({
    answer: Number(input.left) + Number(input.right),
    formalWrite: false,
  }),
});

const task = {
  schemaVersion: agentTaskPackageSchemaVersion,
  id: { id: "example.task", typeId: "mj.core/agent-task", version: "1.0.0" },
  goal: "用本地工具计算 19 + 23。",
  modelRef: { id: "example.local", typeId: "mj.core/model", version: "1.0.0" },
  authoritativeContext: {
    scope: [],
    snapshotVersion: "synthetic/v1",
    values: {},
  },
  allowedTools: [toolRef],
  requiredPermissions: ["fixture.read"],
  limits: {
    maximumSteps: 1,
    maximumToolCalls: 1,
    maximumDurationMilliseconds: 5_000,
    maximumCost: { amount: 0, unit: "CNY" },
  },
  steps: [
    {
      id: "add",
      title: "计算合成数据",
      toolRef,
      input: { left: 19, right: 23 },
      saveAs: "candidate",
    },
  ],
  writeScope: "candidate-only",
  outputSchema: "example.result/v1",
  acceptance: ["answer=42", "formalWrite=false"],
};

const runtime = new AgentRuntime(task, registry, {
  initialPermissions: ["fixture.read"],
});
await runtime.advance();
const result = runtime.result();

if (result.output.candidate?.answer !== 42 || result.formalWrite !== false)
  throw new Error("MINIMAL_AGENT_EXAMPLE_FAILED");

console.log(JSON.stringify(result, null, 2));
