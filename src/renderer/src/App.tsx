import { useEffect, useRef, useState } from 'react';
import { useDbgStore } from '@shared/ui/useDbgStore';
import { useUiStore } from '@shared/ui/useUiStore';
import { useKeybindings } from './hooks/useKeybindings';
import { Layout } from './components/Layout';
import { highlightToLines } from './lib/highlightSource';
import { BugIcon } from './components/icons';

export function App() {
  const snapshot = useDbgStore((s) => s.snapshot);
  const output = useDbgStore((s) => s.output);
  const dapLog = useDbgStore((s) => s.dapLog);
  const setSnapshot = useDbgStore((s) => s.setSnapshot);
  const appendOutput = useDbgStore((s) => s.appendOutput);
  const appendDapLog = useDbgStore((s) => s.appendDapLog);

  const setSourceLines = useUiStore((s) => s.setSourceLines);
  const resetVariableExpansion = useUiStore((s) => s.resetVariableExpansion);

  // DOM-specific (raw HTML from Shiki) -- stays local to this renderer
  // rather than in the cross-frontend shared UI store.
  const [highlightedLines, setHighlightedLines] = useState<string[] | undefined>(undefined);

  const loadedSourcePath = useRef<string | undefined>(undefined);
  const lastTopFrameId = useRef<number | undefined>(undefined);

  useEffect(() => {
    const unsubSnapshot = window.dbg.onSnapshot(setSnapshot);
    const unsubOutput = window.dbg.onOutput(appendOutput);
    const unsubDapLog = window.dbg.onDapLog(appendDapLog);

    window.dbg.getInitialState().then(setSnapshot);
    window.dbg.notifyRendererReady();

    return () => {
      unsubSnapshot();
      unsubOutput();
      unsubDapLog();
    };
  }, [setSnapshot, appendOutput, appendDapLog]);

  useEffect(() => {
    if (!snapshot) return;
    if (loadedSourcePath.current === snapshot.sourcePath) return;
    loadedSourcePath.current = snapshot.sourcePath;
    const sourcePath = snapshot.sourcePath;
    let cancelled = false;

    window.dbg
      .readSourceFile(sourcePath)
      .then(async (text) => {
        if (cancelled) return;
        setSourceLines(text.split('\n'));
        setHighlightedLines(undefined);
        const highlighted = await highlightToLines(text, sourcePath).catch(() => undefined);
        if (!cancelled) setHighlightedLines(highlighted);
      })
      .catch(() => {
        if (!cancelled) {
          setSourceLines([]);
          setHighlightedLines(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [snapshot?.sourcePath, setSourceLines, setHighlightedLines]);

  useEffect(() => {
    if (!snapshot || snapshot.phase !== 'stopped') return;
    const topFrameId = snapshot.stack[0]?.id;
    if (topFrameId !== lastTopFrameId.current) {
      lastTopFrameId.current = topFrameId;
      resetVariableExpansion();
    }
  }, [snapshot?.phase, snapshot?.stack, resetVariableExpansion]);

  useKeybindings(snapshot);

  if (!snapshot) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-bg font-sans text-fg-dim">
        <BugIcon width={20} height={20} className="animate-pulse text-accent" />
        connecting to debug adapter…
      </div>
    );
  }

  return <Layout snapshot={snapshot} output={output} dapLog={dapLog} highlightedLines={highlightedLines} />;
}
