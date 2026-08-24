import { protocolSchemas } from './generated/protocol-schemas.js';
import type {
  AppProtocol,
  CanvasProtocol,
  CapabilityProtocol,
  ChangeProtocol,
  NodeProtocol,
  PrtIdProtocol,
  RunProtocol,
  WorkflowProtocol
} from './generated/protocol-types.js';

export type ProtocolFamilyName = keyof typeof protocolSchemas;

type ProtocolByFamily = {
  'PRT-ID': PrtIdProtocol;
  CAP: CapabilityProtocol;
  NODE: NodeProtocol;
  WORKFLOW: WorkflowProtocol;
  RUN: RunProtocol;
  CHANGE: ChangeProtocol;
  APP: AppProtocol;
  CANVAS: CanvasProtocol;
};

type JsonSchema = {
  $ref?: string;
  const?: unknown;
  enum?: readonly unknown[];
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  minLength?: number;
  pattern?: string;
  minimum?: number;
  $defs?: Record<string, JsonSchema>;
};

export type ProtocolValidationError = {
  path: string;
  errorCode: string;
  ruleId?: string;
};

export type ProtocolValidationResult<T> =
  { valid: true; value: T; errors: [] } | { valid: false; errors: ProtocolValidationError[] };

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
};

const normalizeSchemaPath = (value: string): string => {
  const parts: string[] = [];
  for (const part of value.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
};

const schemaRecords = new Map<string, { sourcePath: string; schema: unknown }>(
  Object.values(protocolSchemas).map((record) => [record.sourcePath, record] as const)
);

const resolvePointer = (document: unknown, fragment: string): JsonSchema | undefined => {
  if (!fragment || fragment === '#') return document as JsonSchema;
  if (!fragment.startsWith('#/')) return undefined;
  return fragment
    .slice(2)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce<unknown>((value, key) => {
      if (!value || typeof value !== 'object') return undefined;
      return (value as Record<string, unknown>)[key];
    }, document) as JsonSchema | undefined;
};

const resolveRef = (
  ref: string,
  currentPath: string
): { schema: JsonSchema; sourcePath: string } | null => {
  const split = ref.indexOf('#');
  const filePart = split >= 0 ? ref.slice(0, split) : ref;
  const fragment = split >= 0 ? ref.slice(split) : '';
  const directory = currentPath.slice(0, Math.max(0, currentPath.lastIndexOf('/') + 1));
  const sourcePath = filePart ? normalizeSchemaPath(`${directory}${filePart}`) : currentPath;
  const record = schemaRecords.get(sourcePath);
  if (!record) return null;
  const schema = resolvePointer(record.schema, fragment);
  return schema ? { schema, sourcePath } : null;
};

function validateSchema(
  schema: JsonSchema,
  value: unknown,
  path: string,
  sourcePath: string
): ProtocolValidationError[] {
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, sourcePath);
    return resolved
      ? validateSchema(resolved.schema, value, path, resolved.sourcePath)
      : [{ path, errorCode: 'SCHEMA_REF_UNRESOLVED' }];
  }

  const errors: ProtocolValidationError[] = [];
  if (Object.hasOwn(schema, 'const') && canonical(value) !== canonical(schema.const))
    errors.push({ path, errorCode: 'SCHEMA_CONST' });
  if (schema.enum && !schema.enum.some((item) => canonical(item) === canonical(value)))
    errors.push({ path, errorCode: 'SCHEMA_ENUM' });

  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return [...errors, { path, errorCode: 'SCHEMA_TYPE' }];
    const object = value as Record<string, unknown>;
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(object, required))
        errors.push({ path: `${path}.${required}`, errorCode: 'SCHEMA_REQUIRED' });
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(object, key))
        errors.push(...validateSchema(child, object[key], `${path}.${key}`, sourcePath));
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(object)) {
        if (!Object.hasOwn(schema.properties ?? {}, key))
          errors.push({ path: `${path}.${key}`, errorCode: 'SCHEMA_ADDITIONAL_PROPERTY' });
      }
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) return [...errors, { path, errorCode: 'SCHEMA_TYPE' }];
    if (schema.minItems !== undefined && value.length < schema.minItems)
      errors.push({ path, errorCode: 'SCHEMA_MIN_ITEMS' });
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      errors.push({ path, errorCode: 'SCHEMA_MAX_ITEMS' });
    if (schema.uniqueItems && new Set(value.map(canonical)).size !== value.length)
      errors.push({ path, errorCode: 'SCHEMA_UNIQUE_ITEMS' });
    if (schema.items)
      value.forEach((item, index) =>
        errors.push(...validateSchema(schema.items!, item, `${path}[${index}]`, sourcePath))
      );
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') return [...errors, { path, errorCode: 'SCHEMA_TYPE' }];
    if (schema.minLength !== undefined && value.length < schema.minLength)
      errors.push({ path, errorCode: 'SCHEMA_MIN_LENGTH' });
    if (schema.pattern && !new RegExp(schema.pattern).test(value))
      errors.push({ path, errorCode: 'SCHEMA_PATTERN' });
  } else if (schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value))
      return [...errors, { path, errorCode: 'SCHEMA_TYPE' }];
    if (schema.minimum !== undefined && value < schema.minimum)
      errors.push({ path, errorCode: 'SCHEMA_MINIMUM' });
  } else if (schema.type === 'integer') {
    if (!Number.isInteger(value)) return [...errors, { path, errorCode: 'SCHEMA_TYPE' }];
    if (schema.minimum !== undefined && (value as number) < schema.minimum)
      errors.push({ path, errorCode: 'SCHEMA_MINIMUM' });
  } else if (schema.type === 'boolean' && typeof value !== 'boolean') {
    errors.push({ path, errorCode: 'SCHEMA_TYPE' });
  }
  return errors;
}

const ruleError = (path: string, ruleId: string, errorCode: string): ProtocolValidationError => ({
  path,
  ruleId,
  errorCode
});

const isStableVersion = (value: { version?: string } | undefined): boolean =>
  Boolean(value?.version && value.version !== 'latest');

function semanticErrors(family: ProtocolFamilyName, value: unknown): ProtocolValidationError[] {
  if (family === 'PRT-ID') {
    const identity = value as PrtIdProtocol;
    return Object.keys(identity.roles).sort().join(',') ===
      ['actorRef', 'ownerRef', 'projectRef', 'reviewerRef'].sort().join(',')
      ? []
      : [ruleError('$.roles', 'PROTOCOL-RULE-PRT-ID-001', 'IDENTITY_ROLE_COLLAPSE')];
  }
  if (family === 'CAP') {
    const capability = value as CapabilityProtocol;
    const errors: ProtocolValidationError[] = [];
    const formalEffects = ['formal-write', 'delete', 'external-send', 'permission-change'];
    if (
      formalEffects.includes(capability.sideEffect) &&
      !capability.permission.endsWith('.each-approval')
    )
      errors.push(
        ruleError('$.permission', 'PROTOCOL-RULE-CAP-001', 'CAP_PERMISSION_INSUFFICIENT')
      );
    if (
      capability.usageCost.amount < 0 ||
      !capability.usageCost.unit ||
      !capability.usageCost.source
    )
      errors.push(ruleError('$.usageCost', 'PROTOCOL-RULE-CAP-002', 'CAP_COST_SOURCE_MISSING'));
    return errors;
  }
  if (family === 'NODE') {
    const node = value as NodeProtocol;
    const allPorts = [...node.inputPorts, ...node.outputPorts];
    const errors: ProtocolValidationError[] = [];
    if (
      new Set(node.inputPorts.map((port) => port.name)).size !== node.inputPorts.length ||
      new Set(node.outputPorts.map((port) => port.name)).size !== node.outputPorts.length ||
      allPorts.some((port) => !port.typeRef)
    )
      errors.push(ruleError('$', 'PROTOCOL-RULE-NODE-001', 'NODE_PORT_CONFLICT'));
    const formalEffects = ['formal-write', 'delete', 'external-send', 'permission-change'];
    if (
      node.cache.keyIncludes.length < 5 ||
      (formalEffects.includes(node.sideEffectPolicy) &&
        (!node.idempotency.required || node.cache.mode !== 'disabled'))
    )
      errors.push(ruleError('$', 'PROTOCOL-RULE-NODE-002', 'NODE_POLICY_INCOHERENT'));
    return errors;
  }
  if (family === 'WORKFLOW') {
    const workflow = value as WorkflowProtocol;
    const nodeIds = new Set(workflow.nodes.map((node) => node.nodeId));
    const errors: ProtocolValidationError[] = [];
    if (
      !nodeIds.has(workflow.entryNodeId) ||
      workflow.connections.some(
        (connection) => !nodeIds.has(connection.fromNode) || !nodeIds.has(connection.toNode)
      )
    )
      errors.push(
        ruleError('$.connections', 'PROTOCOL-RULE-WORKFLOW-001', 'WORKFLOW_GRAPH_UNRESOLVED')
      );
    if (
      !workflow.changeDecisionPath ||
      !workflow.reviewPoints.some((point) => point.reviewerRequired && nodeIds.has(point.nodeId))
    )
      errors.push(
        ruleError('$.reviewPoints', 'PROTOCOL-RULE-WORKFLOW-002', 'WORKFLOW_REVIEW_MISSING')
      );
    return errors;
  }
  if (family === 'RUN') {
    const run = value as RunProtocol;
    const errors: ProtocolValidationError[] = [];
    if (
      ![run.workflowRef, ...run.nodeVersions, ...run.capabilityVersions, ...run.dataVersions].every(
        isStableVersion
      )
    )
      errors.push(ruleError('$', 'PROTOCOL-RULE-RUN-001', 'RUN_VERSION_LOCK_INCOMPLETE'));
    if (
      run.status === 'waiting-human-review' &&
      !(
        run.review.required &&
        run.review.status === 'pending' &&
        run.changeResult.status === 'candidate'
      )
    )
      errors.push(ruleError('$', 'PROTOCOL-RULE-RUN-002', 'RUN_STATE_INCOHERENT'));
    return errors;
  }
  if (family === 'CHANGE') {
    const change = value as ChangeProtocol;
    const errors: ProtocolValidationError[] = [];
    if (
      change.decision === 'accepted' &&
      !(
        change.formalWrite &&
        change.permission === 'formal.write.each-approval' &&
        change.reviewerRef.id &&
        change.conflicts.length === 0 &&
        change.checks.every((check) => check.status === 'passed')
      )
    )
      errors.push(ruleError('$', 'PROTOCOL-RULE-CHANGE-001', 'CHANGE_ACCEPTANCE_UNAUTHORIZED'));
    if (change.decision !== 'accepted' && change.formalWrite)
      errors.push(ruleError('$', 'PROTOCOL-RULE-CHANGE-002', 'CHANGE_NONACCEPTED_WRITE'));
    return errors;
  }
  if (family === 'APP') {
    const app = value as AppProtocol;
    const errors: ProtocolValidationError[] = [];
    if (
      app.compatibility.status !== 'compatible' ||
      app.compatibility.protocolVersion !== '1.0.0' ||
      !app.dependencies.some(
        (dependency) => canonical(dependency) === canonical(app.entryWorkflowRef)
      )
    )
      errors.push(ruleError('$', 'PROTOCOL-RULE-APP-001', 'APP_ENTRY_INCOMPATIBLE'));
    if (!app.lifecycle.rollbackVersion)
      errors.push(ruleError('$.lifecycle', 'PROTOCOL-RULE-APP-002', 'APP_ROLLBACK_MISSING'));
    return errors;
  }
  if (family === 'CANVAS') {
    const canvas = value as CanvasProtocol;
    const errors: ProtocolValidationError[] = [];
    if (canvas.kernel.domainSchemaRefs.length || canvas.kernel.vendorTypeRefs.length)
      errors.push(ruleError('$.kernel', 'PROTOCOL-RULE-CANVAS-001', 'CANVAS_KERNEL_COUPLED'));
    if (canvas.workflowAdapter.layoutChangeCreatesDomainChangeSet !== false)
      errors.push(
        ruleError('$.workflowAdapter', 'PROTOCOL-RULE-CANVAS-002', 'CANVAS_LAYOUT_DOMAIN_CHANGE')
      );
    return errors;
  }
  return [];
}

export function validateProtocol<K extends ProtocolFamilyName>(
  family: K,
  value: unknown
): ProtocolValidationResult<ProtocolByFamily[K]> {
  const record = protocolSchemas[family];
  const schemaErrors = validateSchema(record.schema as JsonSchema, value, '$', record.sourcePath);
  if (schemaErrors.length) return { valid: false, errors: schemaErrors };
  const rules = semanticErrors(family, value);
  return rules.length
    ? { valid: false, errors: rules }
    : { valid: true, value: value as ProtocolByFamily[K], errors: [] };
}

export const validateNodeProtocol = (value: unknown): ProtocolValidationResult<NodeProtocol> =>
  validateProtocol('NODE', value);
export const validateWorkflowProtocol = (
  value: unknown
): ProtocolValidationResult<WorkflowProtocol> => validateProtocol('WORKFLOW', value);
export const validateRunProtocol = (value: unknown): ProtocolValidationResult<RunProtocol> =>
  validateProtocol('RUN', value);
export const validateChangeProtocol = (value: unknown): ProtocolValidationResult<ChangeProtocol> =>
  validateProtocol('CHANGE', value);
export const validateAppProtocol = (value: unknown): ProtocolValidationResult<AppProtocol> =>
  validateProtocol('APP', value);
export const validateCanvasProtocol = (value: unknown): ProtocolValidationResult<CanvasProtocol> =>
  validateProtocol('CANVAS', value);
