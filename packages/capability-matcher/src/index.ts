import type { StableRef } from '@mojing/protocol-spec';

export const capabilityManagementSchemaVersion = '1.0.0' as const;

export type ManagedCapabilityKind =
  | 'external-runtime'
  | 'extension'
  | 'node-package'
  | 'tool'
  | 'connector'
  | 'model'
  | 'skill'
  | 'mcp-service'
  | 'agent'
  | 'workflow-application';

export type CapabilityLifecycleState = 'enabled' | 'disabled' | 'revoked' | 'unavailable';
export type CapabilityVerificationStatus = 'verified' | 'failed' | 'not-tested';

export type CapabilityFeatureClaim = Readonly<{
  feature: string;
  supported: boolean;
  detail: string;
}>;

export type ManagedCapability = Readonly<{
  schemaVersion: typeof capabilityManagementSchemaVersion;
  id: StableRef;
  kind: ManagedCapabilityKind;
  name: string;
  summary: string;
  source: Readonly<{
    publisher: string;
    origin: string;
    license: string;
  }>;
  inputs: readonly string[];
  outputs: readonly string[];
  permissions: readonly string[];
  effects: readonly string[];
  egress: Readonly<{
    mode: 'none' | 'optional' | 'required';
    recipient: string;
    dataScope: string;
    retention: string;
  }>;
  cost: Readonly<{
    amount: number | null;
    unit: string;
    source: string;
  }>;
  resources: readonly string[];
  availability: Readonly<{
    available: boolean;
    reason: string;
  }>;
  declaredCapabilities: readonly CapabilityFeatureClaim[];
  verification: Readonly<{
    status: CapabilityVerificationStatus;
    fixture: string;
    testedAt: string | null;
    capabilities: readonly CapabilityFeatureClaim[];
    evidence: readonly string[];
  }>;
  alternatives: readonly StableRef[];
  defaultLifecycle: CapabilityLifecycleState;
}>;

export type CapabilityRouteRequirement = Readonly<{
  kind: ManagedCapabilityKind;
  requiredFeatures: readonly string[];
  allowEgress: boolean;
}>;

export type CapabilityRouteDecision = Readonly<{
  eligible: boolean;
  reasons: readonly string[];
}>;

const featureMap = (claims: readonly CapabilityFeatureClaim[]) =>
  new Map(claims.map((claim) => [claim.feature, claim]));

const lifecycleLabels: Readonly<Record<CapabilityLifecycleState, string>> = {
  enabled: '已启用',
  disabled: '已停用',
  revoked: '已撤销',
  unavailable: '不可用'
};

export const evaluateCapabilityRoute = (
  capability: ManagedCapability,
  lifecycle: CapabilityLifecycleState,
  requirement: CapabilityRouteRequirement
): CapabilityRouteDecision => {
  const reasons: string[] = [];
  if (capability.kind !== requirement.kind) reasons.push('能力类型不匹配。');
  if (lifecycle !== 'enabled') reasons.push(`能力当前${lifecycleLabels[lifecycle]}。`);
  if (!capability.availability.available) reasons.push(capability.availability.reason);
  if (capability.verification.status !== 'verified') reasons.push('能力尚未通过墨境实测。');
  if (!requirement.allowEgress && capability.egress.mode !== 'none')
    reasons.push('任务不允许数据外发。');
  const verified = featureMap(capability.verification.capabilities);
  for (const feature of requirement.requiredFeatures) {
    if (verified.get(feature)?.supported !== true) reasons.push(`实测不支持：${feature}。`);
  }
  return { eligible: reasons.length === 0, reasons };
};

export class CapabilityManagementRegistry {
  readonly #versions = new Map<string, ManagedCapability>();

  register(capability: ManagedCapability): void {
    if (capability.schemaVersion !== capabilityManagementSchemaVersion)
      throw new Error('CAPABILITY_MANAGEMENT_SCHEMA_UNSUPPORTED');
    if (!capability.id.id || !capability.id.typeId || !capability.id.version)
      throw new Error('CAPABILITY_MANAGEMENT_ID_INVALID');
    if (!capability.name || !capability.source.origin || !capability.source.license)
      throw new Error('CAPABILITY_MANAGEMENT_METADATA_INCOMPLETE');
    const key = `${capability.id.typeId}:${capability.id.id}:${capability.id.version}`;
    if (this.#versions.has(key)) throw new Error('CAPABILITY_MANAGEMENT_VERSION_EXISTS');
    this.#versions.set(key, structuredClone(capability));
  }

  list(): ManagedCapability[] {
    return [...this.#versions.values()].map((capability) => structuredClone(capability));
  }
}
