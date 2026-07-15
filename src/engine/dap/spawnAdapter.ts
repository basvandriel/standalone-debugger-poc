import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

export function spawnAdapter(executablePath: string, args: string[] = []): ChildProcessWithoutNullStreams {
  return spawn(executablePath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
}
