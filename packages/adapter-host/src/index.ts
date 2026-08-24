import {
  adapterContractVersion,
  defineAdapter,
  type AdapterDescriptor,
  type AdapterResult,
  type AdapterValue,
  type PublicAdapter
} from '@mojing/adapter-sdk';

export const adapterHostVersion = '0.1.0' as const;
export const compatibilityMatrixSchemaVersion = 'mj.compatibility-matrix/v1' as const;

export type CompatibilityMatrixEntry = Readonly<{
  id: string;
  productVersion: string;
  protocolRevision: string;
  implementation: Readonly<{ id: string; version: string }>;
  environment: Readonly<{
    runtime: string;
    operatingSystem: string;
    dependencies: readonly string[];
  }>;
  supportedCapabilities: readonly string[];
  unsupportedCapabilities: readonly Readonly<{ capability: string; reason: string }>[];
  isolation: string;
  evidenceLevel: 'isolated-fixture' | 'real-environment';
  verifiedAt: string | null;
  supportUntil: string | null;
  evidence: readonly string[];
}>;

export type CompatibilityMatrix = Readonly<{
  schemaVersion: typeof compatibilityMatrixSchemaVersion;
  entries: readonly CompatibilityMatrixEntry[];
}>;

export type CompatibilityMatrixValidation = Readonly<{
  passed: boolean;
  checks: Readonly<{
    schemaVersion: boolean;
    uniqueEntries: boolean;
    metadataComplete: boolean;
    capabilityClaimsDisjoint: boolean;
    datesValid: boolean;
    fixtureClaimsHonest: boolean;
  }>;
  errors: readonly string[];
}>;

export type ExternalPermissionGrant = Readonly<{
  grantId: string;
  issuedBy: 'external-authority';
  subject: string;
  adapters: readonly Readonly<{ id: string; version: string }>[];
  permissions: readonly string[];
  expiresAt: string;
}>;

export type AdapterHostInvocation = Readonly<{
  invocationId: string;
  adapterId: string;
  adapterVersion: string;
  input: Readonly<Record<string, AdapterValue>>;
  grant: ExternalPermissionGrant;
  signal: AbortSignal;
  resumeFrom: string | null;
}>;

export type AdapterHostInvocationResult = Readonly<{
  accepted: boolean;
  reason: string;
  result: AdapterResult | null;
  auditRef: string;
  approvalGrantedByHost: false;
  formalWriteByHost: false;
  grantRetained: false;
}>;

export type AdapterHostAuditEvent = Readonly<{
  sequence: number;
  auditRef: string;
  event: 'registered' | 'revoked' | 'invocation-rejected' | 'invocation-completed';
  adapterId: string;
  adapterVersion: string;
  invocationId: string | null;
  grantId: string | null;
  reason: string;
  inputStored: false;
  credentialStored: false;
}>;

const entryKey = (entry: CompatibilityMatrixEntry) =>
  `${entry.id}:${entry.implementation.id}@${entry.implementation.version}:${entry.protocolRevision}`;

export const validateCompatibilityMatrix = (
  matrix: CompatibilityMatrix
): CompatibilityMatrixValidation => {
  const errors: string[] = [];
  const keys = matrix.entries.map(entryKey);
  const checks = {
    schemaVersion: matrix.schemaVersion === compatibilityMatrixSchemaVersion,
    uniqueEntries: new Set(keys).size === keys.length,
    metadataComplete: matrix.entries.every((entry) =>
      Boolean(
        entry.id &&
        entry.productVersion &&
        entry.protocolRevision &&
        entry.implementation.id &&
        entry.implementation.version &&
        entry.environment.runtime &&
        entry.environment.operatingSystem &&
        entry.isolation &&
        entry.evidence.length
      )
    ),
    capabilityClaimsDisjoint: matrix.entries.every((entry) => {
      const supported = new Set(entry.supportedCapabilities);
      return entry.unsupportedCapabilities.every(
        (claim) => !supported.has(claim.capability) && Boolean(claim.reason)
      );
    }),
    datesValid: matrix.entries.every(
      (entry) =>
        (entry.verifiedAt === null || Number.isFinite(Date.parse(entry.verifiedAt))) &&
        (entry.supportUntil === null || Number.isFinite(Date.parse(entry.supportUntil)))
    ),
    fixtureClaimsHonest: matrix.entries.every(
      (entry) =>
        entry.evidenceLevel !== 'isolated-fixture' ||
        (entry.verifiedAt !== null && entry.evidence.every((item) => item.startsWith('fixture:')))
    )
  };
  for (const [name, passed] of Object.entries(checks)) if (!passed) errors.push(name);
  return Object.freeze({ passed: errors.length === 0, checks: Object.freeze(checks), errors });
};

const referenceDescriptor: AdapterDescriptor = {
  id: 'reference.text.transform',
  version: '1.0.0',
  contractVersion: adapterContractVersion,
  nativeIdentity: 'mojing-reference:text-transform@1.0.0',
  nameZh: '通用文本转换参考 Adapter',
  helpZh: '对公开输入执行确定性 trim、uppercase 或 lowercase，只产生候选。',
  capabilities: ['structured-transform', 'cancellation'],
  unsupportedCapabilities: [
    { capability: 'streaming', reason: '确定性参考实现只返回完整结果。' },
    { capability: 'recovery', reason: '单步纯函数转换没有恢复检查点。' }
  ],
  permissions: ['reference.text.read'],
  effects: ['candidate'],
  cost: { amount: 0, unit: 'synthetic-unit' },
  source: {
    publisher: 'Mojing contributors',
    origin: 'package:@mojing/adapter-host/reference.text.transform',
    license: 'Apache-2.0'
  },
  compatibility: {
    productVersion: adapterHostVersion,
    protocolRevision: adapterContractVersion,
    environment: 'standalone-es2023',
    verifiedAt: '2026-08-24T00:00:00.000Z',
    supportUntil: 'fixture-only'
  },
  privateSourceRequired: false,
  authoritativeDatabaseAccess: false,
  approvalAuthority: false,
  formalWrite: false
};

const adapterEvidence = (descriptor: AdapterDescriptor, invocationId: string) => [
  `adapter:${descriptor.id}@${descriptor.version}`,
  `invocation:${invocationId}`,
  'implementation:mojing-reference-text-transform/v1'
];

export const createReferenceTextAdapter = (): PublicAdapter =>
  defineAdapter({
    descriptor: referenceDescriptor,
    discover: () => structuredClone(referenceDescriptor),
    async run(request): Promise<AdapterResult> {
      if (
        !referenceDescriptor.permissions.every((item) => request.grantedPermissions.includes(item))
      )
        return {
          status: 'failed',
          output: {},
          candidate: false,
          checkpoint: null,
          error: 'PERMISSION_DENIED',
          evidence: adapterEvidence(referenceDescriptor, request.invocationId),
          formalWrite: false
        };
      if (request.signal.aborted)
        return {
          status: 'cancelled',
          output: {},
          candidate: false,
          checkpoint: null,
          error: 'CANCELLED',
          evidence: adapterEvidence(referenceDescriptor, request.invocationId),
          formalWrite: false
        };
      const text = request.input.text;
      const operation = request.input.operation;
      if (
        typeof text !== 'string' ||
        !['trim', 'uppercase', 'lowercase'].includes(String(operation))
      )
        return {
          status: 'failed',
          output: {},
          candidate: false,
          checkpoint: null,
          error: 'INVALID_INPUT',
          evidence: adapterEvidence(referenceDescriptor, request.invocationId),
          formalWrite: false
        };
      const output =
        operation === 'uppercase'
          ? text.toLocaleUpperCase('zh-CN')
          : operation === 'lowercase'
            ? text.toLocaleLowerCase('zh-CN')
            : text.trim();
      return {
        status: 'completed',
        output: { text: output },
        candidate: true,
        checkpoint: null,
        error: null,
        evidence: adapterEvidence(referenceDescriptor, request.invocationId),
        formalWrite: false
      };
    }
  });

export const fixedAdapterCompatibilityMatrix = Object.freeze<CompatibilityMatrix>({
  schemaVersion: compatibilityMatrixSchemaVersion,
  entries: [
    {
      id: 'reference.text.transform.fixture.v1',
      productVersion: adapterHostVersion,
      protocolRevision: adapterContractVersion,
      implementation: { id: referenceDescriptor.id, version: referenceDescriptor.version },
      environment: {
        runtime: 'Node.js 24.19.0 / browser ES2023',
        operatingSystem: 'isolated deterministic fixture',
        dependencies: ['@mojing/adapter-sdk@0.1.0']
      },
      supportedCapabilities: ['structured-transform', 'cancellation'],
      unsupportedCapabilities: referenceDescriptor.unsupportedCapabilities,
      isolation:
        'No network, subprocess, credential, authoritative data, approval or formal-write channel.',
      evidenceLevel: 'isolated-fixture',
      verifiedAt: '2026-08-24T00:00:00.000Z',
      supportUntil: null,
      evidence: [
        'fixture:reference-text-transform-unit',
        'fixture:adapter-host-permission-and-revocation-unit'
      ]
    }
  ]
});

export class AdapterHost {
  readonly #adapters = new Map<string, PublicAdapter>();
  readonly #revoked = new Set<string>();
  readonly #audit: AdapterHostAuditEvent[] = [];

  #key(adapterId: string, version: string): string {
    return `${adapterId}@${version}`;
  }

  #append(
    event: AdapterHostAuditEvent['event'],
    adapterId: string,
    adapterVersion: string,
    invocationId: string | null,
    grantId: string | null,
    reason: string
  ): string {
    const auditRef = `adapter-host-audit:${this.#audit.length + 1}`;
    this.#audit.push({
      sequence: this.#audit.length + 1,
      auditRef,
      event,
      adapterId,
      adapterVersion,
      invocationId,
      grantId,
      reason,
      inputStored: false,
      credentialStored: false
    });
    return auditRef;
  }

  register(adapter: PublicAdapter): void {
    const checked = defineAdapter(adapter);
    const discovered = checked.discover();
    if (
      discovered.id !== checked.descriptor.id ||
      discovered.version !== checked.descriptor.version ||
      discovered.contractVersion !== checked.descriptor.contractVersion
    )
      throw new Error('ADAPTER_HOST_DISCOVERY_IDENTITY_MISMATCH');
    const descriptor = structuredClone(checked.descriptor);
    const registered = Object.freeze({
      descriptor,
      discover: () => structuredClone(descriptor),
      run: checked.run
    });
    const key = this.#key(descriptor.id, descriptor.version);
    if (this.#adapters.has(key)) throw new Error('ADAPTER_HOST_VERSION_EXISTS');
    this.#adapters.set(key, registered);
    this.#append('registered', descriptor.id, descriptor.version, null, null, 'REGISTERED');
  }

  discover(): readonly AdapterDescriptor[] {
    return [...this.#adapters.entries()]
      .filter(([key]) => !this.#revoked.has(key))
      .map(([, adapter]) => structuredClone(adapter.discover()))
      .sort((left, right) =>
        this.#key(left.id, left.version).localeCompare(this.#key(right.id, right.version))
      );
  }

  revoke(adapterId: string, adapterVersion: string): boolean {
    const key = this.#key(adapterId, adapterVersion);
    if (!this.#adapters.has(key) || this.#revoked.has(key)) return false;
    this.#revoked.add(key);
    this.#append('revoked', adapterId, adapterVersion, null, null, 'REVOKED');
    return true;
  }

  async invoke(
    invocation: AdapterHostInvocation,
    now: string
  ): Promise<AdapterHostInvocationResult> {
    const key = this.#key(invocation.adapterId, invocation.adapterVersion);
    const adapter = this.#adapters.get(key);
    let reason = 'ACCEPTED';
    if (!adapter) reason = 'ADAPTER_NOT_FOUND';
    else if (this.#revoked.has(key)) reason = 'ADAPTER_REVOKED';
    else if (!invocation.grant.grantId || invocation.grant.issuedBy !== 'external-authority')
      reason = 'EXTERNAL_GRANT_REQUIRED';
    else if (
      !Number.isFinite(Date.parse(invocation.grant.expiresAt)) ||
      !Number.isFinite(Date.parse(now))
    )
      reason = 'GRANT_TIME_INVALID';
    else if (Date.parse(invocation.grant.expiresAt) <= Date.parse(now)) reason = 'GRANT_EXPIRED';
    else if (
      !invocation.grant.adapters.some(
        ({ id, version }) => id === invocation.adapterId && version === invocation.adapterVersion
      )
    )
      reason = 'GRANT_ADAPTER_SCOPE_INSUFFICIENT';
    else if (
      !adapter.descriptor.permissions.every((permission) =>
        invocation.grant.permissions.includes(permission)
      )
    )
      reason = 'GRANT_PERMISSION_SCOPE_INSUFFICIENT';

    if (reason !== 'ACCEPTED' || !adapter) {
      const auditRef = this.#append(
        'invocation-rejected',
        invocation.adapterId,
        invocation.adapterVersion,
        invocation.invocationId,
        invocation.grant.grantId || null,
        reason
      );
      return {
        accepted: false,
        reason,
        result: null,
        auditRef,
        approvalGrantedByHost: false,
        formalWriteByHost: false,
        grantRetained: false
      };
    }

    let result: AdapterResult;
    try {
      const rawResult = await adapter.run({
        invocationId: invocation.invocationId,
        input: invocation.input,
        grantedPermissions: invocation.grant.permissions,
        signal: invocation.signal,
        resumeFrom: invocation.resumeFrom
      });
      if (
        rawResult.formalWrite !== false ||
        !['completed', 'cancelled', 'failed'].includes(rawResult.status) ||
        typeof rawResult.candidate !== 'boolean' ||
        typeof rawResult.output !== 'object' ||
        rawResult.output === null ||
        Array.isArray(rawResult.output) ||
        !Array.isArray(rawResult.evidence) ||
        !rawResult.evidence.every((item) => typeof item === 'string')
      )
        throw new Error('ADAPTER_RESULT_INVALID');
      result = structuredClone(rawResult);
    } catch {
      const auditRef = this.#append(
        'invocation-rejected',
        invocation.adapterId,
        invocation.adapterVersion,
        invocation.invocationId,
        invocation.grant.grantId,
        'ADAPTER_RUN_FAILED'
      );
      return {
        accepted: false,
        reason: 'ADAPTER_RUN_FAILED',
        result: null,
        auditRef,
        approvalGrantedByHost: false,
        formalWriteByHost: false,
        grantRetained: false
      };
    }
    const auditRef = this.#append(
      'invocation-completed',
      invocation.adapterId,
      invocation.adapterVersion,
      invocation.invocationId,
      invocation.grant.grantId,
      result.status
    );
    return {
      accepted: true,
      reason: result.status,
      result,
      auditRef,
      approvalGrantedByHost: false,
      formalWriteByHost: false,
      grantRetained: false
    };
  }

  audit(): readonly AdapterHostAuditEvent[] {
    return structuredClone(this.#audit);
  }
}
