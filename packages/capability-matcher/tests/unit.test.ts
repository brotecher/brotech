import { describe, expect, it } from 'vitest';

import {
  CapabilityManagementRegistry,
  capabilityManagementSchemaVersion,
  evaluateCapabilityRoute,
  type ManagedCapability
} from '../src/index.js';

const fixture = (): ManagedCapability => ({
  schemaVersion: capabilityManagementSchemaVersion,
  id: { typeId: 'mj.capability/model', id: 'local-model', version: '1.0.0' },
  kind: 'model',
  name: '本地模型夹具',
  summary: '只用于确定性能力匹配测试。',
  source: { publisher: 'Mojing fixture', origin: 'local-fixture', license: 'Apache-2.0' },
  inputs: ['text'],
  outputs: ['json'],
  permissions: ['fixture.read'],
  effects: ['candidate-only'],
  egress: { mode: 'none', recipient: 'none', dataScope: 'none', retention: 'none' },
  cost: { amount: 0, unit: 'fixture-call', source: 'fixed-fixture' },
  resources: ['node'],
  availability: { available: true, reason: '固定夹具可用。' },
  declaredCapabilities: [{ feature: 'structured-output', supported: true, detail: 'declared' }],
  verification: {
    status: 'verified',
    fixture: 'capability-matcher-unit',
    testedAt: '2026-08-24T00:00:00.000Z',
    capabilities: [{ feature: 'structured-output', supported: true, detail: 'verified' }],
    evidence: ['unit:test']
  },
  alternatives: [],
  defaultLifecycle: 'enabled'
});

describe('@mojing/capability-matcher public entry', () => {
  it('registers immutable versions and matches only verified caller requirements', () => {
    const registry = new CapabilityManagementRegistry();
    registry.register(fixture());
    expect(registry.list()).toHaveLength(1);
    expect(() => registry.register(fixture())).toThrow('CAPABILITY_MANAGEMENT_VERSION_EXISTS');

    expect(
      evaluateCapabilityRoute(fixture(), 'enabled', {
        kind: 'model',
        requiredFeatures: ['structured-output'],
        allowEgress: false
      })
    ).toEqual({ eligible: true, reasons: [] });
    expect(
      evaluateCapabilityRoute(fixture(), 'disabled', {
        kind: 'model',
        requiredFeatures: ['tool-calling'],
        allowEgress: false
      })
    ).toEqual({
      eligible: false,
      reasons: ['能力当前已停用。', '实测不支持：tool-calling。']
    });
  });
});
