import type { LldbDapLaunchArguments } from '../dap/protocol.js';

export interface LaunchArgsOptions {
  program: string;
  cwd: string;
}

/**
 * Extension point for supporting additional DAP servers (debugpy, delve,
 * codelldb, ...) beyond lldb-dap. The transport layer (DapClient) never
 * needs to know about any of this — it's purely adapter resolution/config.
 */
export interface AdapterDefinition {
  id: string;
  resolveExecutable(): Promise<string>;
  spawnArgs: string[];
  buildLaunchArgs(opts: LaunchArgsOptions): LldbDapLaunchArguments;
}
