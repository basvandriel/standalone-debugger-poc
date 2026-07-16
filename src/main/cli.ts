import { parseArgs } from 'node:util';
import path from 'node:path';
import type { CliOptions } from '@shared/types';

function printUsage(message?: string): void {
  if (message) console.error(`dbg: ${message}\n`);
  console.error('Usage: dbg run --program <path> [--adapter lldb-dap] [--source <path>] [--cwd <path>]');
}

/** Returns undefined (after printing usage) on any validation failure. */
export function parseCliOptions(argv: string[]): CliOptions | undefined {
  const [subcommand, ...rest] = argv;
  if (subcommand !== 'run') {
    printUsage(subcommand ? `unknown subcommand "${subcommand}"` : 'missing subcommand');
    return undefined;
  }

  let values: { adapter?: string; program?: string; source?: string; cwd?: string; logFile?: string };
  try {
    ({ values } = parseArgs({
      args: rest,
      options: {
        adapter: { type: 'string', default: 'lldb-dap' },
        program: { type: 'string' },
        source: { type: 'string' },
        cwd: { type: 'string' },
        logFile: { type: 'string' }
      },
      strict: true
    }));
  } catch (err) {
    printUsage(err instanceof Error ? err.message : String(err));
    return undefined;
  }

  if (!values.program) {
    printUsage('--program is required');
    return undefined;
  }

  const cwd = values.cwd ? path.resolve(values.cwd) : process.cwd();
  const program = path.resolve(cwd, values.program);
  const source = values.source ? path.resolve(cwd, values.source) : path.join(cwd, 'src', 'main.rs');

  return {
    adapter: values.adapter ?? 'lldb-dap',
    program,
    source,
    cwd,
    logFile: values.logFile
  };
}
