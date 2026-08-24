export const adapterSdkVersion = '0.1.0' as const;
export const adapterContractVersion = '1.0.0' as const;

export type AdapterValue =
  null | boolean | number | string | AdapterValue[] | { [key: string]: AdapterValue };

export type AdapterCapability = 'structured-transform' | 'streaming' | 'cancellation' | 'recovery';

export type AdapterDescriptor = Readonly<{
  id: string;
  version: string;
  contractVersion: typeof adapterContractVersion;
  nativeIdentity: string;
  nameZh: string;
  helpZh: string;
  capabilities: readonly AdapterCapability[];
  unsupportedCapabilities: readonly Readonly<{ capability: AdapterCapability; reason: string }>[];
  permissions: readonly string[];
  effects: readonly ('none' | 'candidate')[];
  cost: Readonly<{ amount: number; unit: 'synthetic-unit' }>;
  source: Readonly<{ publisher: string; origin: string; license: string }>;
  compatibility: Readonly<{
    productVersion: string;
    protocolRevision: string;
    environment: string;
    verifiedAt: string;
    supportUntil: string;
  }>;
  privateSourceRequired: false;
  authoritativeDatabaseAccess: false;
  approvalAuthority: false;
  formalWrite: false;
}>;

export type AdapterRequest = Readonly<{
  invocationId: string;
  input: Readonly<Record<string, AdapterValue>>;
  grantedPermissions: readonly string[];
  signal: AbortSignal;
  resumeFrom: string | null;
}>;

export type AdapterResult = Readonly<{
  status: 'completed' | 'cancelled' | 'failed';
  output: Readonly<Record<string, AdapterValue>>;
  candidate: boolean;
  checkpoint: string | null;
  error: string | null;
  evidence: readonly string[];
  formalWrite: false;
}>;

export type PublicAdapter = Readonly<{
  descriptor: AdapterDescriptor;
  discover: () => AdapterDescriptor;
  run: (request: AdapterRequest) => Promise<AdapterResult>;
}>;

const clone = <T>(value: T): T => structuredClone(value);

export const defineAdapter = (adapter: PublicAdapter): PublicAdapter => {
  const descriptor = adapter.descriptor;
  if (
    descriptor.contractVersion !== adapterContractVersion ||
    !descriptor.id ||
    !descriptor.version ||
    !descriptor.nameZh ||
    !descriptor.helpZh
  )
    throw new Error('ADAPTER_DESCRIPTOR_INVALID');
  if (
    descriptor.privateSourceRequired !== false ||
    descriptor.authoritativeDatabaseAccess !== false ||
    descriptor.approvalAuthority !== false ||
    descriptor.formalWrite !== false
  )
    throw new Error('ADAPTER_PRIVATE_OR_FORMAL_CHANNEL_FORBIDDEN');
  const declared = new Set(descriptor.capabilities);
  if (
    descriptor.unsupportedCapabilities.some((item) => declared.has(item.capability) || !item.reason)
  )
    throw new Error('ADAPTER_CAPABILITY_DISCLOSURE_INVALID');
  return Object.freeze({
    descriptor: clone(descriptor),
    discover: adapter.discover,
    run: adapter.run
  });
};

const makeDescriptor = (
  id: string,
  capabilities: readonly AdapterCapability[],
  unsupportedCapabilities: AdapterDescriptor['unsupportedCapabilities']
): AdapterDescriptor => ({
  id,
  version: '1.0.0',
  contractVersion: adapterContractVersion,
  nativeIdentity: `fixture-native:${id}@1.0.0`,
  nameZh: id === 'fixture.executor.full' ? '完整文本执行器' : '受限文本执行器',
  helpZh:
    id === 'fixture.executor.full'
      ? '生成可恢复的结构化文本候选，支持取消。'
      : '只生成大写文本候选，不支持取消确认或恢复。',
  capabilities,
  unsupportedCapabilities,
  permissions: ['fixture.text.read'],
  effects: ['candidate'],
  cost: { amount: 0, unit: 'synthetic-unit' },
  source: { publisher: 'Mojing fixture', origin: `fixture://${id}`, license: '测试夹具，不分发' },
  compatibility: {
    productVersion: '0.1.0-mvp',
    protocolRevision: adapterContractVersion,
    environment: 'isolated-local-fixture',
    verifiedAt: '2026-08-24T00:00:00.000Z',
    supportUntil: 'fixture-only'
  },
  privateSourceRequired: false,
  authoritativeDatabaseAccess: false,
  approvalAuthority: false,
  formalWrite: false
});

const runFixture = async (
  descriptor: AdapterDescriptor,
  request: AdapterRequest
): Promise<AdapterResult> => {
  if (
    !descriptor.permissions.every((permission) => request.grantedPermissions.includes(permission))
  )
    return {
      status: 'failed',
      output: {},
      candidate: false,
      checkpoint: null,
      error: 'PERMISSION_DENIED',
      evidence: [`adapter:${descriptor.id}`, `invocation:${request.invocationId}`],
      formalWrite: false
    };
  if (request.signal.aborted) {
    if (descriptor.capabilities.includes('cancellation'))
      return {
        status: 'cancelled',
        output: {},
        candidate: false,
        checkpoint: 'before-transform',
        error: 'CANCELLED',
        evidence: [`adapter:${descriptor.id}`, `invocation:${request.invocationId}`],
        formalWrite: false
      };
    return {
      status: 'failed',
      output: {},
      candidate: false,
      checkpoint: null,
      error: 'CANCELLATION_UNSUPPORTED',
      evidence: [`adapter:${descriptor.id}`, `invocation:${request.invocationId}`],
      formalWrite: false
    };
  }
  const text = request.input.text;
  if (typeof text !== 'string')
    return {
      status: 'failed',
      output: {},
      candidate: false,
      checkpoint: null,
      error: 'INVALID_INPUT',
      evidence: [`adapter:${descriptor.id}`, `invocation:${request.invocationId}`],
      formalWrite: false
    };
  const transformed =
    descriptor.id === 'fixture.executor.full'
      ? text
          .trim()
          .split(/\s+/)
          .map((word) => word[0]?.toLocaleUpperCase('zh-CN') + word.slice(1))
          .join(' ')
      : text.toLocaleUpperCase('zh-CN');
  return {
    status: 'completed',
    output: { text: transformed, executor: descriptor.nativeIdentity },
    candidate: true,
    checkpoint: descriptor.capabilities.includes('recovery') ? 'transform-completed' : null,
    error: null,
    evidence: [
      `adapter:${descriptor.id}`,
      `invocation:${request.invocationId}`,
      ...(request.resumeFrom ? [`resumed:${request.resumeFrom}`] : [])
    ],
    formalWrite: false
  };
};

const createFixtureAdapter = (descriptor: AdapterDescriptor): PublicAdapter =>
  defineAdapter({
    descriptor,
    discover: () => clone(descriptor),
    run: (request) => runFixture(descriptor, request)
  });

export const createFixedAdapterFixtures = (): readonly [PublicAdapter, PublicAdapter] => [
  createFixtureAdapter(
    makeDescriptor(
      'fixture.executor.full',
      ['structured-transform', 'streaming', 'cancellation', 'recovery'],
      []
    )
  ),
  createFixtureAdapter(
    makeDescriptor(
      'fixture.executor.limited',
      ['structured-transform'],
      [
        { capability: 'streaming', reason: '固定执行器只返回完整结果。' },
        { capability: 'cancellation', reason: '底层没有取消确认接口。' },
        { capability: 'recovery', reason: '底层没有可恢复检查点。' }
      ]
    )
  )
];

export type AdapterConformanceReport = Readonly<{
  adapterId: string;
  sdkVersion: typeof adapterSdkVersion;
  evidenceLevel: 'isolated-fixture';
  checks: Readonly<
    Record<
      | 'discovery'
      | 'permission'
      | 'run'
      | 'cancel'
      | 'error'
      | 'candidate'
      | 'evidence'
      | 'recovery'
      | 'upgrade',
      Readonly<{ passed: boolean; result: string }>
    >
  >;
  passed: boolean;
  externalCompatibilityClaim: false;
}>;

export const runAdapterConformance = async (
  adapter: PublicAdapter
): Promise<AdapterConformanceReport> => {
  const discovered = adapter.discover();
  const allowed = await adapter.run({
    invocationId: 'conformance-success',
    input: { text: 'mojing adapter' },
    grantedPermissions: [...adapter.descriptor.permissions],
    signal: new AbortController().signal,
    resumeFrom: adapter.descriptor.capabilities.includes('recovery') ? 'before-transform' : null
  });
  const denied = await adapter.run({
    invocationId: 'conformance-denied',
    input: { text: 'private' },
    grantedPermissions: [],
    signal: new AbortController().signal,
    resumeFrom: null
  });
  const controller = new AbortController();
  controller.abort();
  const cancelled = await adapter.run({
    invocationId: 'conformance-cancel',
    input: { text: 'cancel' },
    grantedPermissions: [...adapter.descriptor.permissions],
    signal: controller.signal,
    resumeFrom: null
  });
  const invalid = await adapter.run({
    invocationId: 'conformance-error',
    input: {},
    grantedPermissions: [...adapter.descriptor.permissions],
    signal: new AbortController().signal,
    resumeFrom: null
  });
  const supportsCancellation = adapter.descriptor.capabilities.includes('cancellation');
  const supportsRecovery = adapter.descriptor.capabilities.includes('recovery');
  const checks: AdapterConformanceReport['checks'] = {
    discovery: {
      passed: discovered.id === adapter.descriptor.id,
      result: discovered.nativeIdentity
    },
    permission: { passed: denied.error === 'PERMISSION_DENIED', result: denied.error ?? 'missing' },
    run: { passed: allowed.status === 'completed', result: allowed.status },
    cancel: {
      passed: supportsCancellation
        ? cancelled.status === 'cancelled'
        : cancelled.error === 'CANCELLATION_UNSUPPORTED',
      result: supportsCancellation ? cancelled.status : 'unsupported-disclosed'
    },
    error: { passed: invalid.error === 'INVALID_INPUT', result: invalid.error ?? 'missing' },
    candidate: { passed: allowed.candidate && !allowed.formalWrite, result: 'candidate-only' },
    evidence: { passed: allowed.evidence.length >= 2, result: allowed.evidence.join(',') },
    recovery: {
      passed: supportsRecovery
        ? allowed.evidence.includes('resumed:before-transform')
        : allowed.checkpoint === null,
      result: supportsRecovery ? 'restored' : 'unsupported-disclosed'
    },
    upgrade: {
      passed: discovered.compatibility.protocolRevision === adapterContractVersion,
      result: `${discovered.version}/${discovered.compatibility.protocolRevision}`
    }
  };
  return {
    adapterId: adapter.descriptor.id,
    sdkVersion: adapterSdkVersion,
    evidenceLevel: 'isolated-fixture',
    checks,
    passed: Object.values(checks).every((check) => check.passed),
    externalCompatibilityClaim: false
  };
};

export type NativeSourceSnapshot = Readonly<{
  id: string;
  version: string;
  contentDigest: string;
  values: Readonly<Record<string, AdapterValue>>;
  unknownPayload: Readonly<Record<string, AdapterValue>>;
}>;

export type NativeSourceRecord = Readonly<{
  source: NativeSourceSnapshot;
  mapping: Readonly<{ id: string; version: string; fidelity: 'verified' | 'review-required' }>;
  workflow: Readonly<{ id: string; version: string }>;
  run: Readonly<{ id: string; workflowVersion: string }>;
  candidate: Readonly<{ id: string; runId: string }>;
  formalVersion: Readonly<{ id: string; version: string }>;
}>;

export type ThreeWayDifference = Readonly<{
  field: string;
  base: AdapterValue | undefined;
  native: AdapterValue | undefined;
  mojing: AdapterValue | undefined;
  conflict: boolean;
  unknownPayloadFidelityInvalidated: boolean;
}>;

export const compareNativeSource = (
  base: NativeSourceSnapshot,
  native: NativeSourceSnapshot,
  mojing: NativeSourceSnapshot
): readonly ThreeWayDifference[] => {
  const fields = new Set([
    ...Object.keys(base.values),
    ...Object.keys(native.values),
    ...Object.keys(mojing.values)
  ]);
  return [...fields]
    .filter(
      (field) =>
        JSON.stringify(native.values[field]) !== JSON.stringify(base.values[field]) ||
        JSON.stringify(mojing.values[field]) !== JSON.stringify(base.values[field])
    )
    .map((field) => ({
      field,
      base: clone(base.values[field]),
      native: clone(native.values[field]),
      mojing: clone(mojing.values[field]),
      conflict:
        JSON.stringify(native.values[field]) !== JSON.stringify(base.values[field]) &&
        JSON.stringify(mojing.values[field]) !== JSON.stringify(base.values[field]) &&
        JSON.stringify(native.values[field]) !== JSON.stringify(mojing.values[field]),
      unknownPayloadFidelityInvalidated:
        Object.keys(base.unknownPayload).length > 0 &&
        (JSON.stringify(native.values[field]) !== JSON.stringify(base.values[field]) ||
          JSON.stringify(mojing.values[field]) !== JSON.stringify(base.values[field]))
    }));
};

export type AdapterCandidateEvidence = Readonly<{
  build: 'passed' | 'failed';
  simulator: 'passed' | 'failed';
  conformance: 'passed' | 'failed';
  security: 'passed' | 'failed';
  license: 'passed' | 'failed';
  sbom: 'present' | 'missing';
  signature: 'verified' | 'not-configured' | 'failed';
  humanReview: 'approved' | 'pending' | 'rejected';
}>;

export type AdapterCandidate = Readonly<{
  id: string;
  version: string;
  generatedBy: string;
  sourceTemplate: string;
  permissions: readonly string[];
  dependencies: readonly string[];
  revoked: boolean;
  distributionAuthorization: 'not-granted';
}>;

export const evaluateAdapterCandidate = (
  candidate: AdapterCandidate,
  evidence: AdapterCandidateEvidence
) => {
  const gates = {
    build: evidence.build === 'passed',
    simulator: evidence.simulator === 'passed',
    conformance: evidence.conformance === 'passed',
    security: evidence.security === 'passed',
    license: evidence.license === 'passed',
    sbom: evidence.sbom === 'present',
    signature: evidence.signature === 'verified',
    humanReview: evidence.humanReview === 'approved',
    revocation: !candidate.revoked
  };
  return {
    candidate: clone(candidate),
    gates,
    isolatedInstallationEligible: Object.values(gates).every(Boolean),
    externalPublicationEligible: false as const,
    formalWrite: false as const,
    reason:
      Object.entries(gates)
        .filter(([, passed]) => !passed)
        .map(([name]) => name)
        .join(',') || 'ISOLATED_INSTALLATION_GATES_PASSED'
  };
};
