import type { SessionSnapshot } from '@shared/types';
import { useUiStore } from '../store/useUiStore';

interface CallStackPanelProps {
  snapshot: SessionSnapshot;
}

export function CallStackPanel({ snapshot }: CallStackPanelProps) {
  const focusedPanel = useUiStore((s) => s.focusedPanel);
  const isFocused = focusedPanel === 'stack';

  return (
    <div className={`panel stack-panel ${isFocused ? 'panel-focused' : ''}`}>
      <div className="panel-title">call stack</div>
      <div className="panel-scroll">
        {snapshot.stack.length === 0 ? (
          <div className="dim">(not stopped)</div>
        ) : (
          snapshot.stack.map((frame) => (
            <div
              key={frame.id}
              className={`list-row ${frame.id === snapshot.selectedFrameId ? 'list-row-selected' : ''}`}
              onClick={() => window.dbg.selectFrame(frame.id)}
            >
              {frame.name} <span className="dim">@ {frame.line}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
