import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { AdapterDefinition } from './types.js';

const execFileAsync = promisify(execFile);

let cachedExecutablePath: string | undefined;

async function resolveExecutable(): Promise<string> {
  if (cachedExecutablePath) return cachedExecutablePath;

  // On Windows, `python` is typically the right command; on Unix, `python3`
  // is preferred to avoid accidentally picking up Python 2.
  const candidates =
    process.platform === 'win32'
      ? ['python', 'python3']
      : ['python3', 'python'];

  for (const cmd of candidates) {
    try {
      await execFileAsync(cmd, ['-c', 'import debugpy']);
      const { stdout } = await execFileAsync(cmd, [
        '-c',
        'import sys; print(sys.executable)',
      ]);
      const resolved = stdout.trim();
      cachedExecutablePath = resolved;
      return resolved;
    } catch {
      // try next candidate
    }
  }
  throw new Error(
    'Python with debugpy not found. Install debugpy: pip install debugpy',
  );
}

export const debugpyAdapter: AdapterDefinition = {
  id: 'debugpy',
  resolveExecutable,
  // `python -m debugpy.adapter` starts the DAP adapter in stdio mode when
  // stdin is not a TTY (which is the case when spawned as a subprocess).
  spawnArgs: ['-m', 'debugpy.adapter'],
  buildLaunchArgs({ program, cwd }) {
    return {
      program,
      cwd,
      args: [],
      env: {},
      stopOnEntry: false,
      // internalConsole routes the debuggee's stdout/stderr through DAP
      // output events so callers can capture program output.
      console: 'internalConsole',
    };
  },
  buildAttachArgs({ pid }) {
    // debugpy uses `processId` (not `pid`) for process-attach.
    // By-name attach is not supported in debugpy's DAP interface.
    if (pid !== undefined) return { processId: pid };
    throw new Error('debugpy attach by name is not supported; use --pid');
  },
};
