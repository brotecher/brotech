import { describe, expect, it } from 'vitest';

import {
  evaluateProtocolEnvelope,
  migrateOpenProtocolEnvelope,
  runOpenToolConformanceFixtures,
  type OpenProtocolHeader
} from '../src/index.js';

const header = (kind: 'ordinary' | 'formal-write'): OpenProtocolHeader => ({
  schemaId: 'urn:mojing:open-tool-envelope',
  schemaVersion: '1.0.0',
  namespace: 'urn:mojing:open-tools',
  compatibility: ['1.0.0', '1.1.0'],
  objectId: `fixture-${kind}`,
  canonicalizationVersion: 'mj-json-1',
  contentDigest: `sha256:${'0'.repeat(64)}`,
  signature: { status: 'not-configured', keyId: null },
  extensions: [{ namespace: `urn:fixture:${kind}`, kind, value: { enabled: true } }]
});

describe('@mojing/open-tool-conformance public entry', () => {
  it('preserves ordinary extensions across upgrade and rollback', () => {
    const upgraded = migrateOpenProtocolEnvelope(header('ordinary'), '1.1.0');
    const rolledBack = migrateOpenProtocolEnvelope(upgraded.envelope, '1.0.0');

    expect(upgraded.status).toBe('migrated');
    expect(rolledBack.status).toBe('rolled-back');
    expect(rolledBack.envelope.extensions[0]?.namespace).toBe('urn:fixture:ordinary');
  });

  it('rejects unknown security extensions', () => {
    expect(evaluateProtocolEnvelope(header('formal-write'), [])).toMatchObject({
      accepted: false,
      errors: ['OPEN_PROTOCOL_UNKNOWN_SECURITY_EXTENSION:urn:fixture:formal-write:formal-write']
    });
  });

  it('runs all four transports only as isolated non-writing fixtures', () => {
    const suite = runOpenToolConformanceFixtures();

    expect(suite.records.map((record) => record.transport)).toEqual([
      'mcp',
      'a2a',
      'openapi',
      'webhook'
    ]);
    expect(suite.evidenceLevel).toBe('isolated-fixture');
    expect(suite.externalCertification).toBe(false);
    expect(suite.formalWrite).toBe(false);
    expect(suite.a2a).toMatchObject({ discovery: true, artifactHandoff: true, cancelled: true });
    expect(suite.webhook).toMatchObject({
      signatureVerified: true,
      duplicateRejected: true,
      replayRejected: true
    });
  });
});
