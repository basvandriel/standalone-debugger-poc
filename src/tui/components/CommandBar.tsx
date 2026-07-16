// "unused" React import is required: tsx's automatic JSX runtime silently
// breaks useEffect for components imported from other files without it.
import React from 'react';
import { Box, Text, useInput } from 'ink';
import { useUiStore } from '../../shared/ui/useUiStore.js';
import { COLORS } from '../theme.js';
import type { DebugSession } from '../../engine/session/DebugSession.js';

interface CommandBarProps {
  sourcePath: string;
  session: DebugSession;
  exit: () => void;
}

export function CommandBar({ sourcePath, session, exit }: CommandBarProps) {
  const open = useUiStore((s) => s.commandBarOpen);
  const value = useUiStore((s) => s.commandBarValue);
  const setValue = useUiStore((s) => s.setCommandBarValue);
  const close = useUiStore((s) => s.closeCommandBar);

  useInput(
    (input, key) => {
      // Reads live state via getState() rather than the render-captured
      // `value` closure -- rapid successive keystrokes can arrive and be
      // handled before React re-renders/commits the previous update, so a
      // closure-based `value + input` would silently drop characters.
      const current = useUiStore.getState().commandBarValue;
      if (key.escape) {
        close();
        return;
      }
      if (key.return) {
        runCommand(current);
        close();
        return;
      }
      if (key.backspace || key.delete) {
        setValue(current.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setValue(current + input);
      }
    },
    { isActive: open }
  );

  function runCommand(raw: string): void {
    const trimmed = raw.trim();
    const [cmd, ...rest] = trimmed.split(/\s+/);
    const arg = rest.join(' ');

    if (cmd === 'watch' && arg) {
      void session.addWatch(arg);
    } else if (cmd === 'bp' && arg) {
      const line = Number(arg);
      if (Number.isFinite(line) && line > 0) void session.toggleBreakpoint(sourcePath, line);
    } else if (cmd === 'quit' || cmd === 'q') {
      void session.terminate().finally(() => exit());
    }
  }

  if (!open) return null;

  return (
    <Box flexShrink={0}>
      <Text color={COLORS.accent}>: </Text>
      <Text color={COLORS.fg}>{value}</Text>
      <Text color={COLORS.fgDim}>{value ? '' : 'watch <expr> | bp <line> | quit'}</Text>
    </Box>
  );
}
