/**
 * M1 headless proof: drives the full lldb-dap handshake against the
 * loop-demo fixture with zero UI/Electron involvement, to isolate DAP
 * protocol risk from IPC/renderer risk. Run via `npm run smoke`.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnAdapter } from '../src/engine/dap/spawnAdapter.js';
import { DapClient } from '../src/engine/dap/DapClient.js';
import { lldbDapAdapter } from '../src/engine/adapters/lldbDap.js';
import { getFixtureConfig } from './fixtures.js';

const FIXTURE = getFixtureConfig('loop-demo');
const FIXTURE_DIR = FIXTURE.cwd;
const PROGRAM = FIXTURE.program;
const SOURCE = FIXTURE.source;
const BREAKPOINT_LINE = FIXTURE.breakpointLine; // `total += doubled as i64;`

function withTimeout<T>(promise: Promise<T>, label: string, ms = 10_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for: ${label}`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function main(): Promise<void> {
  const executablePath = await lldbDapAdapter.resolveExecutable();
  console.log(`[smoke] resolved lldb-dap at ${executablePath}`);

  const child = spawnAdapter(executablePath, lldbDapAdapter.spawnArgs);
  child.on('error', (err) => console.error('[smoke] adapter process error:', err));
  child.on('exit', (code, signal) => console.log(`[smoke] adapter process exited (code=${code}, signal=${signal})`));
  child.stderr.on('data', (chunk: Buffer) => process.stderr.write(`[lldb-dap stderr] ${chunk}`));

  const client = new DapClient(child.stdout, child.stdin);
  client.on('*', (msg: { type: string; event?: string; command?: string }) => {
    console.log(`[dap] <- ${msg.type}${msg.event ? ':' + msg.event : ''}${msg.command ? ':' + msg.command : ''}`);
  });
  client.on('output', (body: { category: string; output: string }) => {
    process.stdout.write(`[program ${body.category}] ${body.output}`);
  });

  const capabilities = await withTimeout(
    client.sendRequest('initialize', {
      clientID: 'dbg',
      clientName: 'dbg',
      adapterID: lldbDapAdapter.id,
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
      supportsRunInTerminalRequest: false,
      supportsInvalidatedEvent: true,
      locale: 'en-US'
    }),
    'initialize response'
  );
  console.log('[smoke] capabilities:', capabilities);

  // NOTE: real lldb-dap deviates from the "textbook" DAP ordering here.
  // It does NOT send `initialized` right after the `initialize` response;
  // it only sends `initialized` once `launch` has been received and the
  // target process is being stood up (confirmed empirically by capturing
  // the raw byte stream). It also resolves the `launch` response quickly,
  // rather than deferring it until `configurationDone`. So: fire `launch`
  // first, THEN wait for `initialized`.
  const initializedPromise = withTimeout(
    new Promise<void>((resolve) => client.once('initialized', () => resolve())),
    'initialized event',
    15_000
  );

  const launchArgs = lldbDapAdapter.buildLaunchArgs({ program: PROGRAM, cwd: FIXTURE_DIR });
  const launchPromise = client.sendRequest('launch', launchArgs).catch((err) => {
    console.error('[smoke] launch request failed:', err);
  });

  await initializedPromise;
  console.log('[smoke] received initialized event');

  const setBpResponse = await withTimeout(
    client.sendRequest('setBreakpoints', {
      source: { path: SOURCE },
      breakpoints: [{ line: BREAKPOINT_LINE }]
    }),
    'setBreakpoints response'
  );
  console.log('[smoke] setBreakpoints response:', JSON.stringify(setBpResponse));

  const stoppedPromise = withTimeout(
    new Promise<{ threadId?: number; reason: string }>((resolve) =>
      client.once('stopped', (body: { threadId?: number; reason: string }) => resolve(body))
    ),
    'stopped event (breakpoint hit)',
    15_000
  );

  await withTimeout(client.sendRequest('configurationDone'), 'configurationDone response');
  console.log('[smoke] sent configurationDone, waiting for breakpoint hit...');

  const stoppedBody = await stoppedPromise;
  console.log('[smoke] stopped:', stoppedBody);
  if (stoppedBody.reason !== 'breakpoint') {
    throw new Error(`expected stop reason "breakpoint", got "${stoppedBody.reason}"`);
  }

  const threadsResponse = await withTimeout(
    client.sendRequest<undefined, { threads: { id: number; name: string }[] }>('threads'),
    'threads response'
  );
  console.log(
    '[smoke] threads:',
    threadsResponse.threads.map((t) => `${t.id}:${t.name}`)
  );

  const threadId = stoppedBody.threadId ?? threadsResponse.threads[0]!.id;

  const stackResponse = await withTimeout(
    client.sendRequest<
      { threadId: number; startFrame: number; levels: number },
      { stackFrames: { id: number; name: string; line: number }[] }
    >('stackTrace', { threadId, startFrame: 0, levels: 20 }),
    'stackTrace response'
  );
  console.log(
    '[smoke] stack frames:',
    stackResponse.stackFrames.map((f) => `${f.name} @ line ${f.line}`)
  );

  const frameId = stackResponse.stackFrames[0]!.id;
  const scopesResponse = await withTimeout(
    client.sendRequest<{ frameId: number }, { scopes: { name: string; variablesReference: number }[] }>('scopes', {
      frameId
    }),
    'scopes response'
  );
  console.log(
    '[smoke] scopes:',
    scopesResponse.scopes.map((s) => s.name)
  );

  for (const scope of scopesResponse.scopes) {
    const variablesResponse = await withTimeout(
      client.sendRequest<{ variablesReference: number }, { variables: { name: string; value: string }[] }>(
        'variables',
        { variablesReference: scope.variablesReference }
      ),
      `variables response (${scope.name})`
    );
    console.log(
      `[smoke] variables in ${scope.name}:`,
      variablesResponse.variables.map((v) => `${v.name}=${v.value}`)
    );
  }

  // Clear the breakpoint before running to completion -- the fixture's loop
  // passes over line 7 five times, so leaving it set would just re-hit it
  // on every iteration instead of letting the program finish.
  await withTimeout(
    client.sendRequest('setBreakpoints', { source: { path: SOURCE }, breakpoints: [] }),
    'clear-breakpoints response'
  );
  console.log('[smoke] cleared breakpoint, continuing to completion...');

  const terminatedPromise = withTimeout(
    new Promise<void>((resolve) => client.once('terminated', () => resolve())),
    'terminated event',
    15_000
  );
  await withTimeout(client.sendRequest('continue', { threadId }), 'continue response');

  await terminatedPromise;
  console.log('[smoke] program terminated');

  await launchPromise;

  await client.sendRequest('disconnect', { terminateDebuggee: true }).catch(() => {});
  client.dispose();
  child.kill();

  console.log(
    '[smoke] SUCCESS: full lldb-dap handshake (initialize/launch/setBreakpoints/configurationDone), ' +
      'breakpoint hit, stack trace, variables, and continue-to-exit all verified headlessly.'
  );
}

main().catch((err) => {
  console.error('[smoke] FAILED:', err);
  process.exit(1);
});
