import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const schemaDir = new URL('../schemas/v2/', import.meta.url);
const generatedTypes = new URL('../src/generated/contracts.ts', import.meta.url);
const generatedManifest = new URL('../src/generated/schema-manifest.ts', import.meta.url);
const kinds = ['IntentContract', 'TaskSeed', 'Acceptance', 'PublishGate', 'Evidence'];
const schemaNames = ['common', ...kinds, 'CloudEvent'];
const schemas = {};
for (const name of schemaNames) {
  const path = new URL(name + '.schema.json', schemaDir);
  if (!existsSync(path)) throw new Error('Missing schema: ' + path.pathname);
  schemas[name] = JSON.parse(readFileSync(path, 'utf8'));
}
const content = readFileSync(generatedTypes, 'utf8');
for (const kind of kinds) {
  if (!content.includes('interface ' + kind)) throw new Error('Generated type is missing: ' + kind);
}
const manifest = '/* Generated from schemas/v2. Do not edit manually. */\nexport const V2_SCHEMA_MANIFEST = ' +
  JSON.stringify(Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, {
    id: schema.$id,
    title: schema.title,
    required: schema.required ?? schema.allOf?.flatMap((part) => part.required ?? []) ?? [],
  }])), null, 2) + ' as const;\n';
if (process.argv.includes('--check')) {
  if (readFileSync(generatedManifest, 'utf8') !== manifest) throw new Error('Generated schema manifest is out of date');
  process.stdout.write('generated types and schema manifest are up to date\n');
} else {
  writeFileSync(generatedTypes, content, 'utf8');
  writeFileSync(generatedManifest, manifest, 'utf8');
  process.stdout.write('generated types and schema manifest verified from schemas/v2\n');
}
