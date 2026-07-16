import { useEffect, useRef } from 'react';
import type { SessionSnapshot } from '@shared/types';
import { useUiStore } from '@shared/ui/useUiStore';
import { Panel } from './Panel';

interface WatchPanelProps {
  snapshot: SessionSnapshot;
}

export function WatchPanel({ snapshot }: WatchPanelProps) {
  const focusedPanel = useUiStore((s) => s.focusedPanel);
  const selectedIndex = useUiStore((s) => s.selectedWatchIndex);
  const isFocused = focusedPanel === 'watch';

  const selectedRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isFocused) selectedRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [isFocused, selectedIndex]);

  return (
    <Panel id="watch" title="watches" focused={isFocused}>
      {snapshot.watches.length === 0 ? (
        <div className="px-2 font-sans text-fg-dim">no watches — type : then watch &lt;expr&gt;</div>
      ) : (
        snapshot.watches.map((watch, idx) => {
          const isSelected = isFocused && idx === selectedIndex;
          return (
            <div
              key={watch.id}
              ref={isSelected ? selectedRowRef : undefined}
              className={`mx-1 cursor-pointer truncate rounded-sm px-1.5 py-0.5 transition-colors hover:bg-hover ${isSelected ? 'bg-selection' : ''}`}
              onClick={() => window.dbg.removeWatch(watch.id)}
            >
              {watch.expression} <span className="text-fg-dim">=</span>{' '}
              {watch.error ? <span className="text-error">&lt;{watch.error}&gt;</span> : (watch.value ?? '')}
            </div>
          );
        })
      )}
    </Panel>
  );
}
