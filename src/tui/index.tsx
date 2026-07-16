// "unused" React import is required: tsx's automatic JSX runtime silently
// breaks useEffect for components imported from other files without it.
import React from 'react';
import { render } from 'ink';
import { parseCliOptions } from '../main/cli.js';
import { DebugSession } from '../engine/session/DebugSession.js';
import { lldbDapAdapter } from '../engine/adapters/lldbDap.js';
import { App } from './App.js';

const cliOptions = parseCliOptions(process.argv.slice(2));
if (!cliOptions) {
  process.exit(1);
}

const adapter = cliOptions.adapter === lldbDapAdapter.id ? lldbDapAdapter : undefined;
if (!adapter) {
  console.error(`dbg: unsupported adapter "${cliOptions.adapter}" (only "lldb-dap" is available in this POC)`);
  process.exit(1);
}

const session = new DebugSession(
  {
    adapterId: cliOptions.adapter,
    programPath: cliOptions.program,
    sourcePath: cliOptions.source,
    cwd: cliOptions.cwd
  },
  adapter
);

const { waitUntilExit } = render(<App session={session} />, { alternateScreen: true });

// Covers Ctrl+C / kill in addition to the in-app `q`/`:quit` paths, so a
// forcibly-closed terminal doesn't leave the adapter process running.
async function shutdown(): Promise<void> {
  await session.terminate().catch(() => undefined);
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

await waitUntilExit();
