// "unused" React import is required: tsx's automatic JSX runtime silently
// breaks useEffect for components imported from other files without it.
import React, { useEffect, useRef, useState } from 'react';
import { readFile } from 'node:fs/promises';
import { Text, useApp } from 'ink';
import { useDbgStore } from '../shared/ui/useDbgStore.js';
import { useUiStore } from '../shared/ui/useUiStore.js';
import { Layout } from './components/Layout.js';
import { useTuiKeybindings } from './hooks/useTuiKeybindings.js';
import { highlightToTokenLines, type HighlightToken } from './lib/highlightSourceTokens.js';
import { COLORS } from './theme.js';
import type { DebugSession } from '../engine/session/DebugSession.js';

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

  const [highlightedLines, setHighlightedLines] = useState<HighlightToken[][] | undefined>(undefined);

  const loadedSourcePath = useRef<string | undefined>(undefined);
  const lastTopFrameId = useRef<number | undefined>(undefined);

  useEffect(() => {
    const unsubSnapshot = session.onSnapshot(setSnapshot);
    const unsubOutput = session.onOutput(appendOutput);
    const unsubDapLog = session.onDapLog(appendDapLog);

    setSnapshot(session.getSnapshot());
    void session.start();

    return () => {
      unsubSnapshot();
      unsubOutput();
      unsubDapLog();
    };
  }, [session, setSnapshot, appendOutput, appendDapLog]);

  useEffect(() => {
    if (!snapshot) return;
    if (loadedSourcePath.current === snapshot.sourcePath) return;
    loadedSourcePath.current = snapshot.sourcePath;
    const sourcePath = snapshot.sourcePath;
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
  }, [snapshot?.sourcePath, setSourceLines]);

  useEffect(() => {
    if (!snapshot || snapshot.phase !== 'stopped') return;
    const topFrameId = snapshot.stack[0]?.id;
    if (topFrameId !== lastTopFrameId.current) {
      lastTopFrameId.current = topFrameId;
      resetVariableExpansion();
    }
  }, [snapshot?.phase, snapshot?.stack, resetVariableExpansion]);

  useTuiKeybindings(session, snapshot, exit);

  if (!snapshot) return <Text color={COLORS.fgDim}>loading...</Text>;

  return (
    <Layout snapshot={snapshot} output={output} dapLog={dapLog} highlightedLines={highlightedLines} session={session} exit={exit} />
  );
}
