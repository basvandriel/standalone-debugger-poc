import { execFile } from 'node:child_process';
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { AdapterDefinition } from './types.js';

const execFileAsync = promisify(execFile);

const MACOS_FALLBACK = '/Library/Developer/CommandLineTools/usr/bin/lldb-dap';
const LINUX_CANDIDATES = ['/usr/bin/lldb-dap', '/usr/local/bin/lldb-dap'];

let cachedExecutablePath: string | undefined;

// Scan the VS Code extensions directory for any installed CodeLLDB version.
// Returns candidate codelldb.exe paths sorted newest-first (lexicographic desc).
async function findCodeLLDBInVSCode(): Promise<string[]> {
  const home = process.env['USERPROFILE'] ?? '';
  const extsDir = path.join(home, '.vscode', 'extensions');
  try {
    const dirs = await readdir(extsDir);
    return dirs
      .filter(d => d.startsWith('vadimcn.vscode-lldb-'))
      .sort()
      .reverse()
      .map(d => path.join(extsDir, d, 'extension', 'adapter', 'codelldb.exe'));
  } catch {
    return [];
  }
}

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
    // Prefer codelldb (CodeLLDB's custom LLDB build) over the standard LLVM
    // lldb-dap: codelldb has a patched PDB reader that handles Rust debug
    // symbols without crashing (0xC0000409). Checked in order:
    //   1. Our CI/bundled download at C:\codelldb
    //   2. The user's VS Code extensions directory (CodeLLDB extension)
    //   3. codelldb on PATH
    // Fall back to lldb-dap only if none of the above are found (C/C++ still works).
    const codelldbCandidates = [
      'C:\\codelldb\\extension\\adapter\\codelldb.exe',
      ...(await findCodeLLDBInVSCode()),
    ];
    for (const p of codelldbCandidates) {
      try {
        await access(p);
        cachedExecutablePath = p;
        return p;
      } catch {
        // try next
      }
    }
    try {
      const { stdout } = await execFileAsync('where', ['codelldb']);
      const resolved = stdout.split(/\r?\n/)[0]?.trim();
      if (resolved) {
        cachedExecutablePath = resolved;
        return resolved;
      }
    } catch {
      // not on PATH
    }

    // lldb-dap fallback: works for C/C++, crashes for Rust PDB (see KNOWN_ISSUES.md)
    try {
      const { stdout } = await execFileAsync('where', ['lldb-dap']);
      const resolved = stdout.split(/\r?\n/)[0]?.trim();
      if (resolved) {
        cachedExecutablePath = resolved;
        return resolved;
      }
    } catch {
      // not on PATH
    }
    const programFiles = process.env['ProgramFiles'] ?? 'C:\\Program Files';
    const lldbDapCandidates = [
      path.join(programFiles, 'LLVM', 'bin', 'lldb-dap.exe'),
    ];
    for (const candidate of lldbDapCandidates) {
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
  // Argument-less invocation defaults to stdio DAP communication for both
  // lldb-dap and codelldb; no --port/TCP mode needed.
  spawnArgs: [],
  buildLaunchArgs({ program, cwd }) {
    return {
      program,
      cwd,
      args: [],
      env: {},
      stopOnEntry: false,
      // Activates Rust/C/C++ type formatters and NatVis in codelldb.
      // lldb-dap ignores this field (DAP adapters silently skip unknown args).
      sourceLanguages: ['rust', 'c', 'cpp'],
    };
  },
  buildAttachArgs({ pid, name }) {
    // pid attach is immediate; name attach polls (waitFor) until a matching
    // process appears, so the target can be started from anywhere else.
    if (pid !== undefined) return { pid };
    return { program: name, waitFor: true };
  }
};
