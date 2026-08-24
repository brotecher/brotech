import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const writeMode = args.includes('--write');
const checkMode = args.includes('--check');
const reportIndex = args.indexOf('--report');
const reportPath = reportIndex >= 0 ? resolve(process.cwd(), args[reportIndex + 1]) : null;
if (writeMode === checkMode) throw new Error('exactly one of --write or --check is required');
if (reportIndex >= 0 && !args[reportIndex + 1]) throw new Error('--report requires a path');

const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const registry = await readJson('protocol-registry.json');
const schemas = new Map();
for (const family of registry.families)
  schemas.set(family.name, await readJson(family.schema.path));

const literal = (value) => JSON.stringify(value);
const refType = (ref, level, rootSchema) => {
  if (ref.endsWith('#/$defs/stableRef')) return 'StableRef';
  if (ref.startsWith('#/$defs/')) {
    const name = ref.slice('#/$defs/'.length);
    const target = rootSchema.$defs?.[name];
    if (!target) throw new Error(`unresolved local generated ref: ${ref}`);
    return typeFor(target, level, rootSchema);
  }
  throw new Error(`unsupported generated ref: ${ref}`);
};

function typeFor(schema, level = 0, rootSchema = schema) {
  if (schema.$ref) return refType(schema.$ref, level, rootSchema);
  if (Object.hasOwn(schema, 'const')) return literal(schema.const);
  if (schema.enum) return schema.enum.map(literal).join(' | ');
  if (schema.type === 'string') return 'string';
  if (schema.type === 'number' || schema.type === 'integer') return 'number';
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'array') return `Array<${typeFor(schema.items, level, rootSchema)}>`;
  if (schema.type === 'object') {
    const required = new Set(schema.required ?? []);
    const indent = '  '.repeat(level + 1);
    const closeIndent = '  '.repeat(level);
    const entries = Object.keys(schema.properties ?? {})
      .sort()
      .map(
        (key) =>
          `${indent}${key}${required.has(key) ? '' : '?'}: ${typeFor(schema.properties[key], level + 1, rootSchema)};`
      );
    return `{\n${entries.join('\n')}\n${closeIndent}}`;
  }
  throw new Error(`unsupported schema shape: ${JSON.stringify(schema)}`);
}

const prt = schemas.get('PRT-ID');
const blocks = [
  '// Generated from 1.0.0 JSON Schemas. Do not edit.',
  '',
  `export interface StableRef ${typeFor(prt.$defs.stableRef, 0, prt)}`
];
for (const family of registry.families) {
  const schema = schemas.get(family.name);
  blocks.push('', `export interface ${family.derivedType} ${typeFor(schema, 0, schema)}`);
}
const output = `${blocks.join('\n')}\n`;
const outputPath = resolve(root, registry.artifacts.derivedTypes.path);
const sha256 = createHash('sha256').update(output).digest('hex');

if (writeMode) {
  await writeFile(outputPath, output);
  process.stdout.write(
    `${JSON.stringify({ mode: 'write', path: registry.artifacts.derivedTypes.path, bytes: Buffer.byteLength(output), sha256, status: 'written' })}\n`
  );
} else {
  const existing = await readFile(outputPath, 'utf8');
  if (existing !== output) throw new Error('generated TypeScript drift detected');
  const report = {
    protocolVersion: registry.protocolVersion,
    generator: 'mojing-protocol-schema-types-v1',
    mode: 'check',
    outputPath: registry.artifacts.derivedTypes.path,
    bytes: Buffer.byteLength(output),
    sha256,
    familyCount: registry.families.length,
    stableOrdering: true,
    drift: false,
    passed: true
  };
  if (reportPath) await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report)}\n`);
}
