import type { StableRef } from '@mojing/protocol-spec';

export const agentTaskPackageSchemaVersion = 'mj.agent-task-package/v1' as const;
export const agentRuntimeCheckpointSchemaVersion = 'mj.agent-runtime-checkpoint/v1' as const;
export const agentRuntimeResultSchemaVersion = 'mj.agent-runtime-result/v1' as const;
export const agentModelPlanRequestSchemaVersion = 'mj.agent-model-plan-request/v1' as const;
export const agentModelPlanSchemaVersion = 'mj.agent-model-plan/v1' as const;
export const agentRuntimeVersion = '0.1.0' as const;

export type AgentValue =
  | null
  | boolean
  | number
  | string
  | readonly AgentValue[]
  | Readonly<{ [key: string]: AgentValue }>;

export type AgentTaskLimit = Readonly<{
  maximumSteps: number;
  maximumToolCalls: number;
  maximumDurationMilliseconds: number;
  maximumCost: Readonly<{ amount: number; unit: string }>;
}>;

export type AgentTaskStep = Readonly<{
  id: string;
  title: string;
  toolRef: StableRef;
  input: AgentValue;
  saveAs: string;
}>;

export type AgentModelTaskKind =
  'object-query' | 'deterministic-calculation' | 'isolated-candidate';

export type AgentModelProviderDescriptor = Readonly<{
  providerRef: StableRef;
  modelRef: StableRef;
  connectionRef: StableRef;
  connectionKind: 'local' | 'cloud';
  evidenceLevel: 'isolated-fixture' | 'real-provider';
  available: boolean;
  availabilityReason: string;
  dataEgress: Readonly<{
    required: boolean;
    recipient: string;
    dataScope: string;
    retention: string;
  }>;
  estimatedCost: Readonly<{ amount: number | null; unit: string }>;
}>;

export type AgentModelPlanRequest = Readonly<{
  schemaVersion: typeof agentModelPlanRequestSchemaVersion;
  runtimeVersion: typeof agentRuntimeVersion;
  workflowRef: StableRef;
  fixtureVersion: string;
  taskKind: AgentModelTaskKind;
  goal: string;
  input: AgentValue;
  toolSchemas: readonly StableRef[];
  outputSchema: string;
  allowedDifferences: readonly string[];
}>;

export type AgentModelPlan = Readonly<{
  schemaVersion: typeof agentModelPlanSchemaVersion;
  providerRef: StableRef;
  modelRef: StableRef;
  connectionRef: StableRef;
  taskKind: AgentModelTaskKind;
  steps: readonly AgentTaskStep[];
  adapterParameters: Readonly<Record<string, AgentValue>>;
  providerUsage: Readonly<{ amount: number; unit: string }>;
  evidence: readonly string[];
}>;

export type AgentModelProvider = Readonly<{
  descriptor: AgentModelProviderDescriptor;
  plan: (
    request: AgentModelPlanRequest,
    options: Readonly<{ signal: AbortSignal }>
  ) => Promise<AgentModelPlan>;
}>;

export type AgentTaskPackage = Readonly<{
  schemaVersion: typeof agentTaskPackageSchemaVersion;
  id: StableRef;
  goal: string;
  modelRef: StableRef;
  authoritativeContext: Readonly<{
    scope: readonly StableRef[];
    snapshotVersion: string;
    values: Readonly<Record<string, AgentValue>>;
  }>;
  allowedTools: readonly StableRef[];
  requiredPermissions: readonly string[];
  limits: AgentTaskLimit;
  steps: readonly AgentTaskStep[];
  writeScope: 'candidate-only';
  outputSchema: string;
  acceptance: readonly string[];
}>;

export type RegisteredAgentTool = Readonly<{
  id: StableRef;
  name: string;
  permission: string;
  effect: 'none' | 'read' | 'candidate';
  local: boolean;
  platformSurcharge: Readonly<{ amount: number; unit: string }>;
  execute: (
    input: AgentValue,
    context: Readonly<Record<string, AgentValue>>,
    options: Readonly<{ signal: AbortSignal }>
  ) => Promise<AgentValue> | AgentValue;
}>;

export type AgentRuntimeStatus =
  | 'ready'
  | 'running'
  | 'paused'
  | 'waiting-permission'
  | 'limit-reached'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'taken-over';

export type AgentRuntimeEvent = Readonly<{
  sequence: number;
  at: string;
  type:
    | 'task-created'
    | 'step-started'
    | 'step-completed'
    | 'permission-requested'
    | 'permission-decided'
    | 'paused'
    | 'resumed'
    | 'cancelled'
    | 'limit-reached'
    | 'failed'
    | 'completed'
    | 'human-takeover';
  detail: string;
  stepId: string | null;
  actorRef: string | null;
}>;

export type AgentRuntimeCheckpoint = Readonly<{
  schemaVersion: typeof agentRuntimeCheckpointSchemaVersion;
  runtimeVersion: typeof agentRuntimeVersion;
  task: AgentTaskPackage;
  status: AgentRuntimeStatus;
  cursor: number;
  results: Readonly<Record<string, AgentValue>>;
  grantedPermissions: readonly string[];
  pendingPermission: string | null;
  usage: Readonly<{
    steps: number;
    toolCalls: number;
    cost: number;
    costUnit: string;
    startedAt: string;
    elapsedMilliseconds: number;
  }>;
  events: readonly AgentRuntimeEvent[];
  error: Readonly<{ code: string; message: string }> | null;
}>;

export type AgentRuntimeResult = Readonly<{
  schemaVersion: typeof agentRuntimeResultSchemaVersion;
  runtimeVersion: typeof agentRuntimeVersion;
  taskRef: StableRef;
  status: AgentRuntimeStatus;
  outputSchema: string;
  output: Readonly<Record<string, AgentValue>>;
  usage: AgentRuntimeCheckpoint['usage'];
  evidence: readonly AgentRuntimeEvent[];
  platformSurcharge: Readonly<{ amount: 0; unit: string }>;
  formalWrite: false;
}>;

const refKey = (ref: StableRef) => `${ref.typeId}:${ref.id}:${ref.version}`;
const validRef = (ref: StableRef) => Boolean(ref?.id && ref.typeId && ref.version);
const clone = <T>(value: T): T => structuredClone(value);
const modelTaskKinds = new Set<AgentModelTaskKind>([
  'object-query',
  'deterministic-calculation',
  'isolated-candidate'
]);
const terminalStatuses = new Set<AgentRuntimeStatus>([
  'completed',
  'cancelled',
  'failed',
  'taken-over'
]);
const runtimeStatuses = new Set<AgentRuntimeStatus>([
  'ready',
  'running',
  'paused',
  'waiting-permission',
  'limit-reached',
  ...terminalStatuses
]);

const validateTask = (task: AgentTaskPackage): void => {
  if (task.schemaVersion !== agentTaskPackageSchemaVersion)
    throw new Error('AGENT_TASK_SCHEMA_UNSUPPORTED');
  if (!task.id.id || !task.id.typeId || !task.id.version || !task.goal)
    throw new Error('AGENT_TASK_IDENTITY_INVALID');
  if (task.writeScope !== 'candidate-only') throw new Error('AGENT_TASK_WRITE_SCOPE_DENIED');
  if (!task.steps.length || !task.allowedTools.length) throw new Error('AGENT_TASK_STEPS_REQUIRED');
  if (
    task.limits.maximumSteps < 1 ||
    task.limits.maximumToolCalls < 1 ||
    task.limits.maximumDurationMilliseconds < 1 ||
    task.limits.maximumCost.amount < 0 ||
    !task.limits.maximumCost.unit
  )
    throw new Error('AGENT_TASK_LIMIT_INVALID');
  const allowed = new Set(task.allowedTools.map(refKey));
  const stepIds = new Set<string>();
  for (const step of task.steps) {
    if (!step.id || !step.title || !step.saveAs || stepIds.has(step.id))
      throw new Error('AGENT_TASK_STEP_INVALID');
    if (!allowed.has(refKey(step.toolRef))) throw new Error('AGENT_TASK_TOOL_NOT_ALLOWED');
    stepIds.add(step.id);
  }
};

const validateCheckpoint = (checkpoint: AgentRuntimeCheckpoint): void => {
  if (
    checkpoint.schemaVersion !== agentRuntimeCheckpointSchemaVersion ||
    checkpoint.runtimeVersion !== agentRuntimeVersion
  )
    throw new Error('AGENT_CHECKPOINT_VERSION_UNSUPPORTED');
  if (
    !runtimeStatuses.has(checkpoint.status) ||
    !Number.isInteger(checkpoint.cursor) ||
    checkpoint.cursor < 0 ||
    checkpoint.cursor > checkpoint.task.steps.length ||
    !checkpoint.results ||
    typeof checkpoint.results !== 'object' ||
    Array.isArray(checkpoint.results) ||
    !Array.isArray(checkpoint.grantedPermissions) ||
    !checkpoint.usage ||
    !Number.isInteger(checkpoint.usage.steps) ||
    !Number.isInteger(checkpoint.usage.toolCalls) ||
    checkpoint.usage.steps < 0 ||
    checkpoint.usage.toolCalls < 0 ||
    !Number.isFinite(checkpoint.usage.cost) ||
    checkpoint.usage.cost < 0 ||
    !checkpoint.usage.costUnit ||
    !Number.isFinite(checkpoint.usage.elapsedMilliseconds) ||
    checkpoint.usage.elapsedMilliseconds < 0 ||
    !Number.isFinite(Date.parse(checkpoint.usage.startedAt)) ||
    !Array.isArray(checkpoint.events) ||
    checkpoint.events.some(
      (event, index) =>
        event.sequence !== index + 1 ||
        !event.type ||
        !event.detail ||
        !Number.isFinite(Date.parse(event.at))
    )
  )
    throw new Error('AGENT_CHECKPOINT_INVALID');
};

export class AgentToolRegistry {
  readonly #tools = new Map<string, RegisteredAgentTool>();

  register(tool: RegisteredAgentTool): void {
    const key = refKey(tool.id);
    if (!tool.id.id || !tool.id.typeId || !tool.id.version || !tool.name || !tool.permission)
      throw new Error('AGENT_TOOL_DEFINITION_INVALID');
    if (this.#tools.has(key)) throw new Error('AGENT_TOOL_VERSION_EXISTS');
    this.#tools.set(key, tool);
  }

  resolve(ref: StableRef): RegisteredAgentTool | undefined {
    return this.#tools.get(refKey(ref));
  }

  list(): Array<Omit<RegisteredAgentTool, 'execute'>> {
    return [...this.#tools.values()].map(({ execute: _execute, ...tool }) => clone(tool));
  }
}

export const requestAgentModelPlan = async (
  provider: AgentModelProvider,
  request: AgentModelPlanRequest,
  options: Readonly<{ signal: AbortSignal }>
): Promise<AgentModelPlan> => {
  const descriptor = provider?.descriptor;
  if (
    !descriptor ||
    !validRef(descriptor.providerRef) ||
    !validRef(descriptor.modelRef) ||
    !validRef(descriptor.connectionRef) ||
    !descriptor.availabilityReason ||
    !descriptor.estimatedCost.unit ||
    (descriptor.estimatedCost.amount !== null &&
      (!Number.isFinite(descriptor.estimatedCost.amount) || descriptor.estimatedCost.amount < 0)) ||
    request.schemaVersion !== agentModelPlanRequestSchemaVersion ||
    request.runtimeVersion !== agentRuntimeVersion ||
    !modelTaskKinds.has(request.taskKind) ||
    !validRef(request.workflowRef) ||
    !request.fixtureVersion ||
    !request.goal ||
    !request.outputSchema ||
    request.toolSchemas.length === 0 ||
    request.toolSchemas.some((ref) => !validRef(ref)) ||
    new Set(request.toolSchemas.map(refKey)).size !== request.toolSchemas.length ||
    request.allowedDifferences.some((path) => !path)
  )
    throw new Error('AGENT_MODEL_REQUEST_INVALID');
  if (!descriptor.available)
    throw new Error(`AGENT_MODEL_PROVIDER_UNAVAILABLE:${descriptor.availabilityReason}`);
  if (options.signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
  const plan = (await provider.plan(clone(request), options)) as AgentModelPlan | null;
  if (!plan || !Array.isArray(plan.steps)) throw new Error('AGENT_MODEL_PLAN_INVALID');
  const allowedTools = new Set(request.toolSchemas.map(refKey));
  const stepIds = new Set<string>();
  const saveNames = new Set<string>();
  const stepsInvalid = plan.steps.some((step) => {
    if (
      !step.id ||
      !step.title ||
      !step.saveAs ||
      stepIds.has(step.id) ||
      saveNames.has(step.saveAs) ||
      !allowedTools.has(refKey(step.toolRef))
    )
      return true;
    stepIds.add(step.id);
    saveNames.add(step.saveAs);
    return false;
  });
  if (
    plan.schemaVersion !== agentModelPlanSchemaVersion ||
    refKey(plan.providerRef) !== refKey(provider.descriptor.providerRef) ||
    refKey(plan.modelRef) !== refKey(provider.descriptor.modelRef) ||
    refKey(plan.connectionRef) !== refKey(provider.descriptor.connectionRef) ||
    plan.taskKind !== request.taskKind ||
    !Number.isFinite(plan.providerUsage.amount) ||
    plan.providerUsage.amount < 0 ||
    plan.providerUsage.unit !== descriptor.estimatedCost.unit ||
    !plan.adapterParameters ||
    typeof plan.adapterParameters !== 'object' ||
    Array.isArray(plan.adapterParameters) ||
    !Array.isArray(plan.evidence) ||
    plan.evidence.length === 0 ||
    plan.evidence.some((entry) => !entry) ||
    plan.steps.length === 0 ||
    stepsInvalid
  )
    throw new Error('AGENT_MODEL_PLAN_INVALID');
  if (options.signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError');
  return clone(plan);
};

type AgentRuntimeOptions = Readonly<{
  now?: () => number;
  toIso?: (milliseconds: number) => string;
  initialPermissions?: readonly string[];
}>;

export class AgentRuntime {
  readonly #registry: AgentToolRegistry;
  readonly #now: () => number;
  readonly #toIso: (milliseconds: number) => string;
  #checkpoint: AgentRuntimeCheckpoint;
  #activeController: AbortController | null = null;
  #pauseRequested = false;

  constructor(
    task: AgentTaskPackage,
    registry: AgentToolRegistry,
    options: AgentRuntimeOptions = {}
  ) {
    validateTask(task);
    this.#registry = registry;
    this.#now = options.now ?? Date.now;
    this.#toIso = options.toIso ?? ((milliseconds) => new Date(milliseconds).toISOString());
    for (const ref of task.allowedTools) {
      const tool = registry.resolve(ref);
      if (!tool) throw new Error(`AGENT_TOOL_NOT_REGISTERED:${refKey(ref)}`);
      if (!task.requiredPermissions.includes(tool.permission))
        throw new Error(`AGENT_TOOL_PERMISSION_UNDECLARED:${tool.permission}`);
    }
    const startedAt = this.#now();
    this.#checkpoint = {
      schemaVersion: agentRuntimeCheckpointSchemaVersion,
      runtimeVersion: agentRuntimeVersion,
      task: clone(task),
      status: 'ready',
      cursor: 0,
      results: {},
      grantedPermissions: [...new Set(options.initialPermissions ?? [])],
      pendingPermission: null,
      usage: {
        steps: 0,
        toolCalls: 0,
        cost: 0,
        costUnit: task.limits.maximumCost.unit,
        startedAt: this.#toIso(startedAt),
        elapsedMilliseconds: 0
      },
      events: [],
      error: null
    };
    this.#appendEvent('task-created', `任务包 ${task.id.id}@${task.id.version} 已加载。`, null);
  }

  static restore(
    checkpoint: AgentRuntimeCheckpoint,
    registry: AgentToolRegistry,
    options: Omit<AgentRuntimeOptions, 'initialPermissions'> = {}
  ): AgentRuntime {
    validateTask(checkpoint.task);
    validateCheckpoint(checkpoint);
    for (const ref of checkpoint.task.allowedTools) {
      if (!registry.resolve(ref)) throw new Error(`AGENT_TOOL_NOT_REGISTERED:${refKey(ref)}`);
    }
    const runtime = new AgentRuntime(checkpoint.task, registry, {
      ...options,
      initialPermissions: checkpoint.grantedPermissions
    });
    runtime.#checkpoint = clone(checkpoint);
    if (runtime.#checkpoint.status === 'running')
      runtime.#checkpoint = { ...runtime.#checkpoint, status: 'paused' };
    return runtime;
  }

  snapshot(): AgentRuntimeCheckpoint {
    return clone(this.#checkpoint);
  }

  result(): AgentRuntimeResult {
    return {
      schemaVersion: agentRuntimeResultSchemaVersion,
      runtimeVersion: agentRuntimeVersion,
      taskRef: clone(this.#checkpoint.task.id),
      status: this.#checkpoint.status,
      outputSchema: this.#checkpoint.task.outputSchema,
      output: clone(this.#checkpoint.results),
      usage: clone(this.#checkpoint.usage),
      evidence: clone(this.#checkpoint.events),
      platformSurcharge: { amount: 0, unit: this.#checkpoint.usage.costUnit },
      formalWrite: false
    };
  }

  pause(): void {
    if (
      terminalStatuses.has(this.#checkpoint.status) ||
      ['limit-reached', 'waiting-permission'].includes(this.#checkpoint.status)
    )
      return;
    if (this.#checkpoint.status === 'running') {
      this.#pauseRequested = true;
      return;
    }
    this.#checkpoint = { ...this.#checkpoint, status: 'paused' };
    this.#appendEvent('paused', '任务已在步骤边界暂停。', null);
  }

  resume(): void {
    if (this.#checkpoint.status !== 'paused') return;
    this.#checkpoint = { ...this.#checkpoint, status: 'ready' };
    this.#appendEvent('resumed', '任务已从原检查点继续。', null);
  }

  cancel(): void {
    if (terminalStatuses.has(this.#checkpoint.status)) return;
    this.#activeController?.abort();
    this.#checkpoint = { ...this.#checkpoint, status: 'cancelled', pendingPermission: null };
    this.#appendEvent('cancelled', '任务已取消；已有候选与证据保留。', null);
  }

  takeOver(actorRef: string): void {
    if (!actorRef || terminalStatuses.has(this.#checkpoint.status)) return;
    this.#activeController?.abort();
    this.#checkpoint = { ...this.#checkpoint, status: 'taken-over', pendingPermission: null };
    this.#appendEvent('human-takeover', '人工已接管；Runtime 不再调用工具。', null, actorRef);
  }

  applyPermissionDecision(permission: string, granted: boolean, actorRef: string): void {
    if (
      !actorRef ||
      this.#checkpoint.status !== 'waiting-permission' ||
      this.#checkpoint.pendingPermission !== permission
    )
      throw new Error('AGENT_PERMISSION_DECISION_INVALID');
    const grantedPermissions = granted
      ? [...new Set([...this.#checkpoint.grantedPermissions, permission])]
      : this.#checkpoint.grantedPermissions;
    this.#checkpoint = {
      ...this.#checkpoint,
      status: granted ? 'ready' : 'cancelled',
      pendingPermission: null,
      grantedPermissions
    };
    this.#appendEvent(
      'permission-decided',
      granted ? `权限 ${permission} 已由外部决定授予。` : `权限 ${permission} 已拒绝，任务停止。`,
      this.#checkpoint.task.steps[this.#checkpoint.cursor]?.id ?? null,
      actorRef
    );
  }

  async advance(): Promise<AgentRuntimeCheckpoint> {
    if (
      ['paused', 'limit-reached'].includes(this.#checkpoint.status) ||
      terminalStatuses.has(this.#checkpoint.status)
    )
      return this.snapshot();
    if (this.#checkpoint.status === 'waiting-permission') return this.snapshot();
    const step = this.#checkpoint.task.steps[this.#checkpoint.cursor];
    if (!step) {
      this.#checkpoint = { ...this.#checkpoint, status: 'completed' };
      this.#appendEvent('completed', '全部步骤已完成，结构化候选可供审核。', null);
      return this.snapshot();
    }
    if (this.#stopAtLimit(step.id)) return this.snapshot();
    const tool = this.#registry.resolve(step.toolRef);
    if (!tool) return this.#fail('AGENT_TOOL_NOT_REGISTERED', '工具精确版本未登记。', step.id);
    if (!this.#checkpoint.task.allowedTools.some((ref) => refKey(ref) === refKey(tool.id)))
      return this.#fail('AGENT_TOOL_NOT_ALLOWED', '工具不在任务包允许范围内。', step.id);
    if (!this.#checkpoint.grantedPermissions.includes(tool.permission)) {
      this.#checkpoint = {
        ...this.#checkpoint,
        status: 'waiting-permission',
        pendingPermission: tool.permission
      };
      this.#appendEvent(
        'permission-requested',
        `等待外部决定权限 ${tool.permission}；Runtime 未自行授权。`,
        step.id
      );
      return this.snapshot();
    }
    if (tool.platformSurcharge.unit !== this.#checkpoint.usage.costUnit)
      return this.#fail('AGENT_COST_UNIT_MISMATCH', '工具费用单位与任务预算不一致。', step.id);
    if (
      this.#checkpoint.usage.cost + tool.platformSurcharge.amount >
      this.#checkpoint.task.limits.maximumCost.amount
    ) {
      this.#reachLimit('费用上限', step.id);
      return this.snapshot();
    }
    this.#checkpoint = { ...this.#checkpoint, status: 'running' };
    this.#checkpoint = {
      ...this.#checkpoint,
      usage: {
        ...this.#checkpoint.usage,
        toolCalls: this.#checkpoint.usage.toolCalls + 1,
        cost: this.#checkpoint.usage.cost + tool.platformSurcharge.amount
      }
    };
    this.#appendEvent('step-started', `调用已登记工具 ${tool.name}。`, step.id);
    const controller = new AbortController();
    this.#activeController = controller;
    const elapsedBeforeCall = Math.max(
      this.#checkpoint.usage.elapsedMilliseconds,
      this.#now() - Date.parse(this.#checkpoint.usage.startedAt)
    );
    const remainingMilliseconds = Math.max(
      0,
      this.#checkpoint.task.limits.maximumDurationMilliseconds - elapsedBeforeCall
    );
    let timeLimitReached = false;
    const timeLimit = setTimeout(() => {
      timeLimitReached = true;
      controller.abort();
    }, remainingMilliseconds);
    try {
      const value = await tool.execute(step.input, this.#toolContext(), {
        signal: controller.signal
      });
      if (timeLimitReached) {
        this.#reachLimit('时间上限', step.id);
        return this.snapshot();
      }
      if (this.#checkpoint.status === 'cancelled' || this.#checkpoint.status === 'taken-over')
        return this.snapshot();
      const now = this.#now();
      const results = { ...this.#checkpoint.results, [step.saveAs]: clone(value) };
      const usage = {
        ...this.#checkpoint.usage,
        steps: this.#checkpoint.usage.steps + 1,
        elapsedMilliseconds: Math.max(
          this.#checkpoint.usage.elapsedMilliseconds,
          now - Date.parse(this.#checkpoint.usage.startedAt)
        )
      };
      this.#checkpoint = {
        ...this.#checkpoint,
        status: this.#pauseRequested ? 'paused' : 'ready',
        cursor: this.#checkpoint.cursor + 1,
        results,
        usage
      };
      this.#appendEvent('step-completed', `步骤结果已保存为 ${step.saveAs}。`, step.id);
      if (this.#pauseRequested) {
        this.#pauseRequested = false;
        this.#appendEvent('paused', '暂停请求已在工具调用后的安全边界生效。', step.id);
      } else if (this.#checkpoint.cursor === this.#checkpoint.task.steps.length) {
        this.#checkpoint = { ...this.#checkpoint, status: 'completed' };
        this.#appendEvent('completed', '全部步骤已完成，结构化候选可供审核。', null);
      }
    } catch (caught) {
      if (timeLimitReached) {
        this.#reachLimit('时间上限', step.id);
      } else if (controller.signal.aborted) {
        if (!terminalStatuses.has(this.#checkpoint.status)) this.cancel();
      } else {
        this.#fail(
          'AGENT_TOOL_FAILED',
          caught instanceof Error ? caught.message : '工具调用失败。',
          step.id
        );
      }
    } finally {
      clearTimeout(timeLimit);
      if (this.#activeController === controller) this.#activeController = null;
    }
    return this.snapshot();
  }

  #toolContext(): Readonly<Record<string, AgentValue>> {
    return {
      ...this.#checkpoint.task.authoritativeContext.values,
      ...this.#checkpoint.results
    };
  }

  #stopAtLimit(stepId: string): boolean {
    const { limits } = this.#checkpoint.task;
    const { usage } = this.#checkpoint;
    const elapsed = Math.max(usage.elapsedMilliseconds, this.#now() - Date.parse(usage.startedAt));
    if (usage.steps >= limits.maximumSteps) return this.#reachLimit('步骤上限', stepId);
    if (usage.toolCalls >= limits.maximumToolCalls) return this.#reachLimit('工具调用上限', stepId);
    if (elapsed >= limits.maximumDurationMilliseconds) return this.#reachLimit('时间上限', stepId);
    return false;
  }

  #reachLimit(name: string, stepId: string): true {
    this.#checkpoint = { ...this.#checkpoint, status: 'limit-reached' };
    this.#appendEvent('limit-reached', `${name}已达到；后续工具不会调用。`, stepId);
    return true;
  }

  #fail(code: string, message: string, stepId: string): AgentRuntimeCheckpoint {
    this.#checkpoint = { ...this.#checkpoint, status: 'failed', error: { code, message } };
    this.#appendEvent('failed', `${code}: ${message}`, stepId);
    return this.snapshot();
  }

  #appendEvent(
    type: AgentRuntimeEvent['type'],
    detail: string,
    stepId: string | null,
    actorRef: string | null = null
  ): void {
    const event: AgentRuntimeEvent = {
      sequence: this.#checkpoint.events.length + 1,
      at: this.#toIso(this.#now()),
      type,
      detail,
      stepId,
      actorRef
    };
    this.#checkpoint = { ...this.#checkpoint, events: [...this.#checkpoint.events, event] };
  }
}

export {
  createExternalAgentModelProvider,
  externalModelInvocationSchemaVersion,
  readOnlyAgentReviewSchemaVersion,
  requestReadOnlyAgentReview
} from './external-model.js';
export type {
  ExternalModelCompletion,
  ExternalModelInvocation,
  ExternalModelInvoker,
  ReadOnlyAgentReview
} from './external-model.js';
