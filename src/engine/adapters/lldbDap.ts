import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AdapterDefinition } from './types.js';

const execFileAsync = promisify(execFile);

const FALLBACK_PATH = '/Library/Developer/CommandLineTools/usr/bin/lldb-dap';

let cachedExecutablePath: string | undefined;

async function resolveExecutable(): Promise<string> {
  if (cachedExecutablePath) return cachedExecutablePath;

  try {
    const { stdout } = await execFileAsync('xcrun', ['-f', 'lldb-dap']);
    const resolved = stdout.trim();
    if (resolved) {
      cachedExecutablePath = resolved;
      return resolved;
    }
  } catch {
    // fall through to the known CommandLineTools path
  }

  cachedExecutablePath = FALLBACK_PATH;
  return FALLBACK_PATH;
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
