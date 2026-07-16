// "unused" React import is required: tsx's automatic JSX runtime silently
// breaks useEffect for components imported from other files without it.
import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import type { SessionSnapshot } from '../../shared/types.js';
import { useUiStore } from '../../shared/ui/useUiStore.js';
import { emptyStackMessage } from '../../shared/ui/phaseMessages.js';
import { TUI_KEYS } from '../../shared/ui/keybindings.js';
import { PanelFrame } from './PanelFrame.js';
import { COLORS } from '../theme.js';
import { computeWindowStart } from '../lib/visibleWindow.js';

interface CallStackPanelProps {
  snapshot: SessionSnapshot;
  contentHeight: number;
}

export function CallStackPanel({ snapshot, contentHeight }: CallStackPanelProps) {
  const focusedPanel = useUiStore((s) => s.focusedPanel);
  const isFocused = focusedPanel === 'stack';

  const selectedIndex = snapshot.stack.findIndex((f) => f.id === snapshot.selectedFrameId);
  const [windowStart, setWindowStart] = useState(0);
  useEffect(() => {
    setWindowStart((prev) => computeWindowStart(snapshot.stack.length, Math.max(0, selectedIndex), contentHeight, prev));
  }, [selectedIndex, snapshot.stack.length, contentHeight]);

  const visible = snapshot.stack.slice(windowStart, windowStart + contentHeight);

  return (
    <PanelFrame id="stack" title="call stack" focused={isFocused} contentHeight={contentHeight}>
      {snapshot.stack.length === 0 ? (
        <Text color={COLORS.fgDim}>{emptyStackMessage(snapshot.phase, TUI_KEYS.startContinue)}</Text>
      ) : (
        visible.map((frame) => {
          const isSelected = frame.id === snapshot.selectedFrameId;
          return (
            <Box
              key={frame.id}
              backgroundColor={isSelected ? COLORS.selectionBg : undefined}
              width="100%"
              overflow="hidden"
            >
              <Text color={isSelected ? COLORS.accent : COLORS.fg} wrap="truncate-end">
                {isSelected ? '▸ ' : '  '}
                {frame.name}
              </Text>
              <Text color={COLORS.fgDim} wrap="truncate-end">
                {' '}
                @ {frame.line}
              </Text>
            </Box>
          );
        })
      )}
    </PanelFrame>
  );
}
