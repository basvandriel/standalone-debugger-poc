import { parseArgs } from "node:util";
import path from "node:path";
import type { CliOptions } from "@shared/types";

function printUsage(message?: string): void {
  if (message) console.error(`dbg: ${message}\n`);
  console.error(
    "Usage: dbg run --program <path> [--adapter lldb-dap] [--source <path>] [--cwd <path>]\n" +
      "       dbg attach (--pid <pid> | --name <process-name>) [--adapter lldb-dap] [--source <path>] [--cwd <path>]",
  );
}

/** Returns undefined (after printing usage) on any validation failure. */
export function parseCliOptions(argv: string[]): CliOptions | undefined {
  const [subcommand, ...rest] = argv;

  if (subcommand === "run") return parseRunOptions(rest);
  if (subcommand === "attach") return parseAttachOptions(rest);

  printUsage(
    subcommand ? `unknown subcommand "${subcommand}"` : "missing subcommand",
  );
  return undefined;
}

function parseRunOptions(rest: string[]): CliOptions | undefined {
  let values: {
    adapter?: string;
    program?: string;
    source?: string;
    cwd?: string;
    logFile?: string;
  };
  try {
    ({ values } = parseArgs({
      args: rest,
      options: {
        adapter: { type: "string", default: "lldb-dap" },
        program: { type: "string" },
        source: { type: "string" },
        cwd: { type: "string" },
        logFile: { type: "string" },
      },
      strict: true,
    }));
  } catch (err) {
    printUsage(err instanceof Error ? err.message : String(err));
    return undefined;
  }

  if (!values.program) {
    printUsage("--program is required");
    return undefined;
  }

  const cwd = values.cwd ? path.resolve(values.cwd) : process.cwd();
  const program = path.resolve(cwd, values.program);
  const source = values.source
    ? path.resolve(cwd, values.source)
    : path.join(cwd, "src", "main.rs");

  return {
    mode: "run",
    adapter: values.adapter ?? "lldb-dap",
    program,
    source,
    cwd,
    logFile: values.logFile,
  };
}

function parseAttachOptions(rest: string[]): CliOptions | undefined {
  let values: {
    adapter?: string;
    pid?: string;
    name?: string;
    source?: string;
    cwd?: string;
    logFile?: string;
  };
  try {
    ({ values } = parseArgs({
      args: rest,
      options: {
        adapter: { type: "string", default: "lldb-dap" },
        pid: { type: "string" },
        name: { type: "string" },
        source: { type: "string" },
        cwd: { type: "string" },
        logFile: { type: "string" },
      },
      strict: true,
    }));
  } catch (err) {
    printUsage(err instanceof Error ? err.message : String(err));
    return undefined;
  }

  if (!values.pid && !values.name) {
    printUsage("attach requires exactly one of --pid or --name");
    return undefined;
  }
  if (values.pid && values.name) {
    printUsage("attach accepts only one of --pid or --name, not both");
    return undefined;
  }

  let attachPid: number | undefined;
  if (values.pid) {
    attachPid = Number(values.pid);
    if (!Number.isInteger(attachPid) || attachPid <= 0) {
      printUsage(`--pid must be a positive integer, got "${values.pid}"`);
      return undefined;
    }
  }

  const cwd = values.cwd ? path.resolve(values.cwd) : process.cwd();
  const source = values.source ? path.resolve(cwd, values.source) : undefined;
  // lldb-dap's waitFor matches against the real process image path, so
  // --name is resolved to an absolute path the same way --program is for
  // `run` -- a bare relative filename is resolved against --cwd rather than
  // passed through as a bare name.
  const attachName = values.name ? path.resolve(cwd, values.name) : undefined;

  return {
    mode: "attach",
    adapter: values.adapter ?? "lldb-dap",
    attachPid,
    attachName,
    source,
    cwd,
    logFile: values.logFile,
  };
}
