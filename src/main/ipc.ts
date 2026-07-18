import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ipcMain, type BrowserWindow } from 'electron';
import { IPC } from '../shared/types.js';
import type { DebugSession } from '../engine/session/DebugSession.js';
import { listSourceFiles } from '../engine/workspace/listSourceFiles.js';

export function registerIpcHandlers(window: BrowserWindow, session: DebugSession): void {
  ipcMain.handle(IPC.GET_INITIAL_STATE, () => session.getSnapshot());
  ipcMain.handle(IPC.READ_SOURCE_FILE, (_event, filePath: string) => readFile(filePath, 'utf8'));
  // Takes a source *file* path, not a directory -- the renderer has no Node
  // `path` module to compute a dirname with, so main does it here.
  ipcMain.handle(IPC.LIST_SOURCE_FILES, (_event, sourcePath: string) =>
    listSourceFiles(path.dirname(sourcePath)).catch(() => []),
  );
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
  ipcMain.handle(IPC.RESTART, () => session.restart());

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
