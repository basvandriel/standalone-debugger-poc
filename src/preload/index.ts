import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/types';
import type { DapLogEntry, OutputEntry, SessionSnapshot, VariableNode } from '@shared/types';

const api = {
  getInitialState: (): Promise<SessionSnapshot> => ipcRenderer.invoke(IPC.GET_INITIAL_STATE),
  readSourceFile: (path: string): Promise<string> => ipcRenderer.invoke(IPC.READ_SOURCE_FILE, path),
  toggleBreakpoint: (file: string, line: number): Promise<void> =>
    ipcRenderer.invoke(IPC.TOGGLE_BREAKPOINT, file, line),
  beginExecution: (): Promise<void> => ipcRenderer.invoke(IPC.BEGIN_EXECUTION),
  continueExecution: (): Promise<void> => ipcRenderer.invoke(IPC.CONTINUE_EXECUTION),
  stepOver: (): Promise<void> => ipcRenderer.invoke(IPC.STEP_OVER),
  stepIn: (): Promise<void> => ipcRenderer.invoke(IPC.STEP_IN),
  stepOut: (): Promise<void> => ipcRenderer.invoke(IPC.STEP_OUT),
  selectFrame: (frameId: number): Promise<void> => ipcRenderer.invoke(IPC.SELECT_FRAME, frameId),
  expandVariable: (variablesReference: number): Promise<VariableNode[]> =>
    ipcRenderer.invoke(IPC.EXPAND_VARIABLE, variablesReference),
  addWatch: (expression: string): Promise<void> => ipcRenderer.invoke(IPC.ADD_WATCH, expression),
  removeWatch: (id: string): Promise<void> => ipcRenderer.invoke(IPC.REMOVE_WATCH, id),
  terminate: (): Promise<void> => ipcRenderer.invoke(IPC.TERMINATE),
  restart: (): Promise<void> => ipcRenderer.invoke(IPC.RESTART),
  notifyRendererReady: (): void => ipcRenderer.send(IPC.RENDERER_READY),

  onSnapshot(cb: (snapshot: SessionSnapshot) => void): () => void {
    const listener = (_event: unknown, snapshot: SessionSnapshot): void => cb(snapshot);
    ipcRenderer.on(IPC.SNAPSHOT, listener);
    return () => ipcRenderer.removeListener(IPC.SNAPSHOT, listener);
  },
  onOutput(cb: (entry: OutputEntry) => void): () => void {
    const listener = (_event: unknown, entry: OutputEntry): void => cb(entry);
    ipcRenderer.on(IPC.OUTPUT, listener);
    return () => ipcRenderer.removeListener(IPC.OUTPUT, listener);
  },
  onDapLog(cb: (entry: DapLogEntry) => void): () => void {
    const listener = (_event: unknown, entry: DapLogEntry): void => cb(entry);
    ipcRenderer.on(IPC.DAP_LOG, listener);
    return () => ipcRenderer.removeListener(IPC.DAP_LOG, listener);
  }
};

contextBridge.exposeInMainWorld('dbg', api);

export type DbgApi = typeof api;
