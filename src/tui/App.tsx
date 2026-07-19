// "unused" React import is required: tsx's automatic JSX runtime silently
// breaks useEffect for components imported from other files without it.
import React, { useEffect, useRef, useState } from 'react';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Text, useApp } from 'ink';
import { useDbgStore } from '../shared/ui/useDbgStore.js';
import { useUiStore } from '../shared/ui/useUiStore.js';
import { Layout } from './components/Layout.js';
import { useTuiKeybindings } from './hooks/useTuiKeybindings.js';
import { highlightToTokenLines, type HighlightToken } from './lib/highlightSourceTokens.js';
import { COLORS } from './theme.js';
import type { DebugSession } from '../engine/session/DebugSession.js';
import { listSourceFiles } from '../engine/workspace/listSourceFiles.js';

interface AppProps {
  session: DebugSession;
}

export function App({ session }: AppProps) {
  const { exit } = useApp();

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

  const [highlightedLines, setHighlightedLines] = useState<HighlightToken[][] | undefined>(undefined);

  const loadedSourcePath = useRef<string | undefined>(undefined);
  const lastTopFrameId = useRef<number | undefined>(undefined);

  useEffect(() => {
    const unsubSnapshot = session.onSnapshot(setSnapshot);
    const unsubOutput = session.onOutput(appendOutput);
    const unsubDapLog = session.onDapLog(appendDapLog);

    const initialSnapshot = session.getSnapshot();
    setSnapshot(initialSnapshot);
    // Seed the fuzzy file switcher with files near the initial --source
    // (if any -- attach mode may not have one) before execution has visited
    // any of them, so "jump ahead and set a breakpoint" works from the start.
    if (initialSnapshot.sourcePath) {
      void listSourceFiles(path.dirname(initialSnapshot.sourcePath)).then(addKnownSourceFiles);
    }
    void session.start();

    return () => {
      unsubSnapshot();
      unsubOutput();
      unsubDapLog();
    };
  }, [session, setSnapshot, appendOutput, appendDapLog, addKnownSourceFiles]);

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

    readFile(sourcePath, 'utf8')
      .then(async (text) => {
        if (cancelled) return;
        setSourceLines(text.split('\n'));
        setHighlightedLines(undefined);
        const highlighted = await highlightToTokenLines(text, sourcePath).catch(() => undefined);
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
  }, [activeSourcePath, setSourceLines]);

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

  useTuiKeybindings(session, snapshot, exit);

  if (!snapshot) return <Text color={COLORS.fgDim}>loading...</Text>;

  return (
    <Layout snapshot={snapshot} output={output} dapLog={dapLog} highlightedLines={highlightedLines} session={session} exit={exit} />
  );
}
