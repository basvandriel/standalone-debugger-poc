import { useEffect, useRef } from 'react';
import type { SessionSnapshot } from '@shared/types';
import { useUiStore } from '@shared/ui/useUiStore';
import { Panel } from './Panel';
import { emptyStackMessage } from '@shared/ui/phaseMessages';
import { ELECTRON_KEYS } from '@shared/ui/keybindings';

interface CallStackPanelProps {
  snapshot: SessionSnapshot;
}

export function CallStackPanel({ snapshot }: CallStackPanelProps) {
  const focusedPanel = useUiStore((s) => s.focusedPanel);
  const isFocused = focusedPanel === 'stack';

  const selectedRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [snapshot.selectedFrameId]);

  return (
    <Panel id="stack" title="call stack" focused={isFocused}>
      {snapshot.stack.length === 0 ? (
        <div className="text-fg-dim">{emptyStackMessage(snapshot.phase, ELECTRON_KEYS.startContinue)}</div>
      ) : (
        snapshot.stack.map((frame) => {
          const isSelected = frame.id === snapshot.selectedFrameId;
          return (
            <div
              key={frame.id}
              ref={isSelected ? selectedRowRef : undefined}
              className={`flex cursor-pointer truncate px-2 py-px hover:bg-hover ${isSelected ? 'bg-selection' : ''}`}
              onClick={() => window.dbg.selectFrame(frame.id)}
            >
              <span className={`w-3 flex-none ${isSelected ? 'text-accent' : ''}`}>{isSelected ? '▸' : ' '}</span>
              <span className={isSelected ? 'text-accent' : ''}>{frame.name}</span>
              <span className="text-fg-dim">&nbsp;@ {frame.line}</span>
            </div>
          );
        })
      )}
    </Panel>
  );
}
