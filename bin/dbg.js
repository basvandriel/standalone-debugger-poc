#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const electronPath = (await import('electron')).default;
const appEntry = path.join(__dirname, '..', 'out', 'main', 'index.js');

const child = spawn(electronPath, [appEntry, ...process.argv.slice(2)], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
