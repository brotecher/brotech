import { describe, expect, it } from 'vitest';

import {
  ReferenceEdgeProxy,
  ReferenceOpenGateway,
  type EdgeAuthorityLease,
  type EdgeCommand
} from '../src/index.js';

const token = {
  tokenId: 'token-1',
  subject: 'fixture-agent',
  audience: 'mojing-reference-gateway' as const,
  projectIds: ['project-a'],
  targetIds: ['fixture-target'],
  permissions: ['fixture.read'],
  expiresAt: '2026-08-24T01:00:00.000Z'
};

describe('@mojing/gateway-core public entry', () => {
  it('routes only externally approved scoped requests and rejects replay', () => {
    const gateway = new ReferenceOpenGateway(['fixture-target']);
    const request = {
      requestId: 'request-1',
      nonce: 'nonce-1',
      projectId: 'project-a',
      targetId: 'fixture-target',
      permission: 'fixture.read',
      token,
      approvedByControlPlane: true
    };
    expect(gateway.route(request, '2026-08-24T00:00:00.000Z')).toEqual({
      routed: true,
      reason: 'ROUTED_WITH_EXTERNAL_APPROVAL',
      auditRef: 'gateway-audit:request-1',
      credentialsExposed: false,
      approvalGrantedByGateway: false
    });
    expect(
      gateway.route({ ...request, requestId: 'request-2' }, '2026-08-24T00:00:01.000Z')
    ).toMatchObject({ routed: false, reason: 'REPLAY_REJECTED' });
    expect(gateway.audit()).toHaveLength(2);
  });

  it('cannot create its own approval or expand project, target, permission or expiry', () => {
    const cases = [
      { nonce: 'n1', approvedByControlPlane: false, expected: 'EXTERNAL_APPROVAL_REQUIRED' },
      { nonce: 'n2', projectId: 'project-b', expected: 'PROJECT_NOT_AUTHORIZED' },
      { nonce: 'n3', targetId: 'metadata-service', expected: 'TARGET_NOT_ALLOWED' },
      { nonce: 'n4', permission: 'fixture.write', expected: 'TOKEN_SCOPE_INSUFFICIENT' },
      { nonce: 'n5', now: '2026-08-24T01:00:00.000Z', expected: 'TOKEN_EXPIRED' }
    ];
    const gateway = new ReferenceOpenGateway(['fixture-target']);
    for (const item of cases) {
      const decision = gateway.route(
        {
          requestId: item.nonce,
          nonce: item.nonce,
          projectId: item.projectId ?? 'project-a',
          targetId: item.targetId ?? 'fixture-target',
          permission: item.permission ?? 'fixture.read',
          token,
          approvedByControlPlane: item.approvedByControlPlane ?? true
        },
        item.now ?? '2026-08-24T00:00:00.000Z'
      );
      expect(decision).toMatchObject({
        routed: false,
        reason: item.expected,
        credentialsExposed: false,
        approvalGrantedByGateway: false
      });
    }
  });

  it('rejects invalid gateway time instead of treating NaN as unexpired', () => {
    const gateway = new ReferenceOpenGateway(['fixture-target']);
    expect(
      gateway.route(
        {
          requestId: 'invalid-time',
          nonce: 'invalid-time',
          projectId: 'project-a',
          targetId: 'fixture-target',
          permission: 'fixture.read',
          token: { ...token, expiresAt: 'not-a-date' },
          approvedByControlPlane: true
        },
        '2026-08-24T00:00:00.000Z'
      )
    ).toMatchObject({ routed: false, reason: 'TOKEN_TIME_INVALID' });
  });
});

const edgePolicy = {
  proxyId: 'fixture-edge-proxy',
  policyVersion: 'fixture-policy/v1',
  allowedTargetIds: ['simulated-device'],
  maxCommandTtlMs: 60_000,
  maxPayloadBytes: 256
};

const edgeLease = (overrides: Partial<EdgeAuthorityLease> = {}): EdgeAuthorityLease => ({
  leaseId: 'lease-1',
  issuedBy: 'external-authority',
  proxyId: 'fixture-edge-proxy',
  subject: 'fixture-operator',
  sequence: 1,
  targetIds: ['simulated-device'],
  permissions: ['fixture.simulate'],
  issuedAt: '2026-08-24T00:00:00.000Z',
  expiresAt: '2026-08-24T01:00:00.000Z',
  ...overrides
});

const edgeCommand = (overrides: Partial<EdgeCommand> = {}): EdgeCommand => ({
  commandId: 'command-1',
  correlationId: 'correlation-1',
  nonce: 'edge-nonce-1',
  proxyId: 'fixture-edge-proxy',
  subject: 'fixture-operator',
  leaseId: 'lease-1',
  leaseSequence: 1,
  targetId: 'simulated-device',
  permission: 'fixture.simulate',
  issuedAt: '2026-08-24T00:00:10.000Z',
  expiresAt: '2026-08-24T00:00:40.000Z',
  networkState: 'online',
  approvedByControlPlane: true,
  signatureVerifiedByControlPlane: true,
  payload: { setpoint: 42 },
  signal: new AbortController().signal,
  ...overrides
});

describe('standalone reference edge proxy', () => {
  it('uses a current exact lease and injected simulated transport without retaining authority data', async () => {
    const calls: string[] = [];
    const proxy = new ReferenceEdgeProxy(edgePolicy, async (command) => {
      calls.push(`${command.targetId}:${String(command.payload.setpoint)}`);
      return {
        status: 'completed',
        evidence: [`fixture:${command.commandId}`],
        formalWrite: false
      };
    });
    expect(proxy.activateLease(edgeLease(), '2026-08-24T00:00:05.000Z')).toMatchObject({
      activated: true,
      reason: 'LEASE_ACTIVATED'
    });
    await expect(proxy.dispatch(edgeCommand(), '2026-08-24T00:00:20.000Z')).resolves.toMatchObject({
      accepted: true,
      transportInvoked: true,
      reason: 'completed',
      payloadStored: false,
      credentialStored: false,
      approvalGrantedByProxy: false,
      formalWriteByProxy: false
    });
    expect(calls).toEqual(['simulated-device:42']);
    expect(proxy.audit()).toEqual([
      expect.objectContaining({ event: 'lease-activated', sequence: 1 }),
      expect.objectContaining({
        event: 'command-finished',
        sequence: 2,
        reason: 'completed',
        payloadStored: false,
        credentialStored: false
      })
    ]);
  });

  it.each([
    ['OFFLINE_COMMAND_REJECTED', edgeCommand({ networkState: 'offline' })],
    ['SIGNATURE_NOT_VERIFIED', edgeCommand({ signatureVerifiedByControlPlane: false })],
    ['EXTERNAL_APPROVAL_REQUIRED', edgeCommand({ approvedByControlPlane: false })],
    ['TARGET_NOT_ALLOWED', edgeCommand({ targetId: 'metadata-service' })],
    ['LEASE_SCOPE_INSUFFICIENT', edgeCommand({ permission: 'fixture.write' })],
    ['COMMAND_EXPIRED_OR_OUTSIDE_LEASE', edgeCommand({ expiresAt: '2026-08-24T02:00:00.000Z' })],
    ['COMMAND_TTL_EXCEEDED', edgeCommand({ expiresAt: '2026-08-24T00:02:00.000Z' })],
    ['PAYLOAD_TOO_LARGE', edgeCommand({ payload: { text: 'x'.repeat(300) } })]
  ] as const)('rejects %s before invoking transport', async (reason, command) => {
    let calls = 0;
    const proxy = new ReferenceEdgeProxy(edgePolicy, async () => {
      calls += 1;
      return { status: 'completed', evidence: [], formalWrite: false };
    });
    proxy.activateLease(edgeLease(), '2026-08-24T00:00:05.000Z');
    await expect(proxy.dispatch(command, '2026-08-24T00:00:20.000Z')).resolves.toMatchObject({
      accepted: false,
      transportInvoked: false,
      reason
    });
    expect(calls).toBe(0);
  });

  it('rotates and revokes lease authority so old subjects cannot continue', async () => {
    const proxy = new ReferenceEdgeProxy(edgePolicy, async () => ({
      status: 'completed',
      evidence: [],
      formalWrite: false
    }));
    proxy.activateLease(edgeLease(), '2026-08-24T00:00:05.000Z');
    proxy.activateLease(edgeLease({ leaseId: 'lease-2', sequence: 2 }), '2026-08-24T00:00:06.000Z');
    await expect(proxy.dispatch(edgeCommand(), '2026-08-24T00:00:20.000Z')).resolves.toMatchObject({
      accepted: false,
      reason: 'LEASE_NOT_CURRENT'
    });
    expect(proxy.revokeLease('lease-2')).toBe(true);
    await expect(
      proxy.dispatch(
        edgeCommand({ leaseId: 'lease-2', leaseSequence: 2, nonce: 'edge-nonce-2' }),
        '2026-08-24T00:00:20.000Z'
      )
    ).resolves.toMatchObject({ accepted: false, reason: 'LEASE_NOT_CURRENT' });
  });

  it('rejects replay and discards a late result after cancellation', async () => {
    let release:
      ((receipt: { status: 'completed'; evidence: string[]; formalWrite: false }) => void) | null =
      null;
    const proxy = new ReferenceEdgeProxy(
      edgePolicy,
      (command) =>
        new Promise((resolve) => {
          expect(command.signal.aborted).toBe(false);
          release = resolve;
        })
    );
    proxy.activateLease(edgeLease(), '2026-08-24T00:00:05.000Z');
    const controller = new AbortController();
    const pending = proxy.dispatch(
      edgeCommand({ signal: controller.signal }),
      '2026-08-24T00:00:20.000Z'
    );
    controller.abort();
    if (!release) throw new Error('transport was not invoked');
    release({ status: 'completed', evidence: ['late'], formalWrite: false });
    await expect(pending).resolves.toMatchObject({
      accepted: false,
      transportInvoked: true,
      reason: 'EDGE_TRANSPORT_FAILED',
      receipt: null
    });
    await expect(proxy.dispatch(edgeCommand(), '2026-08-24T00:00:21.000Z')).resolves.toMatchObject({
      accepted: false,
      reason: 'REPLAY_REJECTED'
    });
  });

  it('rejects forged formal-write receipts from the injected transport', async () => {
    const proxy = new ReferenceEdgeProxy(
      edgePolicy,
      async () => ({ status: 'completed', evidence: [], formalWrite: true }) as never
    );
    proxy.activateLease(edgeLease(), '2026-08-24T00:00:05.000Z');
    await expect(proxy.dispatch(edgeCommand(), '2026-08-24T00:00:20.000Z')).resolves.toMatchObject({
      accepted: false,
      reason: 'EDGE_TRANSPORT_FAILED'
    });
  });
});
