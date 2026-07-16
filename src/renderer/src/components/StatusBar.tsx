import type { SessionPhase, SessionSnapshot } from '@shared/types';
import { useUiStore, type FocusedPanel } from '@shared/ui/useUiStore';
import { ELECTRON_KEYS } from '@shared/ui/keybindings';

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

const PHASE_CLASS: Record<SessionPhase, string> = {
  idle: 'bg-fg-dim/20 text-fg-dim',
  initializing: 'bg-fg-dim/20 text-fg-dim',
  configuring: 'bg-accent-dim text-accent',
  running: 'bg-warn/20 text-warn',
  stopped: 'bg-success/20 text-success',
  terminated: 'bg-fg-dim/20 text-fg-dim',
  error: 'bg-error/20 text-error'
};

export function StatusBar({ snapshot }: StatusBarProps) {
  const focusedPanel = useUiStore((s) => s.focusedPanel);
  const currentFrame = snapshot.stack.find((f) => f.id === snapshot.selectedFrameId);
  const currentThread = snapshot.threads.find((t) => t.id === snapshot.selectedThreadId);

  return (
    <div className="flex-none border-b border-border bg-panel-header">
      <div className="flex items-center gap-4 px-2.5 py-1">
        <span className="font-bold text-accent">dbg :: {snapshot.adapterId}</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${PHASE_CLASS[snapshot.phase]}`}>
          {PHASE_LABEL[snapshot.phase]}
        </span>
        <span className="flex-1 truncate text-fg-dim">{snapshot.programPath}</span>
        {currentThread && (
          <span className="text-fg-dim">
            thread: {currentThread.name} {currentFrame ? `@ ${currentFrame.name}:${currentFrame.line}` : ''}
          </span>
        )}
        {snapshot.errorMessage && <span className="text-error">error: {snapshot.errorMessage}</span>}
      </div>
      <div className="px-2.5 pt-0.5 pb-1 text-[11px] text-fg-dim">{HINTS[focusedPanel]}</div>
    </div>
  );
}
