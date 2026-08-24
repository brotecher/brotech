import { describe, expect, it } from 'vitest';

import {
  adapterSdkVersion,
  compareNativeSource,
  createFixedAdapterFixtures,
  defineAdapter,
  evaluateAdapterCandidate,
  runAdapterConformance,
  type AdapterCandidate,
  type NativeSourceSnapshot
} from '../src/index.js';

describe('public adapter SDK and fixed executor fixtures', () => {
  it('runs two capability-different executors through the same conformance semantics', async () => {
    const [full, limited] = createFixedAdapterFixtures();
    const [fullReport, limitedReport] = await Promise.all([
      runAdapterConformance(full),
      runAdapterConformance(limited)
    ]);
    expect(fullReport).toMatchObject({
      sdkVersion: adapterSdkVersion,
      evidenceLevel: 'isolated-fixture',
      passed: true,
      externalCompatibilityClaim: false,
      checks: {
        cancel: { passed: true, result: 'cancelled' },
        recovery: { passed: true, result: 'restored' }
      }
    });
    expect(limitedReport).toMatchObject({
      passed: true,
      externalCompatibilityClaim: false,
      checks: {
        cancel: { passed: true, result: 'unsupported-disclosed' },
        recovery: { passed: true, result: 'unsupported-disclosed' }
      }
    });
    for (const adapter of [full, limited]) {
      expect(adapter.descriptor).toMatchObject({
        privateSourceRequired: false,
        authoritativeDatabaseAccess: false,
        approvalAuthority: false,
        formalWrite: false,
        cost: { amount: 0 }
      });
      expect(adapter.descriptor.nameZh).not.toBe('');
      expect(adapter.descriptor.helpZh).not.toBe('');
    }
  });

  it('rejects adapters that request a private or formal channel', () => {
    const [fixture] = createFixedAdapterFixtures();
    expect(() =>
      defineAdapter({
        ...fixture,
        descriptor: { ...fixture.descriptor, authoritativeDatabaseAccess: true as false }
      })
    ).toThrow('ADAPTER_PRIVATE_OR_FORMAL_CHANNEL_FORBIDDEN');
  });
});

describe('native source identity and three-way differences', () => {
  const snapshot = (
    id: string,
    version: string,
    values: NativeSourceSnapshot['values']
  ): NativeSourceSnapshot => ({
    id,
    version,
    contentDigest: `sha256:${id}-${version}`,
    values,
    unknownPayload: { 'vendor:opaque': { keep: true } }
  });

  it('shows independent native and Mojing edits without overwriting the common base', () => {
    const base = snapshot('native-source', '1.0.0', { prompt: 'base', width: 512 });
    const native = snapshot('native-source', '1.1.0', { prompt: 'native edit', width: 512 });
    const mojing = snapshot('mojing-workflow', '2.0.0', { prompt: 'mojing edit', width: 768 });
    const differences = compareNativeSource(base, native, mojing);
    expect(differences).toEqual([
      expect.objectContaining({
        field: 'prompt',
        base: 'base',
        native: 'native edit',
        mojing: 'mojing edit',
        conflict: true,
        unknownPayloadFidelityInvalidated: true
      }),
      expect.objectContaining({
        field: 'width',
        base: 512,
        native: 512,
        mojing: 768,
        conflict: false,
        unknownPayloadFidelityInvalidated: true
      })
    ]);
    expect(base.values).toEqual({ prompt: 'base', width: 512 });
  });
});

describe('Agent-generated adapter candidate gates', () => {
  const candidate: AdapterCandidate = {
    id: 'candidate.adapter.fixture',
    version: '0.1.0-candidate',
    generatedBy: 'fixture-agent',
    sourceTemplate: '@mojing/adapter-sdk/fixed-template',
    permissions: ['fixture.text.read'],
    dependencies: ['@mojing/adapter-sdk@0.1.0'],
    revoked: false,
    distributionAuthorization: 'not-granted'
  };

  it('blocks installation while signature or human review is absent and never authorizes publication', () => {
    const blocked = evaluateAdapterCandidate(candidate, {
      build: 'passed',
      simulator: 'passed',
      conformance: 'passed',
      security: 'passed',
      license: 'passed',
      sbom: 'present',
      signature: 'not-configured',
      humanReview: 'pending'
    });
    expect(blocked).toMatchObject({
      isolatedInstallationEligible: false,
      externalPublicationEligible: false,
      formalWrite: false
    });
    expect(blocked.reason).toContain('signature');
    expect(blocked.reason).toContain('humanReview');
  });

  it('allows only isolated installation after every injected gate passes and blocks revoked versions', () => {
    const evidence = {
      build: 'passed',
      simulator: 'passed',
      conformance: 'passed',
      security: 'passed',
      license: 'passed',
      sbom: 'present',
      signature: 'verified',
      humanReview: 'approved'
    } as const;
    expect(evaluateAdapterCandidate(candidate, evidence)).toMatchObject({
      isolatedInstallationEligible: true,
      externalPublicationEligible: false,
      reason: 'ISOLATED_INSTALLATION_GATES_PASSED'
    });
    expect(evaluateAdapterCandidate({ ...candidate, revoked: true }, evidence)).toMatchObject({
      isolatedInstallationEligible: false,
      gates: { revocation: false }
    });
  });
});
