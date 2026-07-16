import type { SessionPhase, SessionSnapshot } from '@shared/types';
import { useUiStore, type FocusedPanel } from '@shared/ui/useUiStore';
import { ELECTRON_KEYS } from '@shared/ui/keybindings';
import { BugIcon } from './icons';

interface StatusBarProps {
  snapshot: SessionSnapshot;
}

const K = ELECTRON_KEYS;
const HINTS: Record<FocusedPanel, string> = {
  source: `${K.moveUp}/${K.moveDown} move   ${K.toggleBreakpoint} breakpoint   ${K.startContinue} start/continue   ${K.stepOver} step over   ${K.stepIn} step into   ${K.stepOut} step out   ${K.stop} stop   ${K.commandBar} cmd`,
  stack: `${K.moveUp}/${K.moveDown} select frame   ${K.startContinue} start/continue   ${K.stepOver}/${K.stepIn}/${K.stepOut} step   ${K.stop} stop   ${K.commandBar} cmd`,
  variables: `${K.moveUp}/${K.moveDown} move   ${K.expand} expand   ${K.collapse} collapse   ${K.toggleEntry} toggle   ${K.stop} stop   ${K.commandBar} cmd`,
  watch: `${K.moveUp}/${K.moveDown} move   ${K.removeWatch} remove   ${K.stop} stop   ${K.commandBar} cmd`,
  console: `${K.switchTab} switch tab   ${K.stop} stop   ${K.commandBar} cmd`
};

const PHASE_LABEL: Record<SessionPhase, string> = {
  idle: 'idle',
  initializing: 'starting',
  configuring: 'ready',
  running: 'running',
  stopped: 'paused',
  terminated: 'exited',
  error: 'error'
};

const PHASE_BADGE_CLASS: Record<SessionPhase, string> = {
  idle: 'bg-fg-dim/10 text-fg-dim ring-fg-dim/25',
  initializing: 'bg-fg-dim/10 text-fg-dim ring-fg-dim/25',
  configuring: 'bg-accent-dim/60 text-accent ring-accent/40',
  running: 'bg-warn/15 text-warn ring-warn/40',
  stopped: 'bg-success/15 text-success ring-success/40',
  terminated: 'bg-fg-dim/10 text-fg-dim ring-fg-dim/25',
  error: 'bg-error/15 text-error ring-error/40'
};

const PHASE_DOT_CLASS: Record<SessionPhase, string> = {
  idle: 'bg-fg-dim',
  initializing: 'bg-fg-dim animate-pulse',
  configuring: 'bg-accent',
  running: 'bg-warn animate-pulse',
  stopped: 'bg-success',
  terminated: 'bg-fg-dim',
  error: 'bg-error'
};

export function StatusBar({ snapshot }: StatusBarProps) {
  const focusedPanel = useUiStore((s) => s.focusedPanel);
  const currentFrame = snapshot.stack.find((f) => f.id === snapshot.selectedFrameId);
  const currentThread = snapshot.threads.find((t) => t.id === snapshot.selectedThreadId);

  return (
    <div className="flex-none bg-panel-header shadow-[0_1px_0_var(--color-border),0_4px_10px_-6px_rgba(0,0,0,0.6)] font-sans">
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="flex items-center gap-1.5 font-semibold text-accent">
          <BugIcon width={14} height={14} />
          dbg
        </span>
        <span className="text-fg-dim/50">·</span>
        <span className="text-fg-dim">{snapshot.adapterId}</span>
        <span
          className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ring-1 ${PHASE_BADGE_CLASS[snapshot.phase]}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${PHASE_DOT_CLASS[snapshot.phase]}`} />
          {PHASE_LABEL[snapshot.phase]}
        </span>
        <span className="flex-1 truncate font-mono text-fg-dim">{snapshot.programPath}</span>
        {currentThread && (
          <span className="truncate text-fg-dim">
            {currentThread.name}
            {currentFrame ? (
              <span className="font-mono text-fg-dim">
                {' '}
                @ {currentFrame.name}:{currentFrame.line}
              </span>
            ) : null}
          </span>
        )}
        {snapshot.errorMessage && <span className="text-error">error: {snapshot.errorMessage}</span>}
      </div>
      <div className="px-3 pt-0 pb-1.5 text-[11px] tracking-wide text-fg-dim/80">{HINTS[focusedPanel]}</div>
    </div>
  );
}
