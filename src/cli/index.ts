#!/usr/bin/env node
import { migrateV1 } from '../migration/index.js';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function parseArgs(args: string[]): { input: string; namespace: string; out: string } {
  if (args[0] !== 'migrate-v1') throw new Error('Usage: agent-protocols migrate-v1 <absolute-input> --namespace <name> --out <absolute-output>');
  const input = args[1];
  let namespace = '';
  let out = '';
  for (let index = 2; index < args.length; index += 1) {
    if (args[index] === '--namespace') namespace = args[++index] ?? '';
    else if (args[index] === '--out') out = args[++index] ?? '';
    else throw new Error('Unknown argument: ' + args[index]);
  }
  if (!input || !namespace || !out) throw new Error('Usage: agent-protocols migrate-v1 <absolute-input> --namespace <name> --out <absolute-output>');
  return { input, namespace, out };
}

export function main(args = process.argv.slice(2)): number {
  try {
    const options = parseArgs(args);
    const report = migrateV1(options.input, options.namespace, options.out);
    process.stdout.write(JSON.stringify(report) + '\n');
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(message + '\n');
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exitCode = main();
