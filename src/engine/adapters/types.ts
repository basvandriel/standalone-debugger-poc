import type { LldbDapAttachArguments, LldbDapLaunchArguments } from '../dap/protocol.js';

export interface LaunchArgsOptions {
  program: string;
  cwd: string;
}

export interface AttachArgsOptions {
  /** Attach to an already-running process by id. */
  pid?: number;
  /** Attach-by-name: poll until a process matching this path/name appears. */
  name?: string;
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
  buildAttachArgs(opts: AttachArgsOptions): LldbDapAttachArguments;
}
