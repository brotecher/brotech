import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspace = resolve(root, '../..');
const args = process.argv.slice(2);
const reportIndex = args.indexOf('--report');
const checksumsIndex = args.indexOf('--checksums');
if (reportIndex < 0 || checksumsIndex < 0 || !args[reportIndex + 1] || !args[checksumsIndex + 1])
  throw new Error('--report and --checksums are required');
const reportPath = resolve(process.cwd(), args[reportIndex + 1]);
const checksumsPath = resolve(process.cwd(), args[checksumsIndex + 1]);
const workspaceRelative = (path) => relative(workspace, path).replaceAll('\\', '/');
const hashFile = async (path) =>
  createHash('sha256')
    .update(await readFile(path))
    .digest('hex');

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path)));
    else if (entry.isFile()) files.push(path);
    else if (entry.isSymbolicLink()) continue;
    else throw new Error(`unsupported filesystem entry: ${path}`);
  }
  return files;
}

const expectedWorkspace = [
  'README.md',
  'protocol-registry.json',
  'schemas/prt-id.schema.json',
  'schemas/cap.schema.json',
  'schemas/node.schema.json',
  'schemas/workflow.schema.json',
  'schemas/run.schema.json',
  'schemas/change.schema.json',
  'schemas/app.schema.json',
  'schemas/canvas.schema.json',
  'rules/protocol-rules.json',
  'compatibility/place-relation-decision.json',
  'examples/normal-examples.json',
  'examples/invalid-examples.json',
  'examples/cross-family-examples.json',
  'tools/generate-types.mjs',
  'tools/validate-contracts.mjs',
  'tools/verify-scope.mjs',
  'generated/protocol-types.ts',
  'docs/protocol.md'
].sort();
const protocolSourcePrefixes = [
  'README.md',
  'protocol-registry.json',
  'schemas/',
  'rules/',
  'compatibility/',
  'examples/',
  'tools/',
  'generated/',
  'docs/'
];
const actualWorkspace = (await listFiles(root))
  .map((path) => relative(root, path).replaceAll('\\', '/'))
  .filter((path) =>
    protocolSourcePrefixes.some((prefix) =>
      prefix.endsWith('/') ? path.startsWith(prefix) : path === prefix
    )
  )
  .sort();

const stableWorkspacePaths = expectedWorkspace.map((path) =>
  workspaceRelative(resolve(root, path))
);
const scopeReport = {
  protocolVersion: '1.0.0',
  expectedWorkspaceCount: expectedWorkspace.length,
  actualWorkspaceCount: actualWorkspace.length,
  expectedWorkspace,
  actualWorkspace,
  workspaceExact: JSON.stringify(expectedWorkspace) === JSON.stringify(actualWorkspace),
  evidenceScope: 'current protocol workspace only',
  forbiddenEntries: actualWorkspace.filter(
    (path) => path.includes('node_modules') || path.endsWith('.tmp') || path === 'package-lock.json'
  ),
  passed:
    JSON.stringify(expectedWorkspace) === JSON.stringify(actualWorkspace) &&
    actualWorkspace.length === 20
};
await writeFile(reportPath, `${JSON.stringify(scopeReport, null, 2)}\n`);
if (!scopeReport.passed) throw new Error('scope verification failed');

const checksumPaths = stableWorkspacePaths;
const checksumLines = [];
for (const path of checksumPaths)
  checksumLines.push(`${await hashFile(resolve(workspace, path))}  ${path}`);
await writeFile(checksumsPath, `${checksumLines.join('\n')}\n`);
process.stdout.write(
  `${JSON.stringify({ workspaceCount: actualWorkspace.length, checksumCount: checksumPaths.length, forbiddenEntries: scopeReport.forbiddenEntries, passed: scopeReport.passed })}\n`
);
