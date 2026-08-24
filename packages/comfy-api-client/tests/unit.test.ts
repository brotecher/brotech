import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  assessComfyFidelity,
  captureComfySource,
  createComfyApiClient,
  fixedComfyCompatibility,
  fixedComfyFixtures,
  reimportComfySource,
  type ComfyHttpRequest
} from '../src/index.js';

describe('original Comfy public API boundary', () => {
  it('keeps every packed JSON fixture identical to its runtime export', async () => {
    const fixtureRoot = new URL('../fixtures/', import.meta.url);
    const readFixture = async (name: string) =>
      JSON.parse(await readFile(new URL(name, fixtureRoot), 'utf8')) as unknown;

    await expect(readFixture('workflow-json.json')).resolves.toEqual(
      fixedComfyFixtures.workflowJson
    );
    await expect(readFixture('api-format.json')).resolves.toEqual(fixedComfyFixtures.apiFormat);
    await expect(readFixture('image-metadata.json')).resolves.toEqual(
      fixedComfyFixtures.imageMetadata
    );
    await expect(readFixture('compatibility.json')).resolves.toEqual(fixedComfyCompatibility);
  });

  it.each([
    ['workflow-json', fixedComfyFixtures.workflowJson],
    ['api-format', fixedComfyFixtures.apiFormat],
    ['image-metadata', fixedComfyFixtures.imageMetadata]
  ] as const)('captures immutable %s source and unknown payload', async (kind, payload) => {
    const source = await captureComfySource({
      sourceId: `fixture-${kind}`,
      kind,
      capturedAt: '2026-08-24T00:00:00Z',
      payload
    });

    expect(source.contentDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(Object.isFrozen(source)).toBe(true);
    expect(Object.isFrozen(source.raw)).toBe(true);
    expect(JSON.stringify(source.unknownPayload)).toContain('preserved');
  });

  it('keeps the previous source immutable and reports three distinct fidelity claims', async () => {
    const previous = await captureComfySource({
      sourceId: 'workflow-fixture',
      kind: 'workflow-json',
      capturedAt: '2026-08-24T00:00:00Z',
      payload: fixedComfyFixtures.workflowJson
    });
    const nextPayload = { ...fixedComfyFixtures.workflowJson, last_node_id: 2 };
    const result = await reimportComfySource(previous, {
      capturedAt: '2026-08-24T01:00:00Z',
      payload: nextPayload
    });

    expect(result.sourceChanged).toBe(true);
    expect(result.unknownPayloadPreserved).toBe(true);
    expect(result.previous.contentDigest).not.toBe(result.current.contentDigest);
    expect(
      assessComfyFidelity({ source: previous, exported: previous.raw, graphEquivalent: true })
    ).toEqual({
      sourceBytes: 'preserved',
      graphSemantics: 'equivalent',
      targetExecution: 'not-tested'
    });
  });

  it('constructs only fixed public API requests through an injected transport', async () => {
    const requests: ComfyHttpRequest[] = [];
    const client = createComfyApiClient({
      baseUrl: 'http://127.0.0.1:8188',
      transport: async (request) => {
        requests.push(request);
        return { status: 200, body: { fixture: true } };
      }
    });

    await client.discover();
    await client.submit(fixedComfyFixtures.apiFormat, 'fixture-client');
    await client.history('prompt/with/slash');
    await client.queue();
    await client.interrupt();

    expect(requests.map(({ method, url }) => `${method} ${new URL(url).pathname}`)).toEqual([
      'GET /features',
      'GET /object_info',
      'GET /models',
      'GET /system_stats',
      'POST /prompt',
      'GET /history/prompt%2Fwith%2Fslash',
      'GET /queue',
      'POST /interrupt'
    ]);
    expect(client.eventStreamUrl('fixture client')).toBe(
      'ws://127.0.0.1:8188/ws?clientId=fixture+client'
    );
  });

  it('requires explicit permission for a remote target and makes fixture limits complete', () => {
    expect(() =>
      createComfyApiClient({
        baseUrl: 'https://example.invalid',
        transport: async () => ({ status: 200, body: null })
      })
    ).toThrow('remote target requires explicit allowRemote');
    expect(() =>
      createComfyApiClient({
        baseUrl: 'http://127.0.0.1:8188/private-prefix',
        transport: async () => ({ status: 200, body: null })
      })
    ).toThrow('target base URL must not contain a path');
    expect(fixedComfyCompatibility.status).toBe('fixture-only');
    expect(fixedComfyCompatibility.unsupportedCapabilities).toContain('real-instance-connection');
    expect(fixedComfyCompatibility.verifiedAt).toBeNull();
  });
});
