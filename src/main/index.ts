import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseCliOptions } from "./cli.js";
import { registerIpcHandlers } from "./ipc.js";
import { DebugSession } from "../engine/session/DebugSession.js";
import { getAdapter, adapterById } from "../engine/adapters/index.js";
import { IPC } from "../shared/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const cliOptions = parseCliOptions(process.argv.slice(2));

if (!cliOptions) {
  app.exit(1);
} else {
  void bootstrap(cliOptions);
}

async function bootstrap(
  options: NonNullable<ReturnType<typeof parseCliOptions>>,
): Promise<void> {
  const adapter = getAdapter(options.adapter);
  if (!adapter) {
    console.error(
      `dbg: unsupported adapter "${options.adapter}" (supported adapters: ${Object.keys(adapterById).join(", ")})`,
    );
    app.exit(1);
    return;
  }

  if (options.mode === "run") {
    try {
      await access(options.program!);
    } catch {
      console.error(`dbg: program binary does not exist: ${options.program}`);
      app.exit(1);
      return;
    }
  }

  await app.whenReady();

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const rendererUrl = process.env["ELECTRON_RENDERER_URL"];
  if (rendererUrl) {
    await mainWindow.loadURL(rendererUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription) => {
      console.error(
        `dbg: renderer failed to load: ${errorDescription} (${errorCode})`,
      );
    },
  );
  mainWindow.webContents.on("console-message", (_event, level, message) => {
    if (level >= 2) console.error(`dbg: renderer console: ${message}`);
  });

  const session = new DebugSession(
    options.mode === "run"
      ? {
          adapterId: options.adapter,
          programPath: options.program!,
          sourcePath: options.source,
          cwd: options.cwd,
        }
      : {
          adapterId: options.adapter,
          sourcePath: options.source,
          cwd: options.cwd,
          attach:
            options.attachPid !== undefined
              ? { pid: options.attachPid }
              : { name: options.attachName! },
        },
    adapter,
  );

  registerIpcHandlers(mainWindow, session);

  ipcMain.once(IPC.RENDERER_READY, () => {
    void session.start();
  });

  app.on("window-all-closed", () => {
    void session.terminate().finally(() => app.quit());
  });
}
