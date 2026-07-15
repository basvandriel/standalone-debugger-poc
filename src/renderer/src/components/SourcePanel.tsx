import type { SessionSnapshot } from '@shared/types';
import { useUiStore } from '../store/useUiStore';

interface SourcePanelProps {
  snapshot: SessionSnapshot;
}

export function SourcePanel({ snapshot }: SourcePanelProps) {
  const sourceLines = useUiStore((s) => s.sourceLines);
  const cursorLine = useUiStore((s) => s.cursorLine);
  const focusedPanel = useUiStore((s) => s.focusedPanel);
  const isFocused = focusedPanel === 'source';

  const breakpoints = snapshot.breakpoints[snapshot.sourcePath] ?? [];
  const breakpointByLine = new Map(breakpoints.map((b) => [b.line, b]));
  const currentFrame = snapshot.stack.find((f) => f.id === snapshot.selectedFrameId);
  const currentLine = currentFrame?.sourcePath === snapshot.sourcePath ? currentFrame.line : undefined;

  return (
    <div className={`panel source-panel ${isFocused ? 'panel-focused' : ''}`}>
      <div className="panel-title">source -- {snapshot.sourcePath}</div>
      <div className="source-scroll">
        {sourceLines.length === 0 ? (
          <div className="dim">(no source loaded)</div>
        ) : (
          sourceLines.map((text, idx) => {
            const line = idx + 1;
            const bp = breakpointByLine.get(line);
            const isCurrent = line === currentLine;
            const isCursor = isFocused && line === cursorLine;
            return (
              <div
                key={line}
                className={`source-line ${isCurrent ? 'source-line-current' : ''} ${isCursor ? 'source-line-cursor' : ''}`}
              >
                <span className="gutter-bp">{bp ? (bp.verified ? '●' : '○') : ' '}</span>
                <span className="gutter-line">{line}</span>
                <span className="source-text">{text}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
