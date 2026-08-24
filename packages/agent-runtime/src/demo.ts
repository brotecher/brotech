import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  AgentRuntime,
  AgentToolRegistry,
  agentTaskPackageSchemaVersion,
  type AgentRuntimeCheckpoint,
  type AgentTaskPackage,
  type AgentValue,
  type RegisteredAgentTool
} from './index.js';

const argument = (name: string, fallback: string) =>
  resolve(
    process.argv.find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) ?? fallback
  );

const checkpointPath = argument('--checkpoint', 'agent-runtime-demo-checkpoint.json');
const resultPath = argument('--result', 'agent-runtime-demo-result.json');

const refs = {
  model: { id: 'model-local-demo', typeId: 'mj.core/model', version: '1.0.0' },
  read: { id: 'tool-local-read', typeId: 'mj.core/tool', version: '1.0.0' },
  transform: { id: 'tool-local-transform', typeId: 'mj.core/tool', version: '1.0.0' },
  candidate: { id: 'tool-local-candidate', typeId: 'mj.core/tool', version: '1.0.0' }
} as const;

const zeroCostTool = (
  input: Omit<RegisteredAgentTool, 'platformSurcharge'>
): RegisteredAgentTool => ({
  ...input,
  platformSurcharge: { amount: 0, unit: 'CNY' }
});

const createRegistry = () => {
  const registry = new AgentToolRegistry();
  registry.register(
    zeroCostTool({
      id: refs.read,
      name: '读取本地夹具',
      permission: 'fixture.read',
      effect: 'read',
      local: true,
      execute: (_input, context) => context.object ?? null
    })
  );
  registry.register(
    zeroCostTool({
      id: refs.transform,
      name: '确定性计算',
      permission: 'fixture.read',
      effect: 'none',
      local: true,
      execute: (_input, context) => {
        const object = context.readResult as Readonly<Record<string, AgentValue>>;
        return Number(object.left) + Number(object.right);
      }
    })
  );
  registry.register(
    zeroCostTool({
      id: refs.candidate,
      name: '构造结构化候选',
      permission: 'candidate.create',
      effect: 'candidate',
      local: true,
      execute: (_input, context) => ({
        schemaVersion: 'mj.agent/demo-candidate/v1',
        answer: context.sum ?? null,
        formalWrite: false
      })
    })
  );
  return registry;
};

const task: AgentTaskPackage = {
  schemaVersion: agentTaskPackageSchemaVersion,
  id: { id: 'agent-runtime-local-demo', typeId: 'mj.core/agent-task', version: '1.0.0' },
  goal: '用本地工具读取两个固定数值，确定性求和并导出结构化候选。',
  modelRef: refs.model,
  authoritativeContext: {
    scope: [{ id: 'fixture-addends', typeId: 'mj.fixture/object', version: '1.0.0' }],
    snapshotVersion: 'demo-fixture/v1',
    values: { object: { left: 19, right: 23 } }
  },
  allowedTools: [refs.read, refs.transform, refs.candidate],
  requiredPermissions: ['fixture.read', 'candidate.create'],
  limits: {
    maximumSteps: 3,
    maximumToolCalls: 3,
    maximumDurationMilliseconds: 10_000,
    maximumCost: { amount: 0, unit: 'CNY' }
  },
  steps: [
    { id: 'read', title: '读取固定对象', toolRef: refs.read, input: {}, saveAs: 'readResult' },
    { id: 'sum', title: '确定性求和', toolRef: refs.transform, input: {}, saveAs: 'sum' },
    {
      id: 'candidate',
      title: '生成候选',
      toolRef: refs.candidate,
      input: {},
      saveAs: 'candidate'
    }
  ],
  writeScope: 'candidate-only',
  outputSchema: 'mj.agent/demo-result/v1',
  acceptance: ['answer=42', 'platformSurcharge=0 CNY', 'formalWrite=false']
};

const readCheckpoint = async (): Promise<AgentRuntimeCheckpoint | null> => {
  try {
    return JSON.parse(await readFile(checkpointPath, 'utf8')) as AgentRuntimeCheckpoint;
  } catch (caught) {
    if ((caught as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw caught;
  }
};

const registry = createRegistry();
const saved = await readCheckpoint();
const runtime = saved
  ? AgentRuntime.restore(saved, registry)
  : new AgentRuntime(task, registry, {
      initialPermissions: ['fixture.read', 'candidate.create']
    });

for (
  let index = 0;
  index < task.steps.length && runtime.snapshot().status === 'ready';
  index += 1
) {
  await runtime.advance();
  await writeFile(checkpointPath, `${JSON.stringify(runtime.snapshot(), null, 2)}\n`, 'utf8');
}

const result = runtime.result();
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify({ checkpointPath, resultPath, result })}\n`);
if (
  result.status !== 'completed' ||
  (result.output.candidate as Readonly<Record<string, AgentValue>> | undefined)?.answer !== 42 ||
  result.platformSurcharge.amount !== 0 ||
  result.formalWrite !== false
)
  process.exitCode = 1;
