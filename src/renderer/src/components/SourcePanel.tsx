import { useEffect, useRef } from "react";
import type { SessionSnapshot } from "@shared/types";
import { useUiStore } from "@shared/ui/useUiStore";
import { Panel } from "./Panel";

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
  const activeSourcePath = useUiStore((s) => s.activeSourcePath);
  const isFocused = focusedPanel === "source";

  const breakpoints = activeSourcePath
    ? (snapshot.breakpoints[activeSourcePath] ?? [])
    : [];
  const breakpointByLine = new Map(breakpoints.map((b) => [b.line, b]));
  const currentFrame = snapshot.stack.find(
    (f) => f.id === snapshot.selectedFrameId,
  );
  const currentLine =
    activeSourcePath !== undefined && currentFrame?.sourcePath === activeSourcePath
      ? currentFrame.line
      : undefined;

  // Execution position takes priority over the keyboard cursor -- when a
  // breakpoint hits somewhere off-screen, that's what needs to scroll into
  // view, not wherever the cursor happened to be left.
  const activeLine = currentLine ?? (isFocused ? cursorLine : undefined);
  const activeRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeLine]);

  function toggleBreakpointAt(line: number): void {
    setFocusedPanel("source");
    setCursorLine(line);
    if (activeSourcePath) void window.dbg.toggleBreakpoint(activeSourcePath, line);
  }

  return (
    <Panel
      id="source"
      title={activeSourcePath ? (activeSourcePath.split("/").pop() ?? activeSourcePath) : "(no file)"}
      focused={isFocused}
      bodyClassName="[font-variant-ligatures:none] h-full overflow-y-auto"
    >
      {sourceLines.length === 0 ? (
        <div className="px-2 font-sans text-fg-dim">no source loaded</div>
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
              className={`group flex whitespace-pre transition-colors ${isCurrent ? "bg-accent-dim/70" : ""} ${
                isCursor ? "shadow-[inset_2px_0_0_var(--color-accent)]" : ""
              }`}
            >
              <span
                className="flex w-4 flex-none cursor-pointer items-center justify-center transition-colors group-hover:bg-hover"
                onClick={() => toggleBreakpointAt(line)}
              >
                {bp ? (
                  <span
                    className={`h-2 w-2 rounded-full ${bp.verified ? "bg-error" : "border border-error bg-transparent"}`}
                  />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-transparent opacity-0 group-hover:opacity-30 group-hover:bg-fg-dim" />
                )}
              </span>
              <span
                className="w-8.5 flex-none cursor-pointer pr-2.5 text-right text-fg-dim transition-colors group-hover:bg-hover"
                onClick={() => toggleBreakpointAt(line)}
              >
                {line}
              </span>
              {highlightedLines?.[idx] !== undefined ? (
                <span
                  dangerouslySetInnerHTML={{ __html: highlightedLines[idx] }}
                />
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
