import type { DebugProtocol } from '@vscode/debugprotocol';

export type { DebugProtocol };

/**
 * lldb-dap accepts several launch fields beyond the DAP base spec's
 * intentionally-untyped LaunchRequestArguments.
 */
export interface LldbDapLaunchArguments extends DebugProtocol.LaunchRequestArguments {
  program: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  stopOnEntry?: boolean;
  initCommands?: string[];
  preRunCommands?: string[];
}

/**
 * lldb-dap's `attach` request accepts either `pid` (attach to an existing
 * process) or `program` + `waitFor: true` (poll for a process matching that
 * path/name and attach once it appears -- confirmed via `strings` on the
 * installed lldb-dap binary: both field names and the
 * `Waiting to attach to "%s"...` log message are present verbatim).
 */
export interface LldbDapAttachArguments extends DebugProtocol.AttachRequestArguments {
  pid?: number;
  program?: string;
  waitFor?: boolean;
}

export interface DebugpyLaunchArguments extends DebugProtocol.LaunchRequestArguments {
  program: string;
  cwd?: string;
  args?: string[];
  env?: Record<string, string>;
  stopOnEntry?: boolean;
  console?: 'internalConsole' | 'integratedTerminal' | 'externalTerminal';
  python?: string[];
}

export interface DebugpyAttachArguments extends DebugProtocol.AttachRequestArguments {
  processId?: number;
}
