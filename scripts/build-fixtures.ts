import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

async function run(command: string, args: string[], cwd: string): Promise<void> {
  console.log(`> ${command} ${args.join(' ')}`);
  const { stdout, stderr } = await execFileAsync(command, args, { cwd });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}

async function buildRustFixture(): Promise<void> {
  const fixturePath = path.join(repoRoot, 'fixtures', 'loop-demo');
  await run('cargo', ['build', '--manifest-path', path.join(fixturePath, 'Cargo.toml')], repoRoot);
}

async function buildCFixture(): Promise<void> {
  const targetDir = path.join(repoRoot, 'fixtures', 'c-loop', 'target', 'debug');
  await mkdir(targetDir, { recursive: true });
  await run('clang', ['-g', '-O0', '-o', path.join(targetDir, 'c-loop'), path.join(repoRoot, 'fixtures', 'c-loop', 'src', 'main.c')], repoRoot);
}

async function buildCppFixture(): Promise<void> {
  const targetDir = path.join(repoRoot, 'fixtures', 'cpp-loop', 'target', 'debug');
  await mkdir(targetDir, { recursive: true });
  await run('clang++', ['-g', '-O0', '-o', path.join(targetDir, 'cpp-loop'), path.join(repoRoot, 'fixtures', 'cpp-loop', 'src', 'main.cpp')], repoRoot);
}

async function main(): Promise<void> {
  console.log('Building fixture binaries...');
  await buildRustFixture();
  await buildCFixture();
  await buildCppFixture();
  console.log('Fixture build complete.');
}

main().catch((err) => {
  console.error('Fixture build failed:', err);
  process.exit(1);
});
