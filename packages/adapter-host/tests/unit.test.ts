import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  AdapterHost,
  createReferenceTextAdapter,
  fixedAdapterCompatibilityMatrix,
  validateCompatibilityMatrix,
  type AdapterHostInvocation,
  type ExternalPermissionGrant
} from '../src/index.js';

const grant = (overrides: Partial<ExternalPermissionGrant> = {}): ExternalPermissionGrant => ({
  grantId: 'grant-fixture-1',
  issuedBy: 'external-authority',
  subject: 'fixture-user',
  adapters: [{ id: 'reference.text.transform', version: '1.0.0' }],
  permissions: ['reference.text.read'],
  expiresAt: '2026-08-25T00:00:00.000Z',
  ...overrides
});

const invocation = (
  permissionGrant: ExternalPermissionGrant,
  overrides: Partial<AdapterHostInvocation> = {}
): AdapterHostInvocation => ({
  invocationId: 'invocation-fixture-1',
  adapterId: 'reference.text.transform',
  adapterVersion: '1.0.0',
  input: { text: '  Mojing Host  ', operation: 'trim' },
  grant: permissionGrant,
  signal: new AbortController().signal,
  resumeFrom: null,
  ...overrides
});

describe('open adapter host', () => {
  it('validates the complete packed compatibility matrix against the runtime fixture', async () => {
    const disk = JSON.parse(
      await readFile(new URL('../fixtures/compatibility-matrix.json', import.meta.url), 'utf8')
    );
    expect(disk).toEqual(fixedAdapterCompatibilityMatrix);
    expect(validateCompatibilityMatrix(fixedAdapterCompatibilityMatrix)).toMatchObject({
      passed: true,
      errors: []
    });
  });

  it('registers, discovers and invokes the general reference adapter with external authority', async () => {
    const host = new AdapterHost();
    host.register(createReferenceTextAdapter());

    expect(host.discover().map(({ id }) => id)).toEqual(['reference.text.transform']);
    const response = await host.invoke(invocation(grant()), '2026-08-24T12:00:00.000Z');

    expect(response).toMatchObject({
      accepted: true,
      reason: 'completed',
      approvalGrantedByHost: false,
      formalWriteByHost: false,
      grantRetained: false,
      result: { output: { text: 'Mojing Host' }, candidate: true, formalWrite: false }
    });
    expect(host.audit().at(-1)).toMatchObject({
      event: 'invocation-completed',
      grantId: 'grant-fixture-1',
      inputStored: false,
      credentialStored: false
    });
  });

  it.each([
    ['GRANT_TIME_INVALID', grant({ expiresAt: 'not-a-date' })],
    ['GRANT_EXPIRED', grant({ expiresAt: '2026-08-23T00:00:00.000Z' })],
    ['GRANT_ADAPTER_SCOPE_INSUFFICIENT', grant({ adapters: [] })],
    [
      'GRANT_ADAPTER_SCOPE_INSUFFICIENT',
      grant({ adapters: [{ id: 'reference.text.transform', version: '0.9.0' }] })
    ],
    ['GRANT_PERMISSION_SCOPE_INSUFFICIENT', grant({ permissions: [] })]
  ] as const)('rejects %s without invoking the adapter', async (reason, permissionGrant) => {
    const host = new AdapterHost();
    host.register(createReferenceTextAdapter());
    await expect(
      host.invoke(invocation(permissionGrant), '2026-08-24T12:00:00.000Z')
    ).resolves.toMatchObject({ accepted: false, reason, result: null });
  });

  it('passes cancellation, then revokes only future invocation while retaining audit evidence', async () => {
    const host = new AdapterHost();
    host.register(createReferenceTextAdapter());
    const controller = new AbortController();
    controller.abort();

    await expect(
      host.invoke(
        invocation(grant(), { invocationId: 'cancelled', signal: controller.signal }),
        '2026-08-24T12:00:00.000Z'
      )
    ).resolves.toMatchObject({ accepted: true, result: { status: 'cancelled' } });
    expect(host.revoke('reference.text.transform', '1.0.0')).toBe(true);
    expect(host.discover()).toEqual([]);
    await expect(
      host.invoke(invocation(grant()), '2026-08-24T12:00:00.000Z')
    ).resolves.toMatchObject({ accepted: false, reason: 'ADAPTER_REVOKED' });
    expect(host.audit().map(({ event }) => event)).toEqual([
      'registered',
      'invocation-completed',
      'revoked',
      'invocation-rejected'
    ]);
  });

  it('snapshots discovery identity and rejects a runtime formal-write result', async () => {
    const host = new AdapterHost();
    const adapter = createReferenceTextAdapter();
    host.register({
      ...adapter,
      run: async () =>
        ({
          status: 'completed',
          output: {},
          candidate: false,
          checkpoint: null,
          error: null,
          evidence: [],
          formalWrite: true
        }) as never
    });

    await expect(
      host.invoke(invocation(grant()), '2026-08-24T12:00:00.000Z')
    ).resolves.toMatchObject({ accepted: false, reason: 'ADAPTER_RUN_FAILED', result: null });
  });
});
