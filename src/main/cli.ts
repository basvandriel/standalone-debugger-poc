import { parseArgs } from "node:util";
import path from "node:path";
import fs from "node:fs";
import type { CliOptions } from "@shared/types";

function printUsage(message?: string): void {
  if (message) console.error(`dbg: ${message}\n`);
  console.error(
    "Usage: dbg <program>                          # run a binary or script\n" +
      "       dbg attach <name>                      # attach by process name\n" +
      "       dbg attach --pid <pid>                 # attach by PID\n" +
      "\n" +
      "Options: [--source <path>] [--adapter <id>] [--cwd <path>]",
  );
}

export function parseCliOptions(argv: string[]): CliOptions | undefined {
  const [first, ...rest] = argv;

  if (first === "attach") return parseAttachOptions(rest);
  if (first === "run") return parseRunOptions(rest);     // backwards compat
  if (first && !first.startsWith("-")) return parseRunOptions(argv); // dbg <program>

  printUsage(first ? `unknown option "${first}"` : "missing program");
  return undefined;
}

function detectAdapter(program: string): string {
  return path.extname(program) === ".py" ? "debugpy" : "lldb-dap";
}

function detectSource(program: string, cwd: string, adapter: string): string | undefined {
  if (adapter === "debugpy") return program; // the script is its own source

  // Walk up from the program looking for a Cargo.toml → src/main.rs
  let dir = path.dirname(program);
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, "src", "main.rs");
    if (fs.existsSync(path.join(dir, "Cargo.toml")) && fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Fall back: src/main.rs or src/main.c or src/main.cpp relative to cwd
  for (const name of ["main.rs", "main.c", "main.cpp"]) {
    const candidate = path.join(cwd, "src", name);
    if (fs.existsSync(candidate)) return candidate;
  }

  return undefined;
}

function parseRunOptions(args: string[]): CliOptions | undefined {
  let values: { adapter?: string; program?: string; source?: string; cwd?: string; logFile?: string };
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgs({
      args,
      options: {
        adapter: { type: "string" },
        program: { type: "string" },
        source: { type: "string" },
        cwd: { type: "string" },
        logFile: { type: "string" },
      },
      allowPositionals: true,
      strict: true,
    }));
  } catch (err) {
    printUsage(err instanceof Error ? err.message : String(err));
    return undefined;
  }

  const programRaw = values.program ?? positionals[0];
  if (!programRaw) {
    printUsage("missing program — pass a path to a binary or script");
    return undefined;
  }

  const cwd = values.cwd ? path.resolve(values.cwd) : process.cwd();
  const program = path.resolve(cwd, programRaw);
  const adapter = values.adapter ?? detectAdapter(program);
  const source = values.source
    ? path.resolve(cwd, values.source)
    : detectSource(program, cwd, adapter);

  return { mode: "run", adapter, program, source, cwd, logFile: values.logFile };
}

function parseAttachOptions(args: string[]): CliOptions | undefined {
  let values: { adapter?: string; pid?: string; name?: string; source?: string; cwd?: string; logFile?: string };
  let positionals: string[];
  try {
    ({ values, positionals } = parseArgs({
      args,
      options: {
        adapter: { type: "string" },
        pid: { type: "string" },
        name: { type: "string" },
        source: { type: "string" },
        cwd: { type: "string" },
        logFile: { type: "string" },
      },
      allowPositionals: true,
      strict: true,
    }));
  } catch (err) {
    printUsage(err instanceof Error ? err.message : String(err));
    return undefined;
  }

  // Accept positional as name: `dbg attach ./my-binary`
  const nameRaw = values.name ?? positionals[0];

  if (!values.pid && !nameRaw) {
    printUsage("attach requires a process name or --pid");
    return undefined;
  }
  if (values.pid && nameRaw) {
    printUsage("attach accepts only one of a name or --pid, not both");
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
  const attachName = nameRaw ? path.resolve(cwd, nameRaw) : undefined;

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
