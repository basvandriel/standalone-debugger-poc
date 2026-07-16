import { useEffect, useRef } from 'react';
import type { SessionSnapshot } from '@shared/types';
import { useUiStore } from '@shared/ui/useUiStore';
import { Panel } from './Panel';

interface SourcePanelProps {
  snapshot: SessionSnapshot;
  highlightedLines: string[] | undefined;
}

export function SourcePanel({ snapshot, highlightedLines }: SourcePanelProps) {
  const sourceLines = useUiStore((s) => s.sourceLines);
  const cursorLine = useUiStore((s) => s.cursorLine);
  const setCursorLine = useUiStore((s) => s.setCursorLine);
  const focusedPanel = useUiStore((s) => s.focusedPanel);
  const setFocusedPanel = useUiStore((s) => s.setFocusedPanel);
  const isFocused = focusedPanel === 'source';

  const breakpoints = snapshot.breakpoints[snapshot.sourcePath] ?? [];
  const breakpointByLine = new Map(breakpoints.map((b) => [b.line, b]));
  const currentFrame = snapshot.stack.find((f) => f.id === snapshot.selectedFrameId);
  const currentLine = currentFrame?.sourcePath === snapshot.sourcePath ? currentFrame.line : undefined;

  // Execution position takes priority over the keyboard cursor -- when a
  // breakpoint hits somewhere off-screen, that's what needs to scroll into
  // view, not wherever the cursor happened to be left.
  const activeLine = currentLine ?? (isFocused ? cursorLine : undefined);
  const activeRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeLine]);

  function toggleBreakpointAt(line: number): void {
    setFocusedPanel('source');
    setCursorLine(line);
    void window.dbg.toggleBreakpoint(snapshot.sourcePath, line);
  }

  return (
    <Panel
      id="source"
      title={snapshot.sourcePath.split('/').pop() ?? snapshot.sourcePath}
      focused={isFocused}
      bodyClassName="[font-variant-ligatures:none]"
    >
      {sourceLines.length === 0 ? (
        <div className="text-fg-dim">(no source loaded)</div>
      ) : (
        sourceLines.map((text, idx) => {
          const line = idx + 1;
          const bp = breakpointByLine.get(line);
          const isCurrent = line === currentLine;
          const isCursor = isFocused && line === cursorLine;
          return (
            <div
              key={line}
              ref={line === activeLine ? activeRowRef : undefined}
              className={`flex whitespace-pre px-2 ${isCurrent ? 'bg-accent-dim' : ''} ${
                isCursor ? 'shadow-[inset_2px_0_0_var(--color-accent)]' : ''
              }`}
            >
              <span
                className="w-3.5 flex-none cursor-pointer text-error hover:bg-hover"
                onClick={() => toggleBreakpointAt(line)}
              >
                {bp ? (bp.verified ? '●' : '○') : ' '}
              </span>
              <span
                className="w-8.5 flex-none cursor-pointer pr-2.5 text-right text-fg-dim hover:bg-hover"
                onClick={() => toggleBreakpointAt(line)}
              >
                {line}
              </span>
              {highlightedLines?.[idx] !== undefined ? (
                <span dangerouslySetInnerHTML={{ __html: highlightedLines[idx] }} />
              ) : (
                <span>{text}</span>
              )}
            </div>
          );
        })
      )}
    </Panel>
  );
}
