const t0 = Date.now();
import path from 'node:path';
import { render } from 'ink-testing-library';
import React from 'react';
import { DebugSession } from '../src/engine/session/DebugSession.js';
import { lldbDapAdapter } from '../src/engine/adapters/lldbDap.js';
import { App } from '../src/tui/App.js';
import { useDbgStore } from '../src/shared/ui/useDbgStore.js';

console.log(`[timing] imports resolved: ${Date.now() - t0}ms`);

const FIXTURE_DIR = '../fixtures/loop-demo';
const PROGRAM = path.join(FIXTURE_DIR, 'target', 'debug', 'loop-demo');
const SOURCE = path.join(FIXTURE_DIR, 'src', 'main.rs');

async function main(): Promise<void> {
  const session = new DebugSession(
    { adapterId: 'lldb-dap', programPath: PROGRAM, sourcePath: SOURCE, cwd: FIXTURE_DIR },
    lldbDapAdapter
  );
  const t1 = Date.now();
  const { unmount } = render(React.createElement(App, { session }));
  console.log(`[timing] Ink render() call returned: ${Date.now() - t1}ms (total ${Date.now() - t0}ms)`);

  await new Promise<void>((resolve) => {
    const check = () => {
      if (useDbgStore.getState().snapshot?.phase === 'configuring') resolve();
      else setTimeout(check, 5);
    };
    check();
  });
  console.log(`[timing] TOTAL process start -> configuring/READY: ${Date.now() - t0}ms`);

  const t2 = Date.now();
  await session.terminate();
  unmount();
  console.log(`[timing] terminate() from READY (no run): ${Date.now() - t2}ms`);
  process.exit(0);
}

main();
