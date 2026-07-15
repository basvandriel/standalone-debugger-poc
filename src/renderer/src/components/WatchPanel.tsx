import type { SessionSnapshot } from '@shared/types';
import { useUiStore } from '../store/useUiStore';

interface WatchPanelProps {
  snapshot: SessionSnapshot;
}

export function WatchPanel({ snapshot }: WatchPanelProps) {
  const focusedPanel = useUiStore((s) => s.focusedPanel);
  const selectedIndex = useUiStore((s) => s.selectedWatchIndex);
  const isFocused = focusedPanel === 'watch';

  return (
    <div className={`panel watch-panel ${isFocused ? 'panel-focused' : ''}`}>
      <div className="panel-title">watches -- press : then :watch &lt;expr&gt;, Delete to remove</div>
      <div className="panel-scroll">
        {snapshot.watches.length === 0 ? (
          <div className="dim">(none)</div>
        ) : (
          snapshot.watches.map((watch, idx) => (
            <div
              key={watch.id}
              className={`list-row ${isFocused && idx === selectedIndex ? 'list-row-selected' : ''}`}
              onClick={() => window.dbg.removeWatch(watch.id)}
            >
              {watch.expression} <span className="dim">=</span>{' '}
              {watch.error ? <span className="watch-error">&lt;{watch.error}&gt;</span> : (watch.value ?? '')}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
