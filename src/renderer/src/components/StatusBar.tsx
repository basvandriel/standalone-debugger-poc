import type { SessionSnapshot } from '@shared/types';
import { useUiStore, type FocusedPanel } from '../store/useUiStore';

interface StatusBarProps {
  snapshot: SessionSnapshot;
}

const HINTS: Record<FocusedPanel, string> = {
  source: '↑/↓ move   F9 breakpoint   F5 start/continue   F10 step over   F11 step into   ⇧F11 step out   ⇧F5 stop   : cmd',
  stack: '↑/↓ select frame   F5 start/continue   F10/F11/⇧F11 step   ⇧F5 stop   : cmd',
  variables: '↑/↓ move   → expand   ← collapse   ⏎ toggle   ⇧F5 stop   : cmd',
  watch: '↑/↓ move   Delete remove   ⇧F5 stop   : cmd',
  console: '←/→ switch tab   ⇧F5 stop   : cmd'
};

export function StatusBar({ snapshot }: StatusBarProps) {
  const focusedPanel = useUiStore((s) => s.focusedPanel);
  const currentFrame = snapshot.stack.find((f) => f.id === snapshot.selectedFrameId);
  const currentThread = snapshot.threads.find((t) => t.id === snapshot.selectedThreadId);

  return (
    <div className="status-bar">
      <div className="status-bar-top">
        <span className="status-adapter">dbg :: {snapshot.adapterId}</span>
        <span className="status-phase">phase: {snapshot.phase}</span>
        <span className="status-program">{snapshot.programPath}</span>
        {currentThread && (
          <span className="status-thread">
            thread: {currentThread.name} {currentFrame ? `@ ${currentFrame.name}:${currentFrame.line}` : ''}
          </span>
        )}
        {snapshot.errorMessage && <span className="status-error">error: {snapshot.errorMessage}</span>}
      </div>
      <div className="status-bar-hints">{HINTS[focusedPanel]}</div>
    </div>
  );
}
