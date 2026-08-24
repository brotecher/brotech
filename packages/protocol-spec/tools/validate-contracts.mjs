import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const runsIndex = args.indexOf('--runs');
const inlineRuns = args.find((arg) => arg.startsWith('--runs='));
const outputIndex = args.indexOf('--output');
const runs = Number(inlineRuns ? inlineRuns.slice('--runs='.length) : args[runsIndex + 1]);
const outputPath = resolve(process.cwd(), args[outputIndex + 1]);
if ((!inlineRuns && runsIndex < 0) || runs !== 2) throw new Error('--runs must be exactly 2');
if (outputIndex < 0 || !args[outputIndex + 1]) throw new Error('--output requires a path');

const canonicalize = (value) =>
  Array.isArray(value)
    ? value.map(canonicalize)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonicalize(value[key])])
        )
      : value;
const canonical = (value) => JSON.stringify(canonicalize(value));
const hash = (value) =>
  createHash('sha256')
    .update(Buffer.isBuffer(value) || typeof value === 'string' ? value : canonical(value))
    .digest('hex');
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const hashFile = async (path) => hash(await readFile(resolve(root, path)));
const equal = (left, right) => canonical(left) === canonical(right);

const registry = await readJson('protocol-registry.json');
const rulesDoc = await readJson(registry.artifacts.rules.path);
const normalDoc = await readJson(registry.artifacts.normalExamples.path);
const invalidDoc = await readJson(registry.artifacts.invalidExamples.path);
const crossDoc = await readJson(registry.artifacts.crossFamilyExamples.path);
const compatibility = await readJson(registry.artifacts.compatibility.path);

const schemaRecords = new Map();
for (const family of registry.families) {
  const absolutePath = resolve(root, family.schema.path);
  schemaRecords.set(family.name, {
    family,
    absolutePath,
    schema: JSON.parse(await readFile(absolutePath, 'utf8'))
  });
}
const schemaByAbsolutePath = new Map(
  [...schemaRecords.values()].map((record) => [record.absolutePath, record])
);

const allowedKeywords = new Set([
  '$schema',
  '$id',
  '$defs',
  '$ref',
  'title',
  'description',
  'type',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'minItems',
  'maxItems',
  'uniqueItems',
  'minLength',
  'pattern',
  'enum',
  'const',
  'minimum'
]);

function scanKeywords(schema, path = '$') {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return [];
  const errors = [];
  for (const key of Object.keys(schema))
    if (!allowedKeywords.has(key))
      errors.push({ path, keyword: key, errorCode: 'SCHEMA_UNSUPPORTED_KEYWORD' });
  for (const [key, child] of Object.entries(schema.properties ?? {}))
    errors.push(...scanKeywords(child, `${path}.properties.${key}`));
  for (const [key, child] of Object.entries(schema.$defs ?? {}))
    errors.push(...scanKeywords(child, `${path}.$defs.${key}`));
  if (schema.items) errors.push(...scanKeywords(schema.items, `${path}.items`));
  return errors;
}

function resolvePointer(document, fragment) {
  if (!fragment || fragment === '#') return document;
  if (!fragment.startsWith('#/')) throw new Error(`unsupported ref fragment: ${fragment}`);
  return fragment
    .slice(2)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((value, key) => value[key], document);
}

function resolveRef(ref, currentFile) {
  const split = ref.indexOf('#');
  const filePart = split >= 0 ? ref.slice(0, split) : ref;
  const fragment = split >= 0 ? ref.slice(split) : '';
  const absolutePath = filePart ? resolve(dirname(currentFile), filePart) : currentFile;
  const record = schemaByAbsolutePath.get(absolutePath);
  if (!record) throw new Error(`unlisted schema ref: ${ref} from ${currentFile}`);
  const schema = resolvePointer(record.schema, fragment);
  if (!schema) throw new Error(`unresolved schema ref: ${ref}`);
  return { schema, currentFile: absolutePath };
}

function validateSchema(schema, value, path, currentFile) {
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, currentFile);
    return validateSchema(resolved.schema, value, path, resolved.currentFile);
  }
  const errors = [];
  if (Object.hasOwn(schema, 'const') && !equal(value, schema.const))
    errors.push({ path, keyword: 'const', errorCode: 'SCHEMA_CONST' });
  if (schema.enum && !schema.enum.some((item) => equal(item, value)))
    errors.push({ path, keyword: 'enum', errorCode: 'SCHEMA_ENUM' });
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return [...errors, { path, keyword: 'type', errorCode: 'SCHEMA_TYPE' }];
    for (const required of schema.required ?? [])
      if (!Object.hasOwn(value, required))
        errors.push({
          path: `${path}.${required}`,
          keyword: 'required',
          errorCode: 'SCHEMA_REQUIRED'
        });
    for (const [key, child] of Object.entries(schema.properties ?? {}))
      if (Object.hasOwn(value, key))
        errors.push(...validateSchema(child, value[key], `${path}.${key}`, currentFile));
    if (schema.additionalProperties === false)
      for (const key of Object.keys(value))
        if (!Object.hasOwn(schema.properties ?? {}, key))
          errors.push({
            path: `${path}.${key}`,
            keyword: 'additionalProperties',
            errorCode: 'SCHEMA_ADDITIONAL_PROPERTY'
          });
  } else if (schema.type === 'array') {
    if (!Array.isArray(value))
      return [...errors, { path, keyword: 'type', errorCode: 'SCHEMA_TYPE' }];
    if (schema.minItems !== undefined && value.length < schema.minItems)
      errors.push({ path, keyword: 'minItems', errorCode: 'SCHEMA_MIN_ITEMS' });
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      errors.push({ path, keyword: 'maxItems', errorCode: 'SCHEMA_MAX_ITEMS' });
    if (schema.uniqueItems && new Set(value.map(canonical)).size !== value.length)
      errors.push({ path, keyword: 'uniqueItems', errorCode: 'SCHEMA_UNIQUE_ITEMS' });
    value.forEach((item, index) =>
      errors.push(...validateSchema(schema.items, item, `${path}[${index}]`, currentFile))
    );
  } else if (schema.type === 'string') {
    if (typeof value !== 'string')
      return [...errors, { path, keyword: 'type', errorCode: 'SCHEMA_TYPE' }];
    if (schema.minLength !== undefined && value.length < schema.minLength)
      errors.push({ path, keyword: 'minLength', errorCode: 'SCHEMA_MIN_LENGTH' });
    if (schema.pattern && !new RegExp(schema.pattern).test(value))
      errors.push({ path, keyword: 'pattern', errorCode: 'SCHEMA_PATTERN' });
  } else if (schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value))
      return [...errors, { path, keyword: 'type', errorCode: 'SCHEMA_TYPE' }];
    if (schema.minimum !== undefined && value < schema.minimum)
      errors.push({ path, keyword: 'minimum', errorCode: 'SCHEMA_MINIMUM' });
  } else if (schema.type === 'integer') {
    if (!Number.isInteger(value))
      return [...errors, { path, keyword: 'type', errorCode: 'SCHEMA_TYPE' }];
    if (schema.minimum !== undefined && value < schema.minimum)
      errors.push({ path, keyword: 'minimum', errorCode: 'SCHEMA_MINIMUM' });
  } else if (schema.type === 'boolean' && typeof value !== 'boolean')
    errors.push({ path, keyword: 'type', errorCode: 'SCHEMA_TYPE' });
  return errors;
}

const namesUnique = (ports) =>
  new Set(ports.map((port) => port.name)).size === ports.length &&
  ports.every((port) => typeof port.typeRef === 'string' && port.typeRef.length > 0);
const predicates = {
  'stable-ref-roles-explicit': (value) =>
    equal(Object.keys(value.roles).sort(), ['actorRef', 'ownerRef', 'projectRef', 'reviewerRef']),
  'formal-effect-needs-explicit-permission': (value) =>
    !['formal-write', 'delete', 'external-send', 'permission-change'].includes(value.sideEffect) ||
    value.permission.endsWith('.each-approval'),
  'cost-source-explicit': (value) =>
    value.usageCost.amount >= 0 &&
    value.usageCost.unit.length > 0 &&
    value.usageCost.source.length > 0,
  'port-names-unique-and-typed': (value) =>
    namesUnique(value.inputPorts) && namesUnique(value.outputPorts),
  'node-policies-coherent': (value) =>
    value.cache.keyIncludes.length >= 5 &&
    (!['formal-write', 'delete', 'external-send', 'permission-change'].includes(
      value.sideEffectPolicy
    ) ||
      (value.idempotency.required && value.cache.mode === 'disabled')),
  'workflow-graph-resolves': (value) => {
    const nodeIds = new Set(value.nodes.map((node) => node.nodeId));
    return (
      nodeIds.has(value.entryNodeId) &&
      value.connections.every(
        (connection) => nodeIds.has(connection.fromNode) && nodeIds.has(connection.toNode)
      )
    );
  },
  'workflow-review-precedes-change-decision': (value) =>
    value.reviewPoints.some(
      (point) => point.reviewerRequired && value.nodes.some((node) => node.nodeId === point.nodeId)
    ) && value.changeDecisionPath.length > 0,
  'run-locks-complete': (value) =>
    [
      value.workflowRef,
      ...value.nodeVersions,
      ...value.capabilityVersions,
      ...value.dataVersions
    ].every((ref) => ref?.version && ref.version !== 'latest'),
  'run-state-coherent': (value) =>
    value.status !== 'waiting-human-review' ||
    (value.review.required &&
      value.review.status === 'pending' &&
      value.changeResult.status === 'candidate'),
  'accepted-change-needs-reviewer-and-write-permission': (value) =>
    value.decision !== 'accepted' ||
    (value.formalWrite &&
      value.permission === 'formal.write.each-approval' &&
      value.reviewerRef?.id &&
      value.conflicts.length === 0 &&
      value.checks.every((check) => check.status === 'passed')),
  'nonaccepted-change-does-not-write': (value) =>
    value.decision === 'accepted' || value.formalWrite === false,
  'app-entry-is-locked-compatible-dependency': (value) =>
    value.compatibility.status === 'compatible' &&
    value.compatibility.protocolVersion === '1.0.0' &&
    value.dependencies.some((dependency) => equal(dependency, value.entryWorkflowRef)),
  'app-lifecycle-has-rollback': (value) => value.lifecycle.rollbackVersion.length > 0,
  'canvas-kernel-is-domain-and-vendor-neutral': (value) =>
    value.kernel.domainSchemaRefs.length === 0 && value.kernel.vendorTypeRefs.length === 0,
  'layout-change-does-not-create-domain-change': (value) =>
    value.workflowAdapter.layoutChangeCreatesDomainChangeSet === false
};

function ruleErrors(example, ruleById) {
  const errors = [];
  for (const ruleId of example.ruleIds) {
    const rule = ruleById.get(ruleId);
    const predicate = predicates[rule.predicate];
    if (!predicate) throw new Error(`missing predicate implementation: ${rule.predicate}`);
    if (!predicate(example.value)) errors.push({ ruleId, errorCode: rule.errorCode });
  }
  return errors;
}

function deriveScenarioStatus(input) {
  if (input.timeout && input.cancelRequested) return 'cancelled';
  if (input.capabilityOutputValid === false) return 'invalid-output';
  if (input.baseVersion && input.currentVersion && input.baseVersion !== input.currentVersion)
    return 'version-conflict';
  if (input.reviewDecision === 'reject') return 'rejected';
  if (input.reviewDecision === 'pending') return 'candidate';
  if (input.reviewDecision === 'accept' && input.permission !== 'formal.write.each-approval')
    return 'permission-denied';
  if (input.reviewDecision === 'accept') return 'accepted';
  return 'candidate';
}

function runCrossScenario(scenario) {
  const before = structuredClone(crossDoc.baseFormalData);
  const after = structuredClone(before);
  const status = deriveScenarioStatus(scenario.input);
  if (status === 'accepted') {
    const patch = scenario.acceptedPatch;
    after[patch.target] = {
      ...after[patch.target],
      portrait: patch.portrait,
      version: patch.version
    };
  }
  const changedTargets = Object.keys(before).filter((key) => !equal(before[key], after[key]));
  const formalChanged = !equal(before, after);
  const actual = { status, formalChanged, changedTargets };
  const passed =
    equal(actual, scenario.expected) &&
    equal(before['person-shen-wei'], after['person-shen-wei']) &&
    (status === 'accepted' || !formalChanged);
  return {
    id: scenario.id,
    families: scenario.families,
    expected: scenario.expected,
    actual,
    beforeHash: hash(before),
    afterHash: hash(after),
    passed
  };
}

const expectedFamilies = ['PRT-ID', 'CAP', 'NODE', 'WORKFLOW', 'RUN', 'CHANGE', 'APP', 'CANVAS'];
const ruleById = new Map(rulesDoc.rules.map((rule) => [rule.id, rule]));
const allExampleIds = new Set(
  [...normalDoc.examples, ...invalidDoc.examples, ...crossDoc.scenarios].map(
    (example) => example.id
  )
);

const artifactHashResults = [];
for (const family of registry.families)
  artifactHashResults.push({
    path: family.schema.path,
    expected: family.schema.sha256,
    actual: await hashFile(family.schema.path),
    passed: family.schema.sha256 === (await hashFile(family.schema.path))
  });
for (const artifact of Object.values(registry.artifacts))
  artifactHashResults.push({
    path: artifact.path,
    expected: artifact.sha256,
    actual: await hashFile(artifact.path),
    passed: artifact.sha256 === (await hashFile(artifact.path))
  });

function runSuite() {
  const registryChecks = [
    {
      id: 'protocol-version',
      passed: registry.protocolVersion === '1.0.0' && registry.versionComparison === 'opaque-exact'
    },
    {
      id: 'eight-families',
      passed: equal(
        registry.families.map((family) => family.name),
        expectedFamilies
      )
    },
    {
      id: 'exact-family-versions',
      passed: registry.families.every(
        (family) =>
          family.version === '1.0.0' &&
          equal(family.compatibilityRange, { kind: 'exact-set', versions: ['1.0.0'] })
      )
    },
    {
      id: 'schema-dialect',
      passed: registry.schemaDialect === 'https://json-schema.org/draft/2020-12/schema'
    },
    { id: 'artifact-hashes', passed: artifactHashResults.every((item) => item.passed) },
    {
      id: 'rule-ids-unique-stable',
      passed:
        ruleById.size === rulesDoc.rules.length &&
        rulesDoc.rules.every((rule) =>
          /^PROTOCOL-RULE-(PRT-ID|CAP|NODE|WORKFLOW|RUN|CHANGE|APP|CANVAS|CROSS)-[0-9]{3}$/.test(
            rule.id
          )
        )
    },
    {
      id: 'rule-evidence-resolves',
      passed: rulesDoc.rules.every((rule) =>
        rule.evidenceExamples.every((id) => allExampleIds.has(id))
      )
    },
    {
      id: 'place-relation-compatible',
      passed:
        compatibility.decisions.length === 2 &&
        compatibility.decisions.every(
          (decision) => decision.outcome === 'compatible' && decision.explicitMappingRequired
        ) &&
        compatibility.hardBlockers.length === 0
    }
  ];
  const keywordChecks = [...schemaRecords.values()].map((record) => ({
    family: record.family.name,
    errors: scanKeywords(record.schema),
    passed: scanKeywords(record.schema).length === 0
  }));
  const normalResults = normalDoc.examples.map((example) => {
    const record = schemaRecords.get(example.family);
    const schemaErrors = validateSchema(record.schema, example.value, '$', record.absolutePath);
    const semanticErrors = schemaErrors.length ? [] : ruleErrors(example, ruleById);
    return {
      id: example.id,
      family: example.family,
      schemaId: example.schemaId,
      schemaErrors,
      ruleErrors: semanticErrors,
      passed: schemaErrors.length === 0 && semanticErrors.length === 0
    };
  });
  const invalidResults = invalidDoc.examples.map((example) => {
    const record = schemaRecords.get(example.family);
    const schemaErrors = validateSchema(record.schema, example.value, '$', record.absolutePath);
    const semanticErrors = schemaErrors.length ? [] : ruleErrors(example, ruleById);
    const errorCodes = [...schemaErrors, ...semanticErrors].map((error) => error.errorCode);
    return {
      id: example.id,
      family: example.family,
      expectedErrorCode: example.expectedErrorCode,
      errorCodes,
      passed: errorCodes.includes(example.expectedErrorCode)
    };
  });
  const crossResults = crossDoc.scenarios.map(runCrossScenario);
  const compatibilityPaths = crossDoc.requiredCompatibilityPaths.map((item) => ({
    ...item,
    passed: item.status === 'compatible'
  }));
  const passed =
    registryChecks.every((item) => item.passed) &&
    keywordChecks.every((item) => item.passed) &&
    normalResults.every((item) => item.passed) &&
    invalidResults.every((item) => item.passed) &&
    crossResults.every((item) => item.passed) &&
    compatibilityPaths.every((item) => item.passed);
  return {
    registryChecks,
    keywordChecks,
    artifactHashResults,
    normalResults,
    invalidResults,
    crossResults,
    compatibilityPaths,
    summary: {
      families: 8,
      normalPassed: normalResults.filter((item) => item.passed).length,
      normalTotal: normalResults.length,
      invalidPassed: invalidResults.filter((item) => item.passed).length,
      invalidTotal: invalidResults.length,
      crossPassed: crossResults.filter((item) => item.passed).length,
      crossTotal: crossResults.length,
      requiredPathsPassed: compatibilityPaths.filter((item) => item.passed).length,
      requiredPathsTotal: compatibilityPaths.length
    },
    passed
  };
}

const runResults = Array.from({ length: runs }, runSuite);
const runHashes = runResults.map(hash);
const deterministic = new Set(runHashes).size === 1;
const report = {
  protocolVersion: registry.protocolVersion,
  validator: 'mojing-protocol-contract-validator-v1',
  runs,
  runHashes,
  deterministic,
  result: runResults[0],
  resultHash: runHashes[0],
  passed: deterministic && runResults.every((result) => result.passed)
};
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(
  `${JSON.stringify({ runs, runHashes, deterministic, summary: report.result.summary, passed: report.passed })}\n`
);
if (!report.passed) process.exitCode = 1;
