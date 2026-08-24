export const openToolProtocolSchemaVersion = '1.0.0' as const;
export const openToolReferenceImplementationVersion = '0.1.0-fixture' as const;

export type OpenToolValue =
  null | boolean | number | string | OpenToolValue[] | { [key: string]: OpenToolValue };

export type OpenTransport = 'mcp' | 'a2a' | 'openapi' | 'webhook';
export type SecurityExtensionKind =
  'permission' | 'effect' | 'approval' | 'formal-write' | 'physical-action';

export type ProtocolExtension = Readonly<{
  namespace: string;
  kind: 'ordinary' | SecurityExtensionKind;
  value: OpenToolValue;
}>;

export type OpenProtocolHeader = Readonly<{
  schemaId: 'urn:mojing:open-tool-envelope';
  schemaVersion: '1.0.0' | '1.1.0';
  namespace: 'urn:mojing:open-tools';
  compatibility: readonly ('1.0.0' | '1.1.0')[];
  objectId: string;
  canonicalizationVersion: 'mj-json-1';
  contentDigest: `sha256:${string}`;
  signature: Readonly<{
    status: 'not-configured' | 'verified';
    keyId: string | null;
  }>;
  extensions: readonly ProtocolExtension[];
}>;

export type OpenToolDescriptor = Readonly<{
  id: string;
  version: string;
  transport: OpenTransport;
  externalRevision: string;
  verification: 'isolated-fixture' | 'externally-verified';
  inputSchema: Readonly<Record<string, OpenToolValue>>;
  outputSchema: Readonly<Record<string, OpenToolValue>>;
  permissions: readonly string[];
  egress: Readonly<{ mode: 'none' | 'declared'; recipient: string; fields: readonly string[] }>;
  cost: Readonly<{ amount: number; currency: 'synthetic-unit' | 'JPY' | 'USD' }>;
  effects: readonly ('none' | 'candidate' | 'external-write' | 'formal-write')[];
  cancellation: 'supported' | 'unsupported';
  errorCodes: readonly string[];
  extensions: readonly ProtocolExtension[];
  revoked: boolean;
}>;

export type UnifiedInvocationRecord = Readonly<{
  invocationId: string;
  transport: OpenTransport;
  capabilityId: string;
  protocolRevision: string;
  status: 'completed' | 'cancelled' | 'blocked' | 'failed';
  permission: Readonly<{ requested: readonly string[]; granted: readonly string[] }>;
  egress: OpenToolDescriptor['egress'];
  cost: OpenToolDescriptor['cost'];
  effects: OpenToolDescriptor['effects'];
  error: Readonly<{ code: string; message: string }> | null;
  idempotencyKey: string;
  auditRef: string;
  formalWrite: false;
}>;

export type InvocationRequest = Readonly<{
  invocationId: string;
  descriptor: OpenToolDescriptor;
  grantedPermissions: readonly string[];
  idempotencyKey: string;
  cancelled?: boolean;
}>;

const securityKinds = new Set<ProtocolExtension['kind']>([
  'permission',
  'effect',
  'approval',
  'formal-write',
  'physical-action'
]);

const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;

export const evaluateProtocolEnvelope = (
  header: OpenProtocolHeader,
  knownExtensionNamespaces: readonly string[]
): Readonly<{
  accepted: boolean;
  preservedExtensions: readonly ProtocolExtension[];
  errors: readonly string[];
}> => {
  const errors: string[] = [];
  if (header.schemaId !== 'urn:mojing:open-tool-envelope')
    errors.push('OPEN_PROTOCOL_SCHEMA_ID_UNSUPPORTED');
  if (header.namespace !== 'urn:mojing:open-tools')
    errors.push('OPEN_PROTOCOL_NAMESPACE_UNSUPPORTED');
  if (!header.compatibility.includes(header.schemaVersion))
    errors.push('OPEN_PROTOCOL_COMPATIBILITY_MISSING');
  if (!header.objectId || !header.contentDigest.startsWith('sha256:'))
    errors.push('OPEN_PROTOCOL_INTEGRITY_METADATA_INVALID');
  for (const extension of header.extensions) {
    if (
      securityKinds.has(extension.kind) &&
      !knownExtensionNamespaces.includes(extension.namespace)
    ) {
      errors.push(
        `OPEN_PROTOCOL_UNKNOWN_SECURITY_EXTENSION:${extension.namespace}:${extension.kind}`
      );
    }
  }
  return { accepted: errors.length === 0, preservedExtensions: header.extensions, errors };
};

export const migrateOpenProtocolEnvelope = (
  header: OpenProtocolHeader,
  targetVersion: '1.0.0' | '1.1.0'
): Readonly<{
  status: 'migrated' | 'rolled-back' | 'unchanged';
  envelope: OpenProtocolHeader;
  deprecations: readonly string[];
  preservedExtensionNamespaces: readonly string[];
}> => {
  if (!header.compatibility.includes(targetVersion))
    throw new Error('OPEN_PROTOCOL_TARGET_INCOMPATIBLE');
  const status =
    header.schemaVersion === targetVersion
      ? 'unchanged'
      : targetVersion === '1.0.0'
        ? 'rolled-back'
        : 'migrated';
  return {
    status,
    envelope: {
      ...header,
      schemaVersion: targetVersion,
      extensions: structuredClone(header.extensions)
    },
    deprecations: targetVersion === '1.1.0' ? ['legacyTraceLabel: remove after 2027-08-24'] : [],
    preservedExtensionNamespaces: header.extensions.map((extension) => extension.namespace)
  };
};

export const invokeOpenToolFixture = (request: InvocationRequest): UnifiedInvocationRecord => {
  const { descriptor } = request;
  const base = {
    invocationId: request.invocationId,
    transport: descriptor.transport,
    capabilityId: descriptor.id,
    protocolRevision: descriptor.externalRevision,
    permission: {
      requested: [...descriptor.permissions],
      granted: [...request.grantedPermissions]
    },
    egress: structuredClone(descriptor.egress),
    cost: structuredClone(descriptor.cost),
    effects: [...descriptor.effects],
    idempotencyKey: request.idempotencyKey,
    auditRef: `audit:${request.invocationId}`,
    formalWrite: false as const
  };
  if (descriptor.revoked)
    return {
      ...base,
      status: 'blocked',
      error: { code: 'CAPABILITY_REVOKED', message: '能力已撤销。' }
    };
  if (
    !unique(request.grantedPermissions) ||
    !descriptor.permissions.every((item) => request.grantedPermissions.includes(item))
  )
    return {
      ...base,
      status: 'blocked',
      error: { code: 'PERMISSION_DENIED', message: '缺少已批准权限。' }
    };
  if (request.cancelled) {
    if (descriptor.cancellation === 'supported')
      return {
        ...base,
        status: 'cancelled',
        error: { code: 'CANCELLED', message: '调用已取消。' }
      };
    return {
      ...base,
      status: 'failed',
      error: { code: 'CANCELLATION_UNSUPPORTED', message: '连接不支持取消。' }
    };
  }
  return { ...base, status: 'completed', error: null };
};

export type A2AAgentCard = Readonly<{
  id: string;
  version: string;
  externalRevision: string;
  skills: readonly string[];
  inputSchema: Readonly<Record<string, OpenToolValue>>;
  outputSchema: Readonly<Record<string, OpenToolValue>>;
}>;

export type A2ATask = Readonly<{
  id: string;
  agentId: string;
  status: 'working' | 'cancelled' | 'completed';
  progress: readonly Readonly<{ sequence: number; message: string }>[];
  artifacts: readonly Readonly<{ id: string; value: OpenToolValue }>[];
}>;

export class ReferenceA2AHost {
  readonly #agents = new Map<string, A2AAgentCard>();
  readonly #tasks = new Map<string, A2ATask>();

  register(card: A2AAgentCard): void {
    if (this.#agents.has(card.id)) throw new Error('A2A_AGENT_ALREADY_REGISTERED');
    this.#agents.set(card.id, structuredClone(card));
  }

  discover(skill: string): readonly A2AAgentCard[] {
    return [...this.#agents.values()]
      .filter((card) => card.skills.includes(skill))
      .map((card) => structuredClone(card));
  }

  delegate(taskId: string, agentId: string): A2ATask {
    if (this.#tasks.has(taskId)) throw new Error('A2A_TASK_IDEMPOTENCY_CONFLICT');
    if (!this.#agents.has(agentId)) throw new Error('A2A_AGENT_NOT_FOUND');
    const task: A2ATask = {
      id: taskId,
      agentId,
      status: 'working',
      progress: [],
      artifacts: []
    };
    this.#tasks.set(taskId, task);
    return structuredClone(task);
  }

  progress(taskId: string, message: string): A2ATask {
    const task = this.#requireWorking(taskId);
    const next = {
      ...task,
      progress: [...task.progress, { sequence: task.progress.length + 1, message }]
    };
    this.#tasks.set(taskId, next);
    return structuredClone(next);
  }

  handoffArtifact(taskId: string, artifact: { id: string; value: OpenToolValue }): A2ATask {
    const task = this.#requireWorking(taskId);
    const next = { ...task, artifacts: [...task.artifacts, structuredClone(artifact)] };
    this.#tasks.set(taskId, next);
    return structuredClone(next);
  }

  cancel(taskId: string): A2ATask {
    const task = this.#requireWorking(taskId);
    const next = { ...task, status: 'cancelled' as const };
    this.#tasks.set(taskId, next);
    return structuredClone(next);
  }

  #requireWorking(taskId: string): A2ATask {
    const task = this.#tasks.get(taskId);
    if (!task) throw new Error('A2A_TASK_NOT_FOUND');
    if (task.status !== 'working') throw new Error('A2A_TASK_NOT_WORKING');
    return task;
  }
}

export type WebhookEvent = Readonly<{
  eventId: string;
  targetId: string;
  sentAt: string;
  signatureVerified: boolean;
}>;

export type WebhookDecision = Readonly<{
  accepted: boolean;
  reason:
    'ACCEPTED' | 'SIGNATURE_INVALID' | 'TARGET_NOT_ALLOWED' | 'REPLAY_REJECTED' | 'EVENT_EXPIRED';
}>;

export class ReferenceWebhookGuard {
  readonly #allowedTargets: ReadonlySet<string>;
  readonly #seenEvents = new Set<string>();
  readonly #maxAgeMilliseconds: number;

  constructor(allowedTargets: readonly string[], maxAgeMilliseconds: number) {
    if (maxAgeMilliseconds < 1) throw new Error('WEBHOOK_MAX_AGE_INVALID');
    this.#allowedTargets = new Set(allowedTargets);
    this.#maxAgeMilliseconds = maxAgeMilliseconds;
  }

  accept(event: WebhookEvent, now: string): WebhookDecision {
    let reason: WebhookDecision['reason'] = 'ACCEPTED';
    if (!event.signatureVerified) reason = 'SIGNATURE_INVALID';
    else if (!this.#allowedTargets.has(event.targetId)) reason = 'TARGET_NOT_ALLOWED';
    else if (this.#seenEvents.has(event.eventId)) reason = 'REPLAY_REJECTED';
    else if (
      !Number.isFinite(Date.parse(event.sentAt)) ||
      Math.abs(Date.parse(now) - Date.parse(event.sentAt)) > this.#maxAgeMilliseconds
    )
      reason = 'EVENT_EXPIRED';
    if (reason === 'ACCEPTED') this.#seenEvents.add(event.eventId);
    return { accepted: reason === 'ACCEPTED', reason };
  }
}

export type McpNodeMapping = Readonly<{
  mappingId: string;
  direction: 'mcp-tool-to-node' | 'node-to-mcp-tool';
  confirmedBy: string;
  sourceId: string;
  publishedId: string;
  version: string;
  externalRevision: string;
  inputSchema: OpenToolDescriptor['inputSchema'];
  outputSchema: OpenToolDescriptor['outputSchema'];
  permissions: readonly string[];
  egress: OpenToolDescriptor['egress'];
  cost: OpenToolDescriptor['cost'];
  effects: OpenToolDescriptor['effects'];
  cancellation: OpenToolDescriptor['cancellation'];
  errorCodes: readonly string[];
  extensions: readonly ProtocolExtension[];
  revoked: boolean;
  limitations: readonly string[];
}>;

export const mapMcpToolToNode = (
  tool: OpenToolDescriptor,
  confirmedBy: string,
  knownExtensionNamespaces: readonly string[] = []
): McpNodeMapping => {
  if (tool.transport !== 'mcp') throw new Error('MCP_MAPPING_SOURCE_REQUIRED');
  if (!confirmedBy) throw new Error('MCP_MAPPING_CONFIRMATION_REQUIRED');
  const unknownSecurity = tool.extensions.find(
    (extension) =>
      securityKinds.has(extension.kind) && !knownExtensionNamespaces.includes(extension.namespace)
  );
  if (unknownSecurity)
    throw new Error(
      `MCP_MAPPING_UNKNOWN_SECURITY_EXTENSION:${unknownSecurity.namespace}:${unknownSecurity.kind}`
    );
  return {
    mappingId: `mapping:${tool.id}@${tool.version}`,
    direction: 'mcp-tool-to-node',
    confirmedBy,
    sourceId: tool.id,
    publishedId: `mj.node/mcp/${tool.id}`,
    version: tool.version,
    externalRevision: tool.externalRevision,
    inputSchema: structuredClone(tool.inputSchema),
    outputSchema: structuredClone(tool.outputSchema),
    permissions: [...tool.permissions],
    egress: structuredClone(tool.egress),
    cost: structuredClone(tool.cost),
    effects: [...tool.effects],
    cancellation: tool.cancellation,
    errorCodes: [...tool.errorCodes],
    extensions: structuredClone(tool.extensions),
    revoked: tool.revoked,
    limitations: []
  };
};

export const publishNodeAsMcpTool = (
  node: McpNodeMapping,
  selectedInputs: readonly string[],
  selectedOutputs: readonly string[],
  confirmedBy: string
): McpNodeMapping => {
  if (!confirmedBy) throw new Error('MCP_PUBLICATION_CONFIRMATION_REQUIRED');
  const inputSchema = Object.fromEntries(
    Object.entries(node.inputSchema).filter(([name]) => selectedInputs.includes(name))
  );
  const outputSchema = Object.fromEntries(
    Object.entries(node.outputSchema).filter(([name]) => selectedOutputs.includes(name))
  );
  if (!Object.keys(inputSchema).length || !Object.keys(outputSchema).length)
    throw new Error('MCP_PUBLIC_IO_SELECTION_REQUIRED');
  return {
    ...structuredClone(node),
    mappingId: `publication:${node.mappingId}`,
    direction: 'node-to-mcp-tool',
    confirmedBy,
    sourceId: node.publishedId,
    publishedId: `mcp.tool/${node.sourceId}`,
    inputSchema,
    outputSchema
  };
};

export const revokeMcpMapping = (mapping: McpNodeMapping): McpNodeMapping => ({
  ...structuredClone(mapping),
  revoked: true
});

const fixtureDescriptor = (transport: OpenTransport): OpenToolDescriptor => ({
  id: `fixture.${transport}.lookup`,
  version: '1.0.0',
  transport,
  externalRevision: `fixture-${transport}-revision-1`,
  verification: 'isolated-fixture',
  inputSchema: { query: 'string' },
  outputSchema: { result: 'string' },
  permissions: ['fixture.project.read'],
  egress: {
    mode: transport === 'mcp' ? 'none' : 'declared',
    recipient: transport === 'mcp' ? '本地夹具' : `${transport} 隔离接收方`,
    fields: transport === 'mcp' ? [] : ['query']
  },
  cost: { amount: 0, currency: 'synthetic-unit' },
  effects: ['none'],
  cancellation: 'supported',
  errorCodes: ['PERMISSION_DENIED', 'CANCELLED'],
  extensions: [
    { namespace: 'urn:fixture:ordinary', kind: 'ordinary', value: { label: transport } }
  ],
  revoked: false
});

export const runOpenToolConformanceFixtures = () => {
  const transports = ['mcp', 'a2a', 'openapi', 'webhook'] as const;
  const records = transports.map((transport) =>
    invokeOpenToolFixture({
      invocationId: `fixture-invocation-${transport}`,
      descriptor: fixtureDescriptor(transport),
      grantedPermissions: ['fixture.project.read'],
      idempotencyKey: `fixture-idempotency-${transport}`,
      cancelled: transport === 'a2a'
    })
  );
  const mcpNode = mapMcpToolToNode(fixtureDescriptor('mcp'), 'fixture-actor');
  const mcpRoundTrip = publishNodeAsMcpTool(mcpNode, ['query'], ['result'], 'fixture-publisher');
  const a2a = new ReferenceA2AHost();
  a2a.register({
    id: 'fixture-independent-agent',
    version: '1.0.0',
    externalRevision: 'fixture-a2a-revision-1',
    skills: ['fixture.lookup'],
    inputSchema: { query: 'string' },
    outputSchema: { result: 'string' }
  });
  const discovered = a2a.discover('fixture.lookup');
  a2a.delegate('fixture-a2a-task', discovered[0]?.id ?? 'missing');
  a2a.progress('fixture-a2a-task', '已接收');
  a2a.progress('fixture-a2a-task', '正在处理');
  a2a.handoffArtifact('fixture-a2a-task', {
    id: 'fixture-artifact',
    value: { result: 'candidate' }
  });
  const cancelled = a2a.cancel('fixture-a2a-task');
  const webhook = new ReferenceWebhookGuard(['fixture-events'], 60_000);
  const webhookEvent = {
    eventId: 'fixture-event',
    targetId: 'fixture-events',
    sentAt: '2026-08-24T00:00:00.000Z',
    signatureVerified: true
  };
  const webhookAccepted = webhook.accept(webhookEvent, '2026-08-24T00:00:01.000Z');
  const webhookReplay = webhook.accept(webhookEvent, '2026-08-24T00:00:02.000Z');
  return {
    suiteVersion: openToolReferenceImplementationVersion,
    evidenceLevel: 'isolated-fixture' as const,
    externalCertification: false as const,
    records,
    a2a: {
      discovery: discovered.length === 1,
      delegated: true,
      progressEvents: cancelled.progress.length,
      cancelled: cancelled.status === 'cancelled',
      artifactHandoff: cancelled.artifacts.length === 1
    },
    webhook: {
      signatureVerified: webhookAccepted.accepted,
      duplicateRejected: !webhookReplay.accepted,
      replayRejected: webhookReplay.reason === 'REPLAY_REJECTED'
    },
    mcpRoundTrip,
    formalWrite: false as const
  };
};
