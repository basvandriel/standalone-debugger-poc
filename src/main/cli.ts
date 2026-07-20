import { parseArgs } from "node:util";
import path from "node:path";
import fs from "node:fs";
import type { CliOptions } from "@shared/types";

function printUsage(message?: string): void {
  if (message) console.error(`dbg: ${message}\n`);
  console.error(
    "Usage: dbg                     # auto-detect project in current directory\n" +
      "       dbg <program>           # run a specific binary or script\n" +
      "       dbg attach <name>       # attach by process name\n" +
      "       dbg attach --pid <pid>  # attach by PID",
  );
}

export function parseCliOptions(argv: string[]): CliOptions | undefined {
  const [first, ...rest] = argv;

  if (first === "attach") return parseAttachOptions(rest);
  if (first === "run") return parseRunOptions(rest); // backwards compat
  return parseRunOptions(argv);                      // dbg, dbg <program>
}

// --- auto-discovery ----------------------------------------------------------

function discoverProject(cwd: string): { program: string; adapter: string; source: string } | undefined {
  // Rust: Cargo.toml present → find binary in target/debug
  const cargoToml = path.join(cwd, "Cargo.toml");
  if (fs.existsSync(cargoToml)) {
    const toml = fs.readFileSync(cargoToml, "utf8");
    const nameMatch = toml.match(/^\s*name\s*=\s*"([^"]+)"/m);
    const name = nameMatch?.[1];
    if (name) {
      const program = path.join(cwd, "target", "debug", name);
      const source = path.join(cwd, "src", "main.rs");
      if (fs.existsSync(program)) return { program, adapter: "lldb-dap", source };
      console.error(`dbg: found Cargo.toml (${name}) but binary not built yet — run \`cargo build\` first`);
      return undefined;
    }
  }

  // Python: look for common entry points
  for (const name of ["main.py", "app.py", "__main__.py"]) {
    const program = path.join(cwd, name);
    if (fs.existsSync(program)) return { program, adapter: "debugpy", source: program };
  }

  return undefined;
}

function detectAdapter(program: string): string {
  return path.extname(program) === ".py" ? "debugpy" : "lldb-dap";
}

function detectSource(program: string, cwd: string, adapter: string): string | undefined {
  if (adapter === "debugpy") return program;

  // Walk up from the binary looking for Cargo.toml → src/main.rs
  let dir = path.dirname(program);
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, "src", "main.rs");
    if (fs.existsSync(path.join(dir, "Cargo.toml")) && fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  for (const name of ["main.rs", "main.c", "main.cpp"]) {
    const candidate = path.join(cwd, "src", name);
    if (fs.existsSync(candidate)) return candidate;
  }

  return undefined;
}

// --- run ---------------------------------------------------------------------

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

  const cwd = values.cwd ? path.resolve(values.cwd) : process.cwd();
  const programRaw = values.program ?? positionals[0];

  // Zero args — auto-discover from cwd
  if (!programRaw) {
    const discovered = discoverProject(cwd);
    if (!discovered) {
      printUsage("could not auto-detect a project — pass a binary or script path");
      return undefined;
    }
    return { mode: "run", ...discovered, cwd, logFile: values.logFile };
  }

  const program = path.resolve(cwd, programRaw);
  const adapter = values.adapter ?? detectAdapter(program);
  const source = values.source ? path.resolve(cwd, values.source) : detectSource(program, cwd, adapter);

  return { mode: "run", adapter, program, source, cwd, logFile: values.logFile };
}

// --- attach ------------------------------------------------------------------

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
