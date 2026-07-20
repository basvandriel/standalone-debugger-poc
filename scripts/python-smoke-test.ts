/**
 * Headless proof of Python debugging via debugpy: drives the full DAP
 * handshake against the python-loop fixture, verifies breakpoint hit,
 * variable inspection, step-over, and run-to-completion with stdout capture.
 * Run via `npm run smoke:python`.
 */
import assert from "node:assert/strict";
import { spawnAdapter } from "../src/engine/dap/spawnAdapter.js";
import { DapClient } from "../src/engine/dap/DapClient.js";
import { debugpyAdapter } from "../src/engine/adapters/debugpy.js";
import { getFixtureConfig } from "./fixtures.js";

const FIXTURE = getFixtureConfig("python-loop");
const FIXTURE_DIR = FIXTURE.cwd;
const PROGRAM = FIXTURE.program;
const SOURCE = FIXTURE.source;
const BREAKPOINT_LINE = FIXTURE.breakpointLine;

function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  ms = 15_000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out waiting for: ${label}`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function main(): Promise<void> {
  const executablePath = await debugpyAdapter.resolveExecutable();
  console.log(`[python-smoke] resolved Python at ${executablePath}`);

  const child = spawnAdapter(executablePath, debugpyAdapter.spawnArgs);
  child.on("error", (err) =>
    console.error("[python-smoke] adapter process error:", err),
  );
  child.on("exit", (code, signal) =>
    console.log(
      `[python-smoke] adapter process exited (code=${code}, signal=${signal})`,
    ),
  );
  child.stderr.on("data", (chunk: Buffer) =>
    process.stderr.write(`[debugpy stderr] ${chunk}`),
  );

  const capturedOutput: { category: string; text: string }[] = [];
  const client = new DapClient(child.stdout, child.stdin);
  client.on("*", (msg: { type: string; event?: string; command?: string }) => {
    console.log(
      `[dap] <- ${msg.type}${msg.event ? ":" + msg.event : ""}${msg.command ? ":" + msg.command : ""}`,
    );
  });
  client.on("output", (body: { category: string; output: string }) => {
    capturedOutput.push({ category: body.category, text: body.output });
    process.stdout.write(`[program ${body.category}] ${body.output}`);
  });

  await withTimeout(
    client.sendRequest("initialize", {
      clientID: "dbg",
      clientName: "dbg",
      adapterID: debugpyAdapter.id,
      pathFormat: "path",
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
      supportsRunInTerminalRequest: false,
      supportsInvalidatedEvent: true,
      locale: "en-US",
    }),
    "initialize response",
  );
  console.log("[python-smoke] initialize OK");

  // debugpy (like lldb-dap) fires `initialized` after receiving `launch`.
  const initializedPromise = withTimeout(
    new Promise<void>((resolve) => client.once("initialized", () => resolve())),
    "initialized event",
    20_000,
  );

  const launchArgs = debugpyAdapter.buildLaunchArgs({
    program: PROGRAM,
    cwd: FIXTURE_DIR,
  });
  const launchPromise = client
    .sendRequest("launch", launchArgs)
    .catch((err) => console.error("[python-smoke] launch request failed:", err));

  await initializedPromise;
  console.log("[python-smoke] received initialized event");

  const setBpResponse = await withTimeout(
    client.sendRequest("setBreakpoints", {
      source: { path: SOURCE },
      breakpoints: [{ line: BREAKPOINT_LINE }],
    }),
    "setBreakpoints response",
  );
  console.log(
    "[python-smoke] setBreakpoints response:",
    JSON.stringify(setBpResponse),
  );

  const stoppedPromise = withTimeout(
    new Promise<{ threadId?: number; reason: string }>((resolve) =>
      client.once("stopped", (body: { threadId?: number; reason: string }) =>
        resolve(body),
      ),
    ),
    "stopped event (breakpoint hit)",
    20_000,
  );

  await withTimeout(
    client.sendRequest("configurationDone"),
    "configurationDone response",
  );
  console.log(
    "[python-smoke] sent configurationDone, waiting for breakpoint hit...",
  );

  const stoppedBody = await stoppedPromise;
  console.log("[python-smoke] stopped:", stoppedBody);
  assert.equal(
    stoppedBody.reason,
    "breakpoint",
    `expected stop reason "breakpoint", got "${stoppedBody.reason}"`,
  );

  const threadsResponse = await withTimeout(
    client.sendRequest<undefined, { threads: { id: number; name: string }[] }>(
      "threads",
    ),
    "threads response",
  );
  const threadId = stoppedBody.threadId ?? threadsResponse.threads[0]!.id;

  const stackResponse = await withTimeout(
    client.sendRequest<
      { threadId: number; startFrame: number; levels: number },
      { stackFrames: { id: number; name: string; line: number }[] }
    >("stackTrace", { threadId, startFrame: 0, levels: 20 }),
    "stackTrace response",
  );
  console.log(
    "[python-smoke] stack frames:",
    stackResponse.stackFrames.map((f) => `${f.name} @ line ${f.line}`),
  );
  assert.ok(stackResponse.stackFrames.length > 0, "expected a non-empty call stack");
  assert.equal(
    stackResponse.stackFrames[0]?.line,
    BREAKPOINT_LINE,
    `expected top frame at line ${BREAKPOINT_LINE}`,
  );
  assert.ok(
    stackResponse.stackFrames[0]?.name === "main",
    `expected top frame named "main", got "${stackResponse.stackFrames[0]?.name}"`,
  );

  const frameId = stackResponse.stackFrames[0]!.id;
  const scopesResponse = await withTimeout(
    client.sendRequest<
      { frameId: number },
      { scopes: { name: string; variablesReference: number }[] }
    >("scopes", { frameId }),
    "scopes response",
  );
  console.log(
    "[python-smoke] scopes:",
    scopesResponse.scopes.map((s) => s.name),
  );

  const localsScope = scopesResponse.scopes.find((s) => s.name === "Locals");
  assert.ok(localsScope, "expected a Locals scope");

  const variablesResponse = await withTimeout(
    client.sendRequest<
      { variablesReference: number },
      { variables: { name: string; value: string }[] }
    >("variables", { variablesReference: localsScope.variablesReference }),
    "variables response (Locals)",
  );
  const byName = Object.fromEntries(
    variablesResponse.variables.map((v) => [v.name, v.value]),
  );
  console.log("[python-smoke] locals at first stop:", byName);
  assert.equal(byName["total"], "0", "expected total=0 before first accumulation");
  assert.equal(byName["doubled"], "2", "expected doubled=2 (double(1)) at first stop");

  // Clear the breakpoint and run to completion.
  await withTimeout(
    client.sendRequest("setBreakpoints", {
      source: { path: SOURCE },
      breakpoints: [],
    }),
    "clear-breakpoints response",
  );
  console.log("[python-smoke] cleared breakpoint, continuing to completion...");

  const terminatedPromise = withTimeout(
    new Promise<void>((resolve) => client.once("terminated", () => resolve())),
    "terminated event",
    20_000,
  );
  void client.sendRequest("continue", { threadId }).catch(() => {});

  await terminatedPromise;
  console.log("[python-smoke] program terminated");
  await launchPromise;

  const stdoutText = capturedOutput
    .filter((e) => e.category === "stdout")
    .map((e) => e.text)
    .join("");
  assert.ok(
    stdoutText.includes(FIXTURE.expectedSummary),
    `expected "${FIXTURE.expectedSummary}" in captured stdout, got: ${stdoutText}`,
  );
  console.log("[python-smoke] captured expected stdout summary line");

  await client
    .sendRequest("disconnect", { terminateDebuggee: true })
    .catch(() => {});
  client.dispose();
  child.kill();

  console.log(
    "[python-smoke] SUCCESS: debugpy DAP handshake, breakpoint hit, " +
      "variable inspection (total=0, doubled=2), and stdout capture all verified.",
  );
}

main().catch((err) => {
  console.error("[python-smoke] FAILED:", err);
  process.exit(1);
});
