import { useEffect, useRef } from 'react';
import { useDbgStore } from './store/useDbgStore';
import { useUiStore } from './store/useUiStore';
import { useKeybindings } from './hooks/useKeybindings';
import { Layout } from './components/Layout';

export function App() {
  const snapshot = useDbgStore((s) => s.snapshot);
  const output = useDbgStore((s) => s.output);
  const dapLog = useDbgStore((s) => s.dapLog);
  const setSnapshot = useDbgStore((s) => s.setSnapshot);
  const appendOutput = useDbgStore((s) => s.appendOutput);
  const appendDapLog = useDbgStore((s) => s.appendDapLog);

  const setSourceLines = useUiStore((s) => s.setSourceLines);
  const resetVariableExpansion = useUiStore((s) => s.resetVariableExpansion);

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
    window.dbg
      .readSourceFile(snapshot.sourcePath)
      .then((text) => setSourceLines(text.split('\n')))
      .catch(() => setSourceLines([]));
  }, [snapshot?.sourcePath, setSourceLines]);

  useEffect(() => {
    if (!snapshot || snapshot.phase !== 'stopped') return;
    const topFrameId = snapshot.stack[0]?.id;
    if (topFrameId !== lastTopFrameId.current) {
      lastTopFrameId.current = topFrameId;
      resetVariableExpansion();
    }
  }, [snapshot?.phase, snapshot?.stack, resetVariableExpansion]);

  useKeybindings(snapshot);

  if (!snapshot) return <div className="loading">loading...</div>;

  return <Layout snapshot={snapshot} output={output} dapLog={dapLog} />;
}
