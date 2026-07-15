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
