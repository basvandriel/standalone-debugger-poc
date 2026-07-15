import { useEffect, useRef } from 'react';
import type { SessionSnapshot } from '@shared/types';
import { useUiStore } from '../store/useUiStore';
import { flattenScopes } from '../lib/flattenVariables';

/**
 * Single global keydown listener implementing a flat dispatch table: global
 * action keys (VS Code's debug bindings: F5/Shift+F5/F9/F10/F11/Shift+F11)
 * work regardless of focus; panel-scoped keys (arrows, Enter/Right/Left,
 * Delete) only act on whichever panel currently has keyboard focus.
 * Registered once on mount (not re-bound on every store/snapshot change) --
 * reads live state via useUiStore.getState() and a snapshot ref instead.
 */
export function useKeybindings(snapshot: SessionSnapshot | undefined): void {
  const snapshotRef = useRef(snapshot);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const ui = useUiStore.getState();
      const snap = snapshotRef.current;

      if (ui.commandBarOpen) return; // CommandBar's own input owns typing/Enter/Escape.

      const activeElement = document.activeElement;
      const isTextInput = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;
      if (isTextInput) return;

      if (!snap) return;

      // Global VS Code-style debug actions -- work regardless of focused panel.
      switch (event.key) {
        case ':':
          event.preventDefault();
          ui.openCommandBar();
          return;
        case 'Tab':
          event.preventDefault();
          ui.cycleFocus(event.shiftKey ? -1 : 1);
          return;
        case 'F9':
          event.preventDefault();
          void window.dbg.toggleBreakpoint(snap.sourcePath, ui.cursorLine);
          return;
        case 'F10':
          if (snap.phase === 'stopped') {
            event.preventDefault();
            void window.dbg.stepOver();
          }
          return;
        case 'F11':
          if (snap.phase === 'stopped') {
            event.preventDefault();
            if (event.shiftKey) void window.dbg.stepOut();
            else void window.dbg.stepIn();
          }
          return;
        case 'F5':
          event.preventDefault();
          if (event.shiftKey) {
            window.close();
          } else if (snap.phase === 'configuring') {
            void window.dbg.beginExecution();
          } else if (snap.phase === 'stopped') {
            void window.dbg.continueExecution();
          }
          return;
      }

      // Panel-scoped navigation -- Up/Down move a selection, Left/Right and
      // Enter follow VS Code's tree-view expand/collapse convention.
      if (ui.focusedPanel === 'source') {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          ui.setCursorLine(Math.min(ui.cursorLine + 1, Math.max(1, ui.sourceLines.length)));
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          ui.setCursorLine(ui.cursorLine - 1);
        }
        return;
      }

      if (ui.focusedPanel === 'stack') {
        const idx = snap.stack.findIndex((f) => f.id === snap.selectedFrameId);
        if (event.key === 'ArrowDown' && snap.stack.length > 0) {
          event.preventDefault();
          const next = snap.stack[Math.min(snap.stack.length - 1, (idx === -1 ? 0 : idx) + 1)];
          if (next) void window.dbg.selectFrame(next.id);
        } else if (event.key === 'ArrowUp' && snap.stack.length > 0) {
          event.preventDefault();
          const next = snap.stack[Math.max(0, (idx === -1 ? 0 : idx) - 1)];
          if (next) void window.dbg.selectFrame(next.id);
        }
        return;
      }

      if (ui.focusedPanel === 'variables') {
        const rows = flattenScopes(snap.scopes, snap.variablesByRef, ui.expandedRefs);
        const row = rows[ui.selectedVariableIndex];
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          ui.setSelectedVariableIndex(Math.min(rows.length - 1, ui.selectedVariableIndex + 1));
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          ui.setSelectedVariableIndex(Math.max(0, ui.selectedVariableIndex - 1));
        } else if (event.key === 'Enter') {
          event.preventDefault();
          if (row?.expandable) {
            if (!row.expanded) void window.dbg.expandVariable(row.variablesReference);
            ui.toggleExpandedRef(row.variablesReference);
          }
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          if (row?.expandable && !row.expanded) {
            void window.dbg.expandVariable(row.variablesReference);
            ui.toggleExpandedRef(row.variablesReference);
          }
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          if (row?.expandable && row.expanded) ui.toggleExpandedRef(row.variablesReference);
        }
        return;
      }

      if (ui.focusedPanel === 'watch') {
        if (event.key === 'ArrowDown' && snap.watches.length > 0) {
          event.preventDefault();
          ui.setSelectedWatchIndex(Math.min(snap.watches.length - 1, ui.selectedWatchIndex + 1));
        } else if (event.key === 'ArrowUp' && snap.watches.length > 0) {
          event.preventDefault();
          ui.setSelectedWatchIndex(Math.max(0, ui.selectedWatchIndex - 1));
        } else if ((event.key === 'Delete' || event.key === 'Backspace') && snap.watches.length > 0) {
          event.preventDefault();
          const watch = snap.watches[ui.selectedWatchIndex];
          if (watch) void window.dbg.removeWatch(watch.id);
        }
        return;
      }

      if (ui.focusedPanel === 'console') {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          ui.setOutputTab(ui.outputTab === 'program' ? 'dap' : 'program');
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}
