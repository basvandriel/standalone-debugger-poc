import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { AdapterDefinition } from './types.js';

const execFileAsync = promisify(execFile);

const MACOS_FALLBACK = '/Library/Developer/CommandLineTools/usr/bin/lldb-dap';
const LINUX_CANDIDATES = ['/usr/bin/lldb-dap', '/usr/local/bin/lldb-dap'];

let cachedExecutablePath: string | undefined;

async function resolveExecutable(): Promise<string> {
  if (cachedExecutablePath) return cachedExecutablePath;

  if (process.platform === 'darwin') {
    try {
      const { stdout } = await execFileAsync('xcrun', ['-f', 'lldb-dap']);
      const resolved = stdout.trim();
      if (resolved) {
        cachedExecutablePath = resolved;
        return resolved;
      }
    } catch {
      // fall through to known CommandLineTools path
    }
    cachedExecutablePath = MACOS_FALLBACK;
    return MACOS_FALLBACK;
  }

  if (process.platform === 'win32') {
    try {
      const { stdout } = await execFileAsync('where', ['lldb-dap']);
      const resolved = stdout.split(/\r?\n/)[0]?.trim();
      if (resolved) {
        cachedExecutablePath = resolved;
        return resolved;
      }
    } catch {
      // fall through to known install locations
    }
    const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files';
    const windowsCandidates = [
      path.join(programFiles, 'LLVM', 'bin', 'lldb-dap.exe'),
    ];
    for (const candidate of windowsCandidates) {
      try {
        await access(candidate);
        cachedExecutablePath = candidate;
        return candidate;
      } catch {
        // try next
      }
    }
    cachedExecutablePath = 'lldb-dap.exe';
    return 'lldb-dap.exe';
  }

  // Linux: check known install locations in order
  for (const candidate of LINUX_CANDIDATES) {
    try {
      await access(candidate);
      cachedExecutablePath = candidate;
      return candidate;
    } catch {
      // try next
    }
  }

  // Last resort: hope it's on PATH
  cachedExecutablePath = 'lldb-dap';
  return 'lldb-dap';
}

export const lldbDapAdapter: AdapterDefinition = {
  id: 'lldb-dap',
  resolveExecutable,
  // Argument-less invocation defaults to stdio DAP communication
  // (confirmed via `lldb-dap --help`); no --port/TCP mode needed.
  spawnArgs: [],
  buildLaunchArgs({ program, cwd }) {
    return {
      program,
      cwd,
      args: [],
      env: {},
      stopOnEntry: false
    };
  },
  buildAttachArgs({ pid, name }) {
    // pid attach is immediate; name attach polls (waitFor) until a matching
    // process appears, so the target can be started from anywhere else.
    if (pid !== undefined) return { pid };
    return { program: name, waitFor: true };
  }
};
