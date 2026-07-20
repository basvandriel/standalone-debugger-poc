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
 *
 * buildLaunchArgs / buildAttachArgs return opaque JSON objects; the exact
 * shape is adapter-specific and validated by the adapter itself when the
 * DAP request is sent.
 */
export interface AdapterDefinition {
  id: string;
  resolveExecutable(): Promise<string>;
  spawnArgs: string[];
  buildLaunchArgs(opts: LaunchArgsOptions): Record<string, unknown>;
  buildAttachArgs(opts: AttachArgsOptions): Record<string, unknown>;
}
