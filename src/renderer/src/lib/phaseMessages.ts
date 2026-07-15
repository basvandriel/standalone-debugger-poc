import type { SessionPhase } from '@shared/types';

/** What to show in a panel that only has content while stopped at a breakpoint. */
export function emptyStackMessage(phase: SessionPhase): string {
  switch (phase) {
    case 'initializing':
      return '(starting debug adapter...)';
    case 'configuring':
      return '(not started -- press F5 to begin)';
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
