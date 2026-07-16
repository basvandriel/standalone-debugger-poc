#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

const [subcommand, ...rest] = process.argv.slice(2);

if (subcommand === 'tui') {
  // Ink needs direct TTY access (raw mode, alternate screen buffer) --
  // 'inherit' keeps this a real terminal for the child rather than a pipe.
  const tsxBin = path.join(projectRoot, 'node_modules', '.bin', 'tsx');
  const tuiEntry = path.join(projectRoot, 'src', 'tui', 'index.tsx');
  const child = spawn(tsxBin, [tuiEntry, ...rest], { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code ?? 0));
} else {
  const electronPath = (await import('electron')).default;
  const appEntry = path.join(projectRoot, 'out', 'main', 'index.js');
  const child = spawn(electronPath, [appEntry, subcommand, ...rest].filter(Boolean), { stdio: 'inherit' });
  child.on('exit', (code) => process.exit(code ?? 0));
}
