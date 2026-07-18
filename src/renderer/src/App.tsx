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
  const activeSourcePath = useUiStore((s) => s.activeSourcePath);
  const setActiveSourcePath = useUiStore((s) => s.setActiveSourcePath);
  const addKnownSourceFiles = useUiStore((s) => s.addKnownSourceFiles);

  // DOM-specific (raw HTML from Shiki) -- stays local to this renderer
  // rather than in the cross-frontend shared UI store.
  const [highlightedLines, setHighlightedLines] = useState<string[] | undefined>(undefined);

  const loadedSourcePath = useRef<string | undefined>(undefined);
  const lastTopFrameId = useRef<number | undefined>(undefined);

  useEffect(() => {
    const unsubSnapshot = window.dbg.onSnapshot(setSnapshot);
    const unsubOutput = window.dbg.onOutput(appendOutput);
    const unsubDapLog = window.dbg.onDapLog(appendDapLog);

    window.dbg.getInitialState().then((initialSnapshot) => {
      setSnapshot(initialSnapshot);
      // Seed the fuzzy file switcher with files near the initial --source
      // (if any -- attach mode may not have one) before execution has
      // visited any of them, so "jump ahead and set a breakpoint" works
      // from the start.
      if (initialSnapshot.sourcePath) {
        void window.dbg.listSourceFiles(initialSnapshot.sourcePath).then(addKnownSourceFiles);
      }
    });
    window.dbg.notifyRendererReady();

    return () => {
      unsubSnapshot();
      unsubOutput();
      unsubDapLog();
    };
  }, [setSnapshot, appendOutput, appendDapLog, addKnownSourceFiles]);

  // Accumulates every file execution has visited or that has a breakpoint,
  // and initializes activeSourcePath from the CLI's --source hint once --
  // this is what lets the source panel "follow, don't ask" across files.
  useEffect(() => {
    if (!snapshot) return;
    const known: string[] = [];
    if (snapshot.sourcePath) known.push(snapshot.sourcePath);
    for (const frame of snapshot.stack) {
      if (frame.sourcePath) known.push(frame.sourcePath);
    }
    known.push(...Object.keys(snapshot.breakpoints));
    if (known.length > 0) addKnownSourceFiles(known);

    if (useUiStore.getState().activeSourcePath === undefined && snapshot.sourcePath) {
      setActiveSourcePath(snapshot.sourcePath);
    }
  }, [snapshot, addKnownSourceFiles, setActiveSourcePath]);

  useEffect(() => {
    if (loadedSourcePath.current === activeSourcePath) return;
    loadedSourcePath.current = activeSourcePath;
    if (!activeSourcePath) {
      setSourceLines([]);
      setHighlightedLines(undefined);
      return;
    }
    const sourcePath = activeSourcePath;
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
  }, [activeSourcePath, setSourceLines, setHighlightedLines]);

  useEffect(() => {
    if (!snapshot || snapshot.phase !== 'stopped') return;
    const topFrameId = snapshot.stack[0]?.id;
    if (topFrameId !== lastTopFrameId.current) {
      lastTopFrameId.current = topFrameId;
      resetVariableExpansion();
      const topFrameSourcePath = snapshot.stack[0]?.sourcePath;
      if (topFrameSourcePath && topFrameSourcePath !== useUiStore.getState().activeSourcePath) {
        setActiveSourcePath(topFrameSourcePath);
      }
    }
  }, [snapshot?.phase, snapshot?.stack, resetVariableExpansion, setActiveSourcePath]);

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
