import type { SessionPhase } from '@shared/types';

/**
 * What to show in a panel that only has content while stopped at a
 * breakpoint. `startKeyHint` is the frontend's own "start execution" key
 * (the Electron app uses F5; the TUI uses `c`) -- callers must pass their
 * own, since this message is shared across both frontends but the binding
 * isn't.
 */
export function emptyStackMessage(phase: SessionPhase, startKeyHint: string): string {
  switch (phase) {
    case 'initializing':
      return '(starting debug adapter...)';
    case 'waiting':
      return '(watching for the target process to start...)';
    case 'configuring':
      return `(not started -- press ${startKeyHint} to begin)`;
    case 'running':
      return '(running...)';
    case 'terminated':
      return '(program exited)';
    case 'error':
      return '(session error -- see status bar)';
    default:
      return '(not stopped)';
  }
}
