import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

export function spawnAdapter(executablePath: string, args: string[] = []): ChildProcessWithoutNullStreams {
  return spawn(executablePath, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    // On Unix, detach the adapter into its own session (setsid) so it and
    // everything it spawns (the debuggee) have no controlling terminal.
    // Without a controlling terminal, SIGTTIN is never sent — which otherwise
    // happens when the debuggee ends up in a background process group while
    // Ink holds the terminal in raw mode.
    // On Windows, detached would create a new console window; skip it there.
    detached: process.platform !== 'win32',
  });
}

/**
 * Kill the adapter process and all processes it has spawned.
 * On Unix, sends SIGTERM to the whole process group (negative pid) since the
 * adapter was spawned detached and is the group leader. On Windows, kills
 * the process directly.
 */
export function killAdapter(child: ChildProcessWithoutNullStreams): void {
  if (process.platform !== 'win32' && child.pid !== undefined) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // process group already gone
    }
  } else {
    child.kill();
  }
}
