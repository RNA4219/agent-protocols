import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'agent-protocols-v2-'));
try {
  const command = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : 'npm';
  const npm = (args, cwd) => process.platform === 'win32'
    ? execFileSync(command, ['/d', '/c', 'npm ' + args.join(' ')], { cwd, encoding: 'utf8' })
    : execFileSync(command, args, { cwd, encoding: 'utf8' });
  const packed = npm(['pack', '--pack-destination=' + temp], packageRoot).trim().split(/\r?\n/).pop();
  const tarball = join(temp, packed ?? '');
  if (!packed || !existsSync(tarball)) throw new Error('npm pack did not create a tarball');
  writeFileSync(join(temp, 'package.json'), JSON.stringify({ name: 'agent-protocols-v2-consumer', private: true, type: 'module' }, null, 2));
  writeFileSync(join(temp, 'consumer.ts'), "import { createContractId, type Contract } from '@rna4219/agent-protocols';\nconst id: string = createContractId('IntentContract');\nconst value: Contract | undefined = undefined;\nvoid id; void value;\n");
  writeFileSync(join(temp, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, skipLibCheck: true, noEmit: true }, include: ['consumer.ts'] }, null, 2));
  npm(['install', '--no-audit', '--no-fund', '--ignore-scripts', tarball], temp);
  execFileSync(process.execPath, ['--input-type=module', '-e', "import { createContractId } from '@rna4219/agent-protocols'; if (!createContractId('IntentContract')) throw new Error('import failed');"], { cwd: temp, stdio: 'inherit' });
  JSON.parse(readFileSync(join(temp, 'node_modules', '@rna4219', 'agent-protocols', 'schemas', 'v2', 'common.schema.json'), 'utf8'));
  const tsc = join(packageRoot, 'node_modules', 'typescript', 'bin', 'tsc');
  execFileSync(process.execPath, [tsc, '--noEmit', '-p', join(temp, 'tsconfig.json')], { cwd: temp, stdio: 'inherit' });
  const cli = join(temp, 'node_modules', '@rna4219', 'agent-protocols', 'dist', 'cli', 'index.js');
  const cliResult = spawnSync(process.execPath, [cli], { cwd: temp, encoding: 'utf8' });
  if (cliResult.status !== 1 || !cliResult.stderr.includes('Usage: agent-protocols')) throw new Error('CLI smoke failed');
  process.stdout.write('package consumer smoke passed\n');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
