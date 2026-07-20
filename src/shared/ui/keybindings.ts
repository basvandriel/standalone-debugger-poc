/**
 * Single source of truth for "what key does this logical action" per
 * frontend. The Electron app uses VS Code's F-key scheme; the TUI uses
 * k9s/lazygit-style letters (Ink's `Key` type has no F-key fields, and
 * Shift+F-key combos are unreliable across terminals/tmux/SSH) -- so the
 * two frontends genuinely need different physical keys. What they must NOT
 * do is drift independently: every handler (`useKeybindings`,
 * `useTuiKeybindings`) and every hint label (both `StatusBar` components,
 * `phaseMessages.ts`) reads from these two objects instead of hardcoding a
 * literal key string, so a key can only change in one place.
 */
export const ELECTRON_KEYS = {
  startContinue: 'F5',
  stop: '⇧F5',
  toggleBreakpoint: 'F9',
  stepOver: 'F10',
  stepIn: 'F11',
  stepOut: '⇧F11',
  commandBar: ':',
  switchFile: 'Ctrl+P',
  moveUp: '↑',
  moveDown: '↓',
  expand: '→',
  collapse: '←',
  toggleEntry: '⏎',
  removeWatch: 'Delete',
  switchTab: '←/→'
} as const;

export const TUI_KEYS = {
  startContinue: 'c',
  restart: 'r',
  autoRestart: 'R',
  stop: 'q',
  toggleBreakpoint: 'b',
  stepOver: 'n',
  stepIn: 's',
  stepOut: 'o',
  commandBar: ':',
  switchFile: 'f',
  moveUp: 'k',
  moveDown: 'j',
  expand: 'l',
  collapse: 'h',
  toggleEntry: 'enter',
  removeWatch: 'x',
  switchTab: 'h/l',
  fold: 'z'
} as const;

export type ActionKeys = typeof ELECTRON_KEYS | typeof TUI_KEYS;
