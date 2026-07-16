// "unused" React import is required: tsx's automatic JSX runtime silently
// breaks useEffect for components imported from other files without it.
import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import type { DapLogEntry, OutputCategory, OutputEntry } from '../../shared/types.js';
import { useUiStore } from '../../shared/ui/useUiStore.js';
import { COLORS } from '../theme.js';
import { computeWindowStart } from '../lib/visibleWindow.js';

interface OutputConsoleProps {
  output: OutputEntry[];
  dapLog: DapLogEntry[];
  contentHeight: number;
}

const CATEGORY_COLOR: Record<OutputCategory, string> = {
  stdout: COLORS.fg,
  stderr: COLORS.error,
  console: COLORS.fgDim
};

export function OutputConsole({ output, dapLog, contentHeight }: OutputConsoleProps) {
  const focusedPanel = useUiStore((s) => s.focusedPanel);
  const outputTab = useUiStore((s) => s.outputTab);
  const isFocused = focusedPanel === 'console';

  const lines = outputTab === 'program' ? output : dapLog;

  // Always follows the tail -- unlike the DOM console there's no scroll
  // gesture to "read history" with in a terminal without a scrollback UI of
  // our own, so this always shows the most recent lines (like `tail -f`).
  const [windowStart, setWindowStart] = useState(0);
  useEffect(() => {
    setWindowStart((prev) => computeWindowStart(lines.length, lines.length - 1, contentHeight, prev));
  }, [lines.length, contentHeight]);

  const visible = lines.slice(windowStart, windowStart + contentHeight);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={isFocused ? COLORS.accent : COLORS.border}
      flexShrink={0}
      width="100%"
    >
      <Box paddingX={1} height={1} overflow="hidden">
        <Text color={outputTab === 'program' ? COLORS.accent : COLORS.fgDim} bold={outputTab === 'program'} wrap="truncate-end">
          program output
        </Text>
        <Text color={COLORS.fgDim} wrap="truncate-end">
          {'  '}
        </Text>
        <Text color={outputTab === 'dap' ? COLORS.accent : COLORS.fgDim} bold={outputTab === 'dap'} wrap="truncate-end">
          dap log
        </Text>
        <Text color={COLORS.fgDim} wrap="truncate-end">
          {' (h/l to switch)'}
        </Text>
      </Box>
      <Box flexDirection="column" height={contentHeight} overflow="hidden">
        {outputTab === 'program'
          ? (visible as OutputEntry[]).map((entry, i) => (
              <Text key={windowStart + i} color={CATEGORY_COLOR[entry.category]} wrap="truncate-end">
                {entry.text}
              </Text>
            ))
          : (visible as DapLogEntry[]).map((entry, i) => (
              <Text key={windowStart + i} color={COLORS.fgDim} wrap="truncate-end">
                {entry.direction === 'outgoing' ? '->' : '<-'} {JSON.stringify(entry.payload)}
              </Text>
            ))}
      </Box>
    </Box>
  );
}
