import { describe, expect, it } from 'vitest';

import {
  AgentRuntime,
  AgentToolRegistry,
  agentModelPlanRequestSchemaVersion,
  agentModelPlanSchemaVersion,
  agentRuntimeCheckpointSchemaVersion,
  agentRuntimeResultSchemaVersion,
  agentRuntimeVersion,
  agentTaskPackageSchemaVersion,
  createExternalAgentModelProvider,
  requestAgentModelPlan,
  requestReadOnlyAgentReview,
  type AgentModelPlanRequest,
  type AgentModelProvider,
  type AgentTaskPackage,
  type AgentValue,
  type RegisteredAgentTool
} from '../src/index.js';

const refs = {
  model: { id: 'model-local-fixed', typeId: 'mj.core/model', version: '1.0.0' },
  read: { id: 'tool-local-read', typeId: 'mj.core/tool', version: '1.0.0' },
  transform: { id: 'tool-local-transform', typeId: 'mj.core/tool', version: '1.0.0' },
  candidate: { id: 'tool-local-candidate', typeId: 'mj.core/tool', version: '1.0.0' }
} as const;

const realProviderDescriptor = () => ({
  providerRef: {
    id: 'provider-real-local',
    typeId: 'mj.core/model-provider',
    version: '1.0.0'
  },
  modelRef: { id: 'model-real-local', typeId: 'mj.core/model', version: '1.0.0' },
  connectionRef: {
    id: 'connection-real-local',
    typeId: 'mj.core/model-connection',
    version: '1.0.0'
  },
  connectionKind: 'local' as const,
  evidenceLevel: 'real-provider' as const,
  available: true,
  availabilityReason: 'Local test transport is available.',
  dataEgress: {
    required: false,
    recipient: 'local test process',
    dataScope: 'synthetic fixture',
    retention: 'none'
  },
  estimatedCost: { amount: 0, unit: 'USD' }
});

const task = (maximumSteps = 3): AgentTaskPackage => ({
  schemaVersion: agentTaskPackageSchemaVersion,
  id: { id: 'task-local-summary', typeId: 'mj.core/agent-task', version: '1.0.0' },
  goal: '读取固定对象，确定性转换并生成隔离候选。',
  modelRef: refs.model,
  authoritativeContext: {
    scope: [{ id: 'person-lin', typeId: 'mj.core/person', version: '1.0.0' }],
    snapshotVersion: 'fixture-v1',
    values: { person: { name: '林越', role: '档案管理员' } }
  },
  allowedTools: [refs.read, refs.transform, refs.candidate],
  requiredPermissions: ['project.fixture.read', 'candidate.create'],
  limits: {
    maximumSteps,
    maximumToolCalls: 3,
    maximumDurationMilliseconds: 10_000,
    maximumCost: { amount: 0, unit: 'CNY' }
  },
  steps: [
    { id: 'read', title: '读取对象', toolRef: refs.read, input: {}, saveAs: 'object' },
    {
      id: 'transform',
      title: '确定性转换',
      toolRef: refs.transform,
      input: {},
      saveAs: 'summary'
    },
    {
      id: 'candidate',
      title: '生成候选',
      toolRef: refs.candidate,
      input: {},
      saveAs: 'candidate'
    }
  ],
  writeScope: 'candidate-only',
  outputSchema: 'mj.fixture/local-agent-result/v1',
  acceptance: ['结果结构固定', '不写正式数据', '平台附加费为 0']
});

const tool = (input: Omit<RegisteredAgentTool, 'platformSurcharge'>): RegisteredAgentTool => ({
  ...input,
  platformSurcharge: { amount: 0, unit: 'CNY' }
});

const registry = () => {
  const result = new AgentToolRegistry();
  result.register(
    tool({
      id: refs.read,
      name: '本地对象读取',
      permission: 'project.fixture.read',
      effect: 'read',
      local: true,
      execute: (_input, context) => context.person ?? null
    })
  );
  result.register(
    tool({
      id: refs.transform,
      name: '本地确定性转换',
      permission: 'project.fixture.read',
      effect: 'none',
      local: true,
      execute: (_input, context) => {
        const object = context.object as Readonly<Record<string, AgentValue>>;
        return `${String(object.name)} · ${String(object.role)}`;
      }
    })
  );
  result.register(
    tool({
      id: refs.candidate,
      name: '隔离候选创建',
      permission: 'candidate.create',
      effect: 'candidate',
      local: true,
      execute: (_input, context) => ({
        schemaVersion: 'mj.fixture/candidate/v1',
        value: context.summary ?? null,
        formalWrite: false
      })
    })
  );
  return result;
};

const runToEnd = async (runtime: AgentRuntime) => {
  for (let index = 0; index < 10 && runtime.snapshot().status !== 'completed'; index += 1) {
    const current = runtime.snapshot();
    if (current.status === 'waiting-permission' && current.pendingPermission)
      runtime.applyPermissionDecision(current.pendingPermission, true, 'actor-local-user');
    else await runtime.advance();
  }
};

describe('independent Agent Runtime', () => {
  const modelRequest = (): AgentModelPlanRequest => ({
    schemaVersion: agentModelPlanRequestSchemaVersion,
    runtimeVersion: agentRuntimeVersion,
    workflowRef: { id: 'workflow-interchange', typeId: 'mj.core/workflow', version: '1.0.0' },
    fixtureVersion: 'model-interchange/v1',
    taskKind: 'object-query',
    goal: '读取固定对象。',
    input: { personId: 'person-lin' },
    toolSchemas: [refs.read],
    outputSchema: 'mj.fixture/object-query/v1',
    allowedDifferences: []
  });
  const modelProvider = (): AgentModelProvider => ({
    descriptor: {
      providerRef: {
        id: 'provider-local-fixture',
        typeId: 'mj.core/model-provider',
        version: '1.0.0'
      },
      modelRef: refs.model,
      connectionRef: {
        id: 'connection-local-fixture',
        typeId: 'mj.core/model-connection',
        version: '1.0.0'
      },
      connectionKind: 'local',
      evidenceLevel: 'isolated-fixture',
      available: true,
      availabilityReason: '固定夹具可用。',
      dataEgress: {
        required: false,
        recipient: '不适用',
        dataScope: '固定夹具',
        retention: '不适用'
      },
      estimatedCost: { amount: 0, unit: 'synthetic-unit' }
    },
    plan: async (request) => ({
      schemaVersion: agentModelPlanSchemaVersion,
      providerRef: {
        id: 'provider-local-fixture',
        typeId: 'mj.core/model-provider',
        version: '1.0.0'
      },
      modelRef: refs.model,
      connectionRef: {
        id: 'connection-local-fixture',
        typeId: 'mj.core/model-connection',
        version: '1.0.0'
      },
      taskKind: request.taskKind,
      steps: [{ id: 'read', title: '读取对象', toolRef: refs.read, input: {}, saveAs: 'object' }],
      adapterParameters: { temperature: 0 },
      providerUsage: { amount: 0, unit: 'synthetic-unit' },
      evidence: ['fixture-plan-created']
    })
  });

  it('validates a provider-neutral model plan against exact task and tool versions', async () => {
    const plan = await requestAgentModelPlan(modelProvider(), modelRequest(), {
      signal: new AbortController().signal
    });
    expect(plan).toMatchObject({
      schemaVersion: agentModelPlanSchemaVersion,
      taskKind: 'object-query',
      providerUsage: { amount: 0, unit: 'synthetic-unit' }
    });
    expect(plan.steps[0]?.toolRef).toEqual(refs.read);
  });

  it('rejects unavailable providers, inexact tools and pre-cancelled model requests', async () => {
    const unavailable = modelProvider();
    await expect(
      requestAgentModelPlan(
        {
          ...unavailable,
          descriptor: {
            ...unavailable.descriptor,
            available: false,
            availabilityReason: '需要单独授权。'
          }
        },
        modelRequest(),
        { signal: new AbortController().signal }
      )
    ).rejects.toThrow('AGENT_MODEL_PROVIDER_UNAVAILABLE:需要单独授权。');

    await expect(
      requestAgentModelPlan(
        modelProvider(),
        { ...modelRequest(), toolSchemas: [refs.read, refs.read] },
        { signal: new AbortController().signal }
      )
    ).rejects.toThrow('AGENT_MODEL_REQUEST_INVALID');

    const wrongTool = modelProvider();
    await expect(
      requestAgentModelPlan(
        {
          ...wrongTool,
          plan: async (request, options) => ({
            ...(await wrongTool.plan(request, options)),
            steps: [
              {
                id: 'read',
                title: '读取对象',
                toolRef: { ...refs.read, version: '2.0.0' },
                input: {},
                saveAs: 'object'
              }
            ]
          })
        },
        modelRequest(),
        { signal: new AbortController().signal }
      )
    ).rejects.toThrow('AGENT_MODEL_PLAN_INVALID');

    const controller = new AbortController();
    controller.abort();
    await expect(
      requestAgentModelPlan(modelProvider(), modelRequest(), { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('uses exact registered local tools, external permission decisions and zero surcharge', async () => {
    let now = Date.parse('2026-08-24T00:00:00.000Z');
    const runtime = new AgentRuntime(task(), registry(), {
      now: () => now,
      initialPermissions: []
    });
    await runToEnd(runtime);
    const result = runtime.result();
    expect(result.schemaVersion).toBe(agentRuntimeResultSchemaVersion);
    expect(result.status).toBe('completed');
    expect(result.output.candidate).toMatchObject({ formalWrite: false });
    expect(result.platformSurcharge).toEqual({ amount: 0, unit: 'CNY' });
    expect(result.usage).toMatchObject({ steps: 3, toolCalls: 3, cost: 0 });
    expect(result.evidence.filter((event) => event.type === 'permission-requested')).toHaveLength(
      2
    );
    expect(result.evidence.filter((event) => event.type === 'permission-decided')).toHaveLength(2);
    now += 1;
  });

  it('stops at a declared limit, preserves partial evidence and permits human takeover', async () => {
    const runtime = new AgentRuntime(task(1), registry(), {
      initialPermissions: ['project.fixture.read', 'candidate.create']
    });
    await runtime.advance();
    await runtime.advance();
    expect(runtime.snapshot()).toMatchObject({
      status: 'limit-reached',
      cursor: 1,
      usage: { steps: 1, toolCalls: 1 }
    });
    expect(runtime.snapshot().results.object).toMatchObject({ name: '林越' });
    runtime.takeOver('actor-local-user');
    expect(runtime.result()).toMatchObject({ status: 'taken-over', formalWrite: false });
    expect(runtime.result().evidence.at(-1)).toMatchObject({
      type: 'human-takeover',
      actorRef: 'actor-local-user'
    });
  });

  it('pauses, restores the same checkpoint, resumes and cancels without a tool call', async () => {
    const tools = registry();
    const runtime = new AgentRuntime(task(), tools, {
      initialPermissions: ['project.fixture.read', 'candidate.create']
    });
    await runtime.advance();
    runtime.pause();
    const saved = runtime.snapshot();
    expect(saved.schemaVersion).toBe(agentRuntimeCheckpointSchemaVersion);
    const restored = AgentRuntime.restore(saved, tools);
    expect(restored.snapshot()).toMatchObject({ status: 'paused', cursor: 1 });
    restored.resume();
    restored.cancel();
    await restored.advance();
    expect(restored.snapshot()).toMatchObject({
      status: 'cancelled',
      cursor: 1,
      usage: { toolCalls: 1 }
    });
  });

  it('rejects unregistered, undeclared and inexact tool boundaries', () => {
    expect(() => new AgentRuntime(task(), new AgentToolRegistry())).toThrow(
      'AGENT_TOOL_NOT_REGISTERED'
    );
    expect(
      () =>
        new AgentRuntime({ ...task(), requiredPermissions: ['project.fixture.read'] }, registry())
    ).toThrow('AGENT_TOOL_PERMISSION_UNDECLARED:candidate.create');
    const wrongVersion = task();
    expect(
      () =>
        new AgentRuntime(
          {
            ...wrongVersion,
            allowedTools: [{ ...refs.read, version: '2.0.0' }],
            steps: [{ ...wrongVersion.steps[0]!, toolRef: { ...refs.read, version: '2.0.0' } }]
          },
          registry()
        )
    ).toThrow('AGENT_TOOL_NOT_REGISTERED:mj.core/tool:tool-local-read:2.0.0');
  });

  it('counts an attempted tool call and stops a running tool at the time limit', async () => {
    const tools = new AgentToolRegistry();
    tools.register(
      tool({
        id: refs.read,
        name: '可取消慢工具',
        permission: 'project.fixture.read',
        effect: 'read',
        local: true,
        execute: (_input, _context, { signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError'))
            );
          })
      })
    );
    const oneStep: AgentTaskPackage = {
      ...task(),
      allowedTools: [refs.read],
      requiredPermissions: ['project.fixture.read'],
      limits: {
        maximumSteps: 1,
        maximumToolCalls: 1,
        maximumDurationMilliseconds: 5,
        maximumCost: { amount: 0, unit: 'CNY' }
      },
      steps: [task().steps[0]!]
    };
    const runtime = new AgentRuntime(oneStep, tools, {
      initialPermissions: ['project.fixture.read']
    });
    await runtime.advance();
    expect(runtime.snapshot()).toMatchObject({
      status: 'limit-reached',
      cursor: 0,
      usage: { steps: 0, toolCalls: 1 }
    });
    expect(runtime.snapshot().events.at(-1)).toMatchObject({
      type: 'limit-reached',
      detail: '时间上限已达到；后续工具不会调用。'
    });
  });

  it('rejects a malformed local checkpoint instead of trusting its event sequence', () => {
    const runtime = new AgentRuntime(task(), registry(), {
      initialPermissions: ['project.fixture.read', 'candidate.create']
    });
    const checkpoint = runtime.snapshot();
    expect(() =>
      AgentRuntime.restore(
        {
          ...checkpoint,
          events: [{ ...checkpoint.events[0]!, sequence: 99 }]
        },
        registry()
      )
    ).toThrow('AGENT_CHECKPOINT_INVALID');
  });

  it('binds real external completions to exact Runtime tools and keeps review read-only', async () => {
    const descriptor = realProviderDescriptor();
    const invoke = async (invocation: { operation: 'plan' | 'review' }) => ({
      output:
        invocation.operation === 'plan'
          ? { taskKind: 'isolated-candidate', execute: true, proposal: '只读隔离候选。' }
          : {
              conclusion: '候选存在差异，需要人工决定。',
              findings: ['两个候选文本不同。'],
              recommendedAction: 'human-review'
            },
      usage: { amount: 0, unit: 'USD' },
      evidence: ['real-test-completion']
    });
    const request: AgentModelPlanRequest = {
      ...modelRequest(),
      taskKind: 'isolated-candidate',
      goal: '生成隔离候选。',
      input: { person: { name: '林越' } },
      toolSchemas: [refs.candidate],
      outputSchema: 'mj.fixture/candidate/v1',
      allowedDifferences: ['candidate.portrait']
    };
    const provider = createExternalAgentModelProvider({
      descriptor,
      adapterParameters: { transport: 'injected-test' },
      invoke
    });
    const plan = await requestAgentModelPlan(provider, request, {
      signal: new AbortController().signal
    });
    expect(plan.steps).toEqual([
      expect.objectContaining({
        id: 'isolated-candidate',
        toolRef: refs.candidate,
        input: { proposal: '只读隔离候选。' }
      })
    ]);

    const review = await requestReadOnlyAgentReview(
      descriptor,
      { base: '基础', candidates: ['候选一', '候选二'] },
      invoke,
      { signal: new AbortController().signal }
    );
    expect(review).toMatchObject({
      permission: 'read-only',
      tools: [],
      humanApproval: false,
      formalWrite: false,
      recommendedAction: 'human-review'
    });
  });

  it('fails closed for malformed external plans, reviews, multi-tool requests and cancellation', async () => {
    const descriptor = realProviderDescriptor();
    const candidateRequest: AgentModelPlanRequest = {
      ...modelRequest(),
      taskKind: 'isolated-candidate',
      goal: '生成隔离候选。',
      input: { person: { name: '林越' } },
      toolSchemas: [refs.candidate],
      outputSchema: 'mj.fixture/candidate/v1',
      allowedDifferences: ['candidate.portrait']
    };
    const providerWith = (output: AgentValue) =>
      createExternalAgentModelProvider({
        descriptor,
        adapterParameters: { transport: 'injected-test' },
        invoke: async () => ({
          output,
          usage: { amount: 0, unit: 'USD' },
          evidence: ['real-test-completion']
        })
      });
    const signal = new AbortController().signal;

    await expect(
      requestAgentModelPlan(providerWith(null), candidateRequest, { signal })
    ).rejects.toThrow('AGENT_EXTERNAL_MODEL_COMPLETION_INVALID');
    await expect(
      requestAgentModelPlan(
        providerWith({ taskKind: 'object-query', execute: true }),
        candidateRequest,
        { signal }
      )
    ).rejects.toThrow('AGENT_EXTERNAL_MODEL_PLAN_MISMATCH');
    await expect(
      requestAgentModelPlan(
        providerWith({ taskKind: 'isolated-candidate', execute: true }),
        candidateRequest,
        { signal }
      )
    ).rejects.toThrow('AGENT_EXTERNAL_MODEL_PROPOSAL_INVALID');
    await expect(
      requestAgentModelPlan(
        providerWith({ taskKind: 'isolated-candidate', execute: true, proposal: '候选' }),
        { ...candidateRequest, toolSchemas: [refs.candidate, refs.read] },
        { signal }
      )
    ).rejects.toThrow('AGENT_EXTERNAL_MODEL_SINGLE_TOOL_REQUIRED');

    const validReview = {
      conclusion: '需要人工判断。',
      findings: ['候选存在差异。'],
      recommendedAction: 'human-review'
    };
    const reviewInvoker = async () => ({
      output: validReview,
      usage: { amount: 0, unit: 'USD' },
      evidence: ['real-test-review']
    });
    await expect(
      requestReadOnlyAgentReview(
        { ...descriptor, evidenceLevel: 'isolated-fixture' },
        { candidates: [] },
        reviewInvoker,
        { signal }
      )
    ).rejects.toThrow('AGENT_REVIEWER_REAL_PROVIDER_REQUIRED');
    await expect(
      requestReadOnlyAgentReview(
        descriptor,
        { candidates: [] },
        async () => ({
          output: { ...validReview, conclusion: '' },
          usage: { amount: 0, unit: 'USD' },
          evidence: ['real-test-review']
        }),
        { signal }
      )
    ).rejects.toThrow('AGENT_READONLY_REVIEW_INVALID');

    const preCancelled = new AbortController();
    preCancelled.abort();
    await expect(
      requestReadOnlyAgentReview(descriptor, { candidates: [] }, reviewInvoker, {
        signal: preCancelled.signal
      })
    ).rejects.toMatchObject({ name: 'AbortError' });
    const cancelledDuringCall = new AbortController();
    await expect(
      requestReadOnlyAgentReview(
        descriptor,
        { candidates: [] },
        async () => {
          cancelledDuringCall.abort();
          return reviewInvoker();
        },
        { signal: cancelledDuringCall.signal }
      )
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
