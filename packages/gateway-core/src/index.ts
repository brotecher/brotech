export type GatewayCapabilityToken = Readonly<{
  tokenId: string;
  subject: string;
  audience: 'mojing-reference-gateway';
  projectIds: readonly string[];
  targetIds: readonly string[];
  permissions: readonly string[];
  expiresAt: string;
}>;

export type GatewayRequest = Readonly<{
  requestId: string;
  nonce: string;
  projectId: string;
  targetId: string;
  permission: string;
  token: GatewayCapabilityToken;
  approvedByControlPlane: boolean;
}>;

export type GatewayDecision = Readonly<{
  routed: boolean;
  reason: string;
  auditRef: string;
  credentialsExposed: false;
  approvalGrantedByGateway: false;
}>;

export type EdgeValue =
  null | boolean | number | string | readonly EdgeValue[] | Readonly<{ [key: string]: EdgeValue }>;

export type EdgeAuthorityLease = Readonly<{
  leaseId: string;
  issuedBy: 'external-authority';
  proxyId: string;
  subject: string;
  sequence: number;
  targetIds: readonly string[];
  permissions: readonly string[];
  issuedAt: string;
  expiresAt: string;
}>;

export type EdgeProxyPolicy = Readonly<{
  proxyId: string;
  policyVersion: string;
  allowedTargetIds: readonly string[];
  maxCommandTtlMs: number;
  maxPayloadBytes: number;
}>;

export type EdgeCommand = Readonly<{
  commandId: string;
  correlationId: string;
  nonce: string;
  proxyId: string;
  subject: string;
  leaseId: string;
  leaseSequence: number;
  targetId: string;
  permission: string;
  issuedAt: string;
  expiresAt: string;
  networkState: 'online' | 'offline';
  approvedByControlPlane: boolean;
  signatureVerifiedByControlPlane: boolean;
  payload: Readonly<Record<string, EdgeValue>>;
  signal: AbortSignal;
}>;

export type EdgeTransportReceipt = Readonly<{
  status: 'completed' | 'cancelled' | 'failed';
  evidence: readonly string[];
  formalWrite: false;
}>;

export type EdgeProxyTransport = (
  command: Readonly<{
    commandId: string;
    correlationId: string;
    targetId: string;
    permission: string;
    payload: Readonly<Record<string, EdgeValue>>;
    signal: AbortSignal;
  }>
) => EdgeTransportReceipt | Promise<EdgeTransportReceipt>;

export type EdgeDispatchDecision = Readonly<{
  accepted: boolean;
  transportInvoked: boolean;
  reason: string;
  receipt: EdgeTransportReceipt | null;
  auditRef: string;
  payloadStored: false;
  credentialStored: false;
  approvalGrantedByProxy: false;
  formalWriteByProxy: false;
}>;

export type EdgeProxyAuditEvent = Readonly<{
  sequence: number;
  auditRef: string;
  event:
    | 'lease-activated'
    | 'lease-rejected'
    | 'lease-revoked'
    | 'command-rejected'
    | 'command-finished';
  proxyId: string;
  policyVersion: string;
  leaseId: string;
  leaseSequence: number;
  subject: string;
  targetId: string | null;
  commandId: string | null;
  correlationId: string | null;
  reason: string;
  payloadStored: false;
  credentialStored: false;
  approvalGrantedByProxy: false;
  formalWriteByProxy: false;
}>;

export class ReferenceOpenGateway {
  readonly #allowedTargets: ReadonlySet<string>;
  readonly #seenNonces = new Set<string>();
  readonly #audit: GatewayDecision[] = [];

  constructor(allowedTargets: readonly string[]) {
    this.#allowedTargets = new Set(allowedTargets);
  }

  route(request: GatewayRequest, now: string): GatewayDecision {
    let reason = 'ROUTED_WITH_EXTERNAL_APPROVAL';
    if (request.token.audience !== 'mojing-reference-gateway') reason = 'TOKEN_AUDIENCE_INVALID';
    else if (
      !Number.isFinite(Date.parse(request.token.expiresAt)) ||
      !Number.isFinite(Date.parse(now))
    )
      reason = 'TOKEN_TIME_INVALID';
    else if (Date.parse(request.token.expiresAt) <= Date.parse(now)) reason = 'TOKEN_EXPIRED';
    else if (this.#seenNonces.has(request.nonce)) reason = 'REPLAY_REJECTED';
    else if (
      !this.#allowedTargets.has(request.targetId) ||
      !request.token.targetIds.includes(request.targetId)
    )
      reason = 'TARGET_NOT_ALLOWED';
    else if (!request.token.projectIds.includes(request.projectId))
      reason = 'PROJECT_NOT_AUTHORIZED';
    else if (!request.token.permissions.includes(request.permission))
      reason = 'TOKEN_SCOPE_INSUFFICIENT';
    else if (!request.approvedByControlPlane) reason = 'EXTERNAL_APPROVAL_REQUIRED';

    this.#seenNonces.add(request.nonce);
    const decision: GatewayDecision = {
      routed: reason === 'ROUTED_WITH_EXTERNAL_APPROVAL',
      reason,
      auditRef: `gateway-audit:${request.requestId}`,
      credentialsExposed: false,
      approvalGrantedByGateway: false
    };
    this.#audit.push(decision);
    return structuredClone(decision);
  }

  audit(): readonly GatewayDecision[] {
    return structuredClone(this.#audit);
  }
}

const validDate = (value: string): boolean => Number.isFinite(Date.parse(value));

const payloadBytes = (payload: Readonly<Record<string, EdgeValue>>): number =>
  new TextEncoder().encode(JSON.stringify(payload)).byteLength;

export class ReferenceEdgeProxy {
  readonly #policy: EdgeProxyPolicy;
  readonly #transport: EdgeProxyTransport;
  readonly #currentLeaseBySubject = new Map<string, EdgeAuthorityLease>();
  readonly #revokedLeaseIds = new Set<string>();
  readonly #seenNonces = new Set<string>();
  readonly #audit: EdgeProxyAuditEvent[] = [];

  constructor(policy: EdgeProxyPolicy, transport: EdgeProxyTransport) {
    if (
      !policy.proxyId ||
      !policy.policyVersion ||
      policy.allowedTargetIds.length === 0 ||
      !Number.isFinite(policy.maxCommandTtlMs) ||
      policy.maxCommandTtlMs <= 0 ||
      !Number.isFinite(policy.maxPayloadBytes) ||
      policy.maxPayloadBytes <= 0
    )
      throw new Error('EDGE_PROXY_POLICY_INVALID');
    this.#policy = Object.freeze({
      ...structuredClone(policy),
      allowedTargetIds: Object.freeze([...new Set(policy.allowedTargetIds)])
    });
    this.#transport = transport;
  }

  #append(
    event: EdgeProxyAuditEvent['event'],
    lease: Pick<EdgeAuthorityLease, 'leaseId' | 'sequence' | 'subject'>,
    reason: string,
    command: Pick<EdgeCommand, 'targetId' | 'commandId' | 'correlationId'> | null = null
  ): string {
    const auditRef = `edge-proxy-audit:${this.#audit.length + 1}`;
    this.#audit.push({
      sequence: this.#audit.length + 1,
      auditRef,
      event,
      proxyId: this.#policy.proxyId,
      policyVersion: this.#policy.policyVersion,
      leaseId: lease.leaseId,
      leaseSequence: lease.sequence,
      subject: lease.subject,
      targetId: command?.targetId ?? null,
      commandId: command?.commandId ?? null,
      correlationId: command?.correlationId ?? null,
      reason,
      payloadStored: false,
      credentialStored: false,
      approvalGrantedByProxy: false,
      formalWriteByProxy: false
    });
    return auditRef;
  }

  activateLease(
    lease: EdgeAuthorityLease,
    now: string
  ): Readonly<{ activated: boolean; reason: string; auditRef: string }> {
    let reason = 'LEASE_ACTIVATED';
    const issuedAt = Date.parse(lease.issuedAt);
    const expiresAt = Date.parse(lease.expiresAt);
    const currentTime = Date.parse(now);
    const current = this.#currentLeaseBySubject.get(lease.subject);
    if (!lease.leaseId || !lease.subject || lease.issuedBy !== 'external-authority')
      reason = 'EXTERNAL_LEASE_REQUIRED';
    else if (lease.proxyId !== this.#policy.proxyId) reason = 'LEASE_PROXY_MISMATCH';
    else if (!Number.isInteger(lease.sequence) || lease.sequence <= 0)
      reason = 'LEASE_SEQUENCE_INVALID';
    else if (![lease.issuedAt, lease.expiresAt, now].every(validDate) || issuedAt >= expiresAt)
      reason = 'LEASE_TIME_INVALID';
    else if (issuedAt > currentTime || expiresAt <= currentTime) reason = 'LEASE_NOT_CURRENT';
    else if (lease.targetIds.length === 0 || lease.permissions.length === 0)
      reason = 'LEASE_SCOPE_EMPTY';
    else if (lease.targetIds.some((targetId) => !this.#policy.allowedTargetIds.includes(targetId)))
      reason = 'LEASE_TARGET_NOT_ALLOWED';
    else if (this.#revokedLeaseIds.has(lease.leaseId)) reason = 'LEASE_REVOKED';
    else if (current && lease.sequence <= current.sequence) reason = 'LEASE_SEQUENCE_NOT_NEWER';

    if (reason === 'LEASE_ACTIVATED') {
      if (current) this.#revokedLeaseIds.add(current.leaseId);
      this.#currentLeaseBySubject.set(
        lease.subject,
        Object.freeze({
          ...structuredClone(lease),
          targetIds: Object.freeze([...new Set(lease.targetIds)]),
          permissions: Object.freeze([...new Set(lease.permissions)])
        })
      );
    }
    return {
      activated: reason === 'LEASE_ACTIVATED',
      reason,
      auditRef: this.#append(
        reason === 'LEASE_ACTIVATED' ? 'lease-activated' : 'lease-rejected',
        lease,
        reason
      )
    };
  }

  revokeLease(leaseId: string): boolean {
    const lease = [...this.#currentLeaseBySubject.values()].find(
      (item) => item.leaseId === leaseId
    );
    if (!lease || this.#revokedLeaseIds.has(leaseId)) return false;
    this.#revokedLeaseIds.add(leaseId);
    this.#append('lease-revoked', lease, 'LEASE_REVOKED');
    return true;
  }

  async dispatch(command: EdgeCommand, now: string): Promise<EdgeDispatchDecision> {
    const lease = this.#currentLeaseBySubject.get(command.subject);
    const commandIssuedAt = Date.parse(command.issuedAt);
    const commandExpiresAt = Date.parse(command.expiresAt);
    const currentTime = Date.parse(now);
    let reason = 'COMMAND_ACCEPTED';
    if (!lease) reason = 'LEASE_NOT_FOUND';
    else if (command.proxyId !== this.#policy.proxyId) reason = 'COMMAND_PROXY_MISMATCH';
    else if (
      command.leaseId !== lease.leaseId ||
      command.leaseSequence !== lease.sequence ||
      this.#revokedLeaseIds.has(command.leaseId)
    )
      reason = 'LEASE_NOT_CURRENT';
    else if (![command.issuedAt, command.expiresAt, now, lease.expiresAt].every(validDate))
      reason = 'COMMAND_TIME_INVALID';
    else if (
      commandIssuedAt > currentTime ||
      commandExpiresAt <= currentTime ||
      commandExpiresAt > Date.parse(lease.expiresAt)
    )
      reason = 'COMMAND_EXPIRED_OR_OUTSIDE_LEASE';
    else if (commandExpiresAt - commandIssuedAt > this.#policy.maxCommandTtlMs)
      reason = 'COMMAND_TTL_EXCEEDED';
    else if (command.networkState !== 'online') reason = 'OFFLINE_COMMAND_REJECTED';
    else if (!command.signatureVerifiedByControlPlane) reason = 'SIGNATURE_NOT_VERIFIED';
    else if (!command.approvedByControlPlane) reason = 'EXTERNAL_APPROVAL_REQUIRED';
    else if (
      !this.#policy.allowedTargetIds.includes(command.targetId) ||
      !lease.targetIds.includes(command.targetId)
    )
      reason = 'TARGET_NOT_ALLOWED';
    else if (!lease.permissions.includes(command.permission)) reason = 'LEASE_SCOPE_INSUFFICIENT';
    else if (this.#seenNonces.has(command.nonce)) reason = 'REPLAY_REJECTED';
    else if (payloadBytes(command.payload) > this.#policy.maxPayloadBytes)
      reason = 'PAYLOAD_TOO_LARGE';
    else if (command.signal.aborted) reason = 'COMMAND_CANCELLED_BEFORE_DISPATCH';

    if (reason !== 'COMMAND_ACCEPTED' || !lease) {
      const auditRef = this.#append(
        'command-rejected',
        lease ?? {
          leaseId: command.leaseId,
          sequence: command.leaseSequence,
          subject: command.subject
        },
        reason,
        command
      );
      return {
        accepted: false,
        transportInvoked: false,
        reason,
        receipt: null,
        auditRef,
        payloadStored: false,
        credentialStored: false,
        approvalGrantedByProxy: false,
        formalWriteByProxy: false
      };
    }

    this.#seenNonces.add(command.nonce);
    let receipt: EdgeTransportReceipt;
    try {
      const rawReceipt = await this.#transport({
        commandId: command.commandId,
        correlationId: command.correlationId,
        targetId: command.targetId,
        permission: command.permission,
        payload: structuredClone(command.payload),
        signal: command.signal
      });
      if (
        command.signal.aborted ||
        rawReceipt.formalWrite !== false ||
        !['completed', 'cancelled', 'failed'].includes(rawReceipt.status) ||
        !Array.isArray(rawReceipt.evidence) ||
        !rawReceipt.evidence.every((item) => typeof item === 'string')
      )
        throw new Error('EDGE_TRANSPORT_RECEIPT_INVALID');
      receipt = structuredClone(rawReceipt);
    } catch {
      const auditRef = this.#append('command-rejected', lease, 'EDGE_TRANSPORT_FAILED', command);
      return {
        accepted: false,
        transportInvoked: true,
        reason: 'EDGE_TRANSPORT_FAILED',
        receipt: null,
        auditRef,
        payloadStored: false,
        credentialStored: false,
        approvalGrantedByProxy: false,
        formalWriteByProxy: false
      };
    }

    const auditRef = this.#append('command-finished', lease, receipt.status, command);
    return {
      accepted: true,
      transportInvoked: true,
      reason: receipt.status,
      receipt,
      auditRef,
      payloadStored: false,
      credentialStored: false,
      approvalGrantedByProxy: false,
      formalWriteByProxy: false
    };
  }

  audit(): readonly EdgeProxyAuditEvent[] {
    return structuredClone(this.#audit);
  }
}
