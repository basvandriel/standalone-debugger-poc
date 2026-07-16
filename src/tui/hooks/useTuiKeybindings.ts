import { useInput } from "ink";
import type { SessionSnapshot } from "../../shared/types.js";
import { useUiStore } from "../../shared/ui/useUiStore.js";
import { flattenScopes } from "../../shared/ui/flattenVariables.js";
import { TUI_KEYS } from "../../shared/ui/keybindings.js";
import type { DebugSession } from "../../engine/session/DebugSession.js";

/**
 * Letter/vim-style bindings (b/n/s/o/c/q, j/k, h/l), matching k9s/lazygit's
 * own convention -- not the Electron app's VS Code F-key scheme. Ink's `Key`
 * type has no F-key fields at all, and Shift+F-key combos are inconsistent
 * across terminals/tmux/SSH even where F-keys work, so the two frontends
 * genuinely need different bindings rather than sharing one hook.
 */
export function useTuiKeybindings(
  session: DebugSession,
  snapshot: SessionSnapshot | undefined,
  exit: () => void,
): void {
  useInput((input, key) => {
    const ui = useUiStore.getState();

    if (ui.commandBarOpen) return; // CommandBar owns input while open.
    if (!snapshot) return;

    if (input === TUI_KEYS.commandBar) {
      ui.openCommandBar();
      return;
    }
    if (key.tab) {
      ui.cycleFocus(key.shift ? -1 : 1);
      return;
    }
    if (input === TUI_KEYS.fold) {
      ui.toggleCollapsed(ui.focusedPanel);
      return;
    }
    if (input === TUI_KEYS.toggleBreakpoint) {
      void session.toggleBreakpoint(snapshot.sourcePath, ui.cursorLine);
      return;
    }
    if (input === TUI_KEYS.stepOver) {
      if (snapshot.phase === "stopped") void session.stepOver();
      return;
    }
    if (input === TUI_KEYS.stepIn) {
      if (snapshot.phase === "stopped") void session.stepIn();
      return;
    }
    if (input === TUI_KEYS.stepOut) {
      if (snapshot.phase === "stopped") void session.stepOut();
      return;
    }
    if (input === TUI_KEYS.startContinue) {
      if (snapshot.phase === "configuring") void session.beginExecution();
      else if (snapshot.phase === "stopped") void session.continueExecution();
      else if (snapshot.phase === "terminated" || snapshot.phase === "error")
        void session.restart();
      return;
    }
    if (input === TUI_KEYS.stop) {
      void session.terminate().finally(() => exit());
      return;
    }

    // Ink does not parse terminal mouse/scroll events into named keys,
    // but terminals may still deliver raw escape sequences here:
    // - SGR mouse mode: \x1b[<Cb;Cx;CyM (wheel uses Cb 64/65 plus modifier bits)
    // - Some terminals translate wheel to plain CSI arrows: \x1b[A / \x1b[B.
    // Normalize all of these into the same delta behavior.
    let scrollDelta = 0;
    const sgrMatch = /\x1b\[<(\d+);\d+;\d+[mM]/.exec(input);
    if (sgrMatch) {
      const code = Number(sgrMatch[1]);
      const baseCode = code & 0b11;
      if (code >= 64 && code < 128) {
        if (baseCode === 0) scrollDelta = -1;
        else if (baseCode === 1) scrollDelta = 1;
      }
    } else if (input === "\x1b[A") {
      scrollDelta = -1;
    } else if (input === "\x1b[B") {
      scrollDelta = 1;
    }

    if (scrollDelta !== 0) {
      if (ui.focusedPanel === "source") {
        ui.setFocusedPanel("source");
        ui.setCursorLine(
          Math.min(
            Math.max(1, ui.cursorLine + scrollDelta),
            Math.max(1, ui.sourceLines.length),
          ),
        );
        return;
      }
      if (ui.focusedPanel === "stack") {
        const idx = snapshot.stack.findIndex(
          (f) => f.id === snapshot.selectedFrameId,
        );
        const next =
          snapshot.stack[
            Math.min(
              snapshot.stack.length - 1,
              Math.max(0, (idx === -1 ? 0 : idx) + scrollDelta),
            )
          ];
        if (next) void session.selectFrame(next.id);
        return;
      }
      if (ui.focusedPanel === "variables") {
        const maxIdx = Math.max(
          0,
          flattenScopes(
            snapshot.scopes,
            snapshot.variablesByRef,
            ui.expandedRefs,
          ).length - 1,
        );
        ui.setSelectedVariableIndex(
          Math.min(Math.max(0, ui.selectedVariableIndex + scrollDelta), maxIdx),
        );
        return;
      }
      if (ui.focusedPanel === "watch") {
        const maxIdx = Math.max(0, snapshot.watches.length - 1);
        ui.setSelectedWatchIndex(
          Math.min(Math.max(0, ui.selectedWatchIndex + scrollDelta), maxIdx),
        );
        return;
      }
    }

    const isDown =
      key.downArrow || input === TUI_KEYS.moveDown || input === "\x1b[B";
    const isUp = key.upArrow || input === TUI_KEYS.moveUp || input === "\x1b[A";
    const isRight = key.rightArrow || input === TUI_KEYS.expand;
    const isLeft = key.leftArrow || input === TUI_KEYS.collapse;

    if (ui.focusedPanel === "source") {
      if (isDown)
        ui.setCursorLine(
          Math.min(ui.cursorLine + 1, Math.max(1, ui.sourceLines.length)),
        );
      else if (isUp) ui.setCursorLine(ui.cursorLine - 1);
      return;
    }

    if (ui.focusedPanel === "stack") {
      const idx = snapshot.stack.findIndex(
        (f) => f.id === snapshot.selectedFrameId,
      );
      if (isDown && snapshot.stack.length > 0) {
        const next =
          snapshot.stack[
            Math.min(snapshot.stack.length - 1, (idx === -1 ? 0 : idx) + 1)
          ];
        if (next) void session.selectFrame(next.id);
      } else if (isUp && snapshot.stack.length > 0) {
        const next = snapshot.stack[Math.max(0, (idx === -1 ? 0 : idx) - 1)];
        if (next) void session.selectFrame(next.id);
      }
      return;
    }

    if (ui.focusedPanel === "variables") {
      const rows = flattenScopes(
        snapshot.scopes,
        snapshot.variablesByRef,
        ui.expandedRefs,
      );
      const row = rows[ui.selectedVariableIndex];
      if (isDown) {
        ui.setSelectedVariableIndex(
          Math.min(rows.length - 1, ui.selectedVariableIndex + 1),
        );
      } else if (isUp) {
        ui.setSelectedVariableIndex(Math.max(0, ui.selectedVariableIndex - 1));
      } else if (key.return) {
        if (row?.expandable) {
          if (!row.expanded)
            void session.expandVariable(row.variablesReference);
          ui.toggleExpandedRef(row.variablesReference);
        }
      } else if (isRight) {
        if (row?.expandable && !row.expanded) {
          void session.expandVariable(row.variablesReference);
          ui.toggleExpandedRef(row.variablesReference);
        }
      } else if (isLeft) {
        if (row?.expandable && row.expanded)
          ui.toggleExpandedRef(row.variablesReference);
      }
      return;
    }

    if (ui.focusedPanel === "watch") {
      if (isDown && snapshot.watches.length > 0) {
        ui.setSelectedWatchIndex(
          Math.min(snapshot.watches.length - 1, ui.selectedWatchIndex + 1),
        );
      } else if (isUp && snapshot.watches.length > 0) {
        ui.setSelectedWatchIndex(Math.max(0, ui.selectedWatchIndex - 1));
      } else if (
        (key.delete || key.backspace || input === TUI_KEYS.removeWatch) &&
        snapshot.watches.length > 0
      ) {
        const watch = snapshot.watches[ui.selectedWatchIndex];
        if (watch) void session.removeWatch(watch.id);
      }
      return;
    }

    if (ui.focusedPanel === "console") {
      if (isLeft || isRight)
        ui.setOutputTab(ui.outputTab === "program" ? "dap" : "program");
    }
  });
}
