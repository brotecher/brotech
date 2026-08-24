export const comfyApiClientVersion = '0.1.0';

export type ComfyJson =
  null | boolean | number | string | readonly ComfyJson[] | { readonly [key: string]: ComfyJson };

export type ComfySourceKind = 'workflow-json' | 'api-format' | 'image-metadata';

export interface ComfySourceSnapshot {
  readonly sourceId: string;
  readonly kind: ComfySourceKind;
  readonly capturedAt: string;
  readonly contentDigest: `sha256:${string}`;
  readonly raw: ComfyJson;
  readonly nativeGraph: ComfyJson;
  readonly unknownPayload: ComfyJson;
}

export interface ComfyCompatibilityDeclaration {
  readonly id: string;
  readonly status: 'fixture-only' | 'unverified' | 'verified';
  readonly clientVersion: string;
  readonly comfyCoreVersion: string;
  readonly frontendVersion: string;
  readonly pythonVersion: string;
  readonly operatingSystem: string;
  readonly gpuAndDriver: string;
  readonly nodePackages: readonly string[];
  readonly frontendExtensions: readonly string[];
  readonly modelPackages: readonly string[];
  readonly systemTools: readonly string[];
  readonly routes: readonly string[];
  readonly supportedCapabilities: readonly string[];
  readonly unsupportedCapabilities: readonly string[];
  readonly isolation: string;
  readonly verifiedAt: string | null;
  readonly supportUntil: string | null;
}

export interface ComfyReimportResult {
  readonly previous: ComfySourceSnapshot;
  readonly current: ComfySourceSnapshot;
  readonly sourceChanged: boolean;
  readonly unknownPayloadPreserved: boolean;
}

export interface ComfyFidelityReport {
  readonly sourceBytes: 'preserved' | 'changed';
  readonly graphSemantics: 'equivalent' | 'changed' | 'unverified';
  readonly targetExecution: 'equivalent' | 'different' | 'not-tested';
}

export interface ComfyHttpRequest {
  readonly method: 'GET' | 'POST';
  readonly url: string;
  readonly body?: ComfyJson;
}

export interface ComfyHttpResponse {
  readonly status: number;
  readonly body: ComfyJson;
}

export type ComfyHttpTransport = (request: ComfyHttpRequest) => Promise<ComfyHttpResponse>;

export interface ComfyApiClient {
  readonly baseUrl: string;
  discover(): Promise<
    Readonly<Record<'features' | 'objectInfo' | 'models' | 'systemStats', ComfyJson>>
  >;
  submit(prompt: ComfyJson, clientId: string): Promise<ComfyHttpResponse>;
  history(promptId: string): Promise<ComfyHttpResponse>;
  queue(): Promise<ComfyHttpResponse>;
  interrupt(): Promise<ComfyHttpResponse>;
  eventStreamUrl(clientId: string): string;
}

const workflowKeys = new Set([
  'last_node_id',
  'last_link_id',
  'nodes',
  'links',
  'groups',
  'config',
  'extra',
  'version'
]);
const apiNodeKeys = new Set(['class_type', 'inputs', '_meta']);

const isRecord = (value: ComfyJson): value is { readonly [key: string]: ComfyJson } =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const cloneJson = (value: ComfyJson): ComfyJson => {
  if (Array.isArray(value)) return value.map((item) => cloneJson(item));
  if (isRecord(value))
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneJson(item)])
    ) as ComfyJson;
  return value;
};

const freezeJson = (value: ComfyJson): ComfyJson => {
  if (Array.isArray(value)) value.forEach((item) => freezeJson(item));
  else if (isRecord(value)) Object.values(value).forEach((item) => freezeJson(item));
  return Object.freeze(value);
};

export const canonicalizeComfyJson = (value: ComfyJson): string => {
  if (Array.isArray(value))
    return `[${value.map((item) => canonicalizeComfyJson(item)).join(',')}]`;
  if (isRecord(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalizeComfyJson(value[key] ?? null)}`)
      .join(',')}}`;
  return JSON.stringify(value);
};

const sha256 = async (value: string): Promise<`sha256:${string}`> => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`;
};

const parseEmbeddedJson = (value: ComfyJson, field: string): ComfyJson => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as ComfyJson;
  } catch {
    throw new TypeError(`image metadata field ${field} is not valid JSON`);
  }
};

const graphFromSource = (kind: ComfySourceKind, raw: ComfyJson): ComfyJson => {
  if (kind !== 'image-metadata') return raw;
  if (!isRecord(raw)) throw new TypeError('image metadata must be an object');
  if (raw.workflow !== undefined) return parseEmbeddedJson(raw.workflow, 'workflow');
  if (raw.prompt !== undefined) return parseEmbeddedJson(raw.prompt, 'prompt');
  throw new TypeError('image metadata must contain workflow or prompt');
};

const unknownPayload = (kind: ComfySourceKind, raw: ComfyJson, graph: ComfyJson): ComfyJson => {
  if (kind === 'image-metadata' && isRecord(raw)) {
    return Object.fromEntries(
      Object.entries(raw).filter(([key]) => !['workflow', 'prompt'].includes(key))
    );
  }
  if (kind === 'workflow-json' && isRecord(graph)) {
    return Object.fromEntries(Object.entries(graph).filter(([key]) => !workflowKeys.has(key)));
  }
  if (kind === 'api-format' && isRecord(graph)) {
    return Object.fromEntries(
      Object.entries(graph).map(([nodeId, node]) => [
        nodeId,
        isRecord(node)
          ? Object.fromEntries(Object.entries(node).filter(([key]) => !apiNodeKeys.has(key)))
          : node
      ])
    );
  }
  return {};
};

export const captureComfySource = async (input: {
  readonly sourceId: string;
  readonly kind: ComfySourceKind;
  readonly capturedAt: string;
  readonly payload: ComfyJson;
}): Promise<ComfySourceSnapshot> => {
  if (!input.sourceId.trim()) throw new TypeError('sourceId is required');
  const raw = freezeJson(cloneJson(input.payload));
  const nativeGraph = freezeJson(cloneJson(graphFromSource(input.kind, raw)));
  const unknown = freezeJson(cloneJson(unknownPayload(input.kind, raw, nativeGraph)));
  return Object.freeze({
    sourceId: input.sourceId,
    kind: input.kind,
    capturedAt: input.capturedAt,
    contentDigest: await sha256(canonicalizeComfyJson(raw)),
    raw,
    nativeGraph,
    unknownPayload: unknown
  });
};

export const reimportComfySource = async (
  previous: ComfySourceSnapshot,
  input: Omit<Parameters<typeof captureComfySource>[0], 'sourceId' | 'kind'>
): Promise<ComfyReimportResult> => {
  const current = await captureComfySource({
    ...input,
    sourceId: previous.sourceId,
    kind: previous.kind
  });
  return Object.freeze({
    previous,
    current,
    sourceChanged: previous.contentDigest !== current.contentDigest,
    unknownPayloadPreserved:
      canonicalizeComfyJson(previous.unknownPayload) ===
      canonicalizeComfyJson(current.unknownPayload)
  });
};

export const assessComfyFidelity = (input: {
  readonly source: ComfySourceSnapshot;
  readonly exported: ComfyJson;
  readonly graphEquivalent?: boolean;
  readonly executionEquivalent?: boolean;
}): ComfyFidelityReport => ({
  sourceBytes:
    canonicalizeComfyJson(input.source.raw) === canonicalizeComfyJson(input.exported)
      ? 'preserved'
      : 'changed',
  graphSemantics:
    input.graphEquivalent === undefined
      ? 'unverified'
      : input.graphEquivalent
        ? 'equivalent'
        : 'changed',
  targetExecution:
    input.executionEquivalent === undefined
      ? 'not-tested'
      : input.executionEquivalent
        ? 'equivalent'
        : 'different'
});

const normalizeBaseUrl = (value: string, allowRemote: boolean): URL => {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new TypeError('target must use HTTP(S)');
  if (url.username || url.password || url.hash)
    throw new TypeError('target cannot contain credentials or a fragment');
  if (url.pathname !== '/' && url.pathname !== '')
    throw new TypeError('target base URL must not contain a path');
  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  if (!allowRemote && !localHosts.has(url.hostname))
    throw new TypeError('remote target requires explicit allowRemote');
  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  return url;
};

export const createComfyApiClient = (input: {
  readonly baseUrl: string;
  readonly transport: ComfyHttpTransport;
  readonly allowRemote?: boolean;
}): ComfyApiClient => {
  const base = normalizeBaseUrl(input.baseUrl, input.allowRemote === true);
  const request = (method: 'GET' | 'POST', path: string, body?: ComfyJson) =>
    input.transport({ method, url: new URL(path, base).toString(), body });
  return Object.freeze({
    baseUrl: base.toString().replace(/\/$/, ''),
    async discover() {
      const [features, objectInfo, models, systemStats] = await Promise.all([
        request('GET', 'features'),
        request('GET', 'object_info'),
        request('GET', 'models'),
        request('GET', 'system_stats')
      ]);
      return Object.freeze({
        features: features.body,
        objectInfo: objectInfo.body,
        models: models.body,
        systemStats: systemStats.body
      });
    },
    submit(prompt: ComfyJson, clientId: string) {
      return request('POST', 'prompt', { prompt, client_id: clientId });
    },
    history(promptId: string) {
      return request('GET', `history/${encodeURIComponent(promptId)}`);
    },
    queue() {
      return request('GET', 'queue');
    },
    interrupt() {
      return request('POST', 'interrupt', {});
    },
    eventStreamUrl(clientId: string) {
      const url = new URL('ws', base);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.searchParams.set('clientId', clientId);
      return url.toString();
    }
  });
};

export const fixedComfyCompatibility: ComfyCompatibilityDeclaration = Object.freeze({
  id: 'comfy.fixture.m3.original-api-client.v1',
  status: 'fixture-only',
  clientVersion: comfyApiClientVersion,
  comfyCoreVersion: 'not-installed',
  frontendVersion: 'not-installed',
  pythonVersion: 'not-installed',
  operatingSystem: 'deterministic-fixture',
  gpuAndDriver: 'not-applicable',
  nodePackages: [],
  frontendExtensions: [],
  modelPackages: [],
  systemTools: [],
  routes: [
    'GET /features',
    'GET /history/{prompt_id}',
    'GET /models',
    'GET /object_info',
    'GET /queue',
    'GET /system_stats',
    'POST /interrupt',
    'POST /prompt',
    'WS /ws?clientId={client_id}'
  ],
  supportedCapabilities: [
    'fixed-source-capture',
    'immutable-source-snapshot',
    'unknown-payload-preservation',
    'request-construction'
  ],
  unsupportedCapabilities: [
    'real-instance-connection',
    'real-execution',
    'real-cancellation',
    'real-event-stream',
    'real-history-validation',
    'frontend-island',
    'installation-or-distribution'
  ],
  isolation: 'No ComfyUI code, process, database, directory, credential or network is used.',
  verifiedAt: null,
  supportUntil: null
});

export const fixedComfyFixtures = Object.freeze({
  workflowJson: {
    last_node_id: 1,
    last_link_id: 0,
    nodes: [{ id: 1, type: 'FixtureImageNode', pos: [24, 48], widgets_values: ['fixture'] }],
    links: [],
    version: 0.4,
    'fixture:unknown': { preserved: true }
  },
  apiFormat: {
    '1': {
      class_type: 'FixtureImageNode',
      inputs: { prompt: 'fixture only' },
      'fixture:unknown': { preserved: true }
    }
  },
  imageMetadata: {
    workflow: JSON.stringify({
      nodes: [{ id: 1, type: 'FixtureImageNode' }],
      links: [],
      'fixture:unknown': { preserved: true }
    }),
    'fixture:image-field': 'preserved'
  }
} as const);
