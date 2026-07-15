import { readFile } from 'node:fs/promises';
import { ipcMain, type BrowserWindow } from 'electron';
import { IPC } from '../shared/types.js';
import type { DebugSession } from '../engine/session/DebugSession.js';

export function registerIpcHandlers(window: BrowserWindow, session: DebugSession): void {
  ipcMain.handle(IPC.GET_INITIAL_STATE, () => session.getSnapshot());
  ipcMain.handle(IPC.READ_SOURCE_FILE, (_event, path: string) => readFile(path, 'utf8'));
  ipcMain.handle(IPC.TOGGLE_BREAKPOINT, (_event, file: string, line: number) => session.toggleBreakpoint(file, line));
  ipcMain.handle(IPC.BEGIN_EXECUTION, () => session.beginExecution());
  ipcMain.handle(IPC.CONTINUE_EXECUTION, () => session.continueExecution());
  ipcMain.handle(IPC.STEP_OVER, () => session.stepOver());
  ipcMain.handle(IPC.STEP_IN, () => session.stepIn());
  ipcMain.handle(IPC.STEP_OUT, () => session.stepOut());
  ipcMain.handle(IPC.SELECT_FRAME, (_event, frameId: number) => session.selectFrame(frameId));
  ipcMain.handle(IPC.EXPAND_VARIABLE, (_event, variablesReference: number) =>
    session.expandVariable(variablesReference)
  );
  ipcMain.handle(IPC.ADD_WATCH, (_event, expression: string) => session.addWatch(expression));
  ipcMain.handle(IPC.REMOVE_WATCH, (_event, id: string) => session.removeWatch(id));
  ipcMain.handle(IPC.TERMINATE, () => session.terminate());

  session.onSnapshot((snapshot) => {
    if (!window.isDestroyed()) window.webContents.send(IPC.SNAPSHOT, snapshot);
  });
  session.onOutput((entry) => {
    if (!window.isDestroyed()) window.webContents.send(IPC.OUTPUT, entry);
  });
  session.onDapLog((entry) => {
    if (!window.isDestroyed()) window.webContents.send(IPC.DAP_LOG, entry);
  });
}
