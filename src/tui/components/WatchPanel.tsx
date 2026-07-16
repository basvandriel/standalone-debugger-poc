// "unused" React import is required: tsx's automatic JSX runtime silently
// breaks useEffect for components imported from other files without it.
import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import type { SessionSnapshot } from '../../shared/types.js';
import { useUiStore } from '../../shared/ui/useUiStore.js';
import { PanelFrame } from './PanelFrame.js';
import { COLORS } from '../theme.js';
import { computeWindowStart } from '../lib/visibleWindow.js';

interface WatchPanelProps {
  snapshot: SessionSnapshot;
  contentHeight: number;
}

export function WatchPanel({ snapshot, contentHeight }: WatchPanelProps) {
  const focusedPanel = useUiStore((s) => s.focusedPanel);
  const selectedIndex = useUiStore((s) => s.selectedWatchIndex);
  const isFocused = focusedPanel === 'watch';

  const [windowStart, setWindowStart] = useState(0);
  useEffect(() => {
    setWindowStart((prev) => computeWindowStart(snapshot.watches.length, selectedIndex, contentHeight, prev));
  }, [selectedIndex, snapshot.watches.length, contentHeight]);

  const visible = snapshot.watches.slice(windowStart, windowStart + contentHeight);

  return (
    <PanelFrame id="watch" title="watches" focused={isFocused} contentHeight={contentHeight}>
      {snapshot.watches.length === 0 ? (
        <Text color={COLORS.fgDim}>(none -- : then :watch &lt;expr&gt;)</Text>
      ) : (
        visible.map((watch, i) => {
          const idx = windowStart + i;
          const isSelected = isFocused && idx === selectedIndex;
          return (
            <Box
              key={watch.id}
              backgroundColor={isSelected ? COLORS.selectionBg : undefined}
              width="100%"
              overflow="hidden"
            >
              <Text color={COLORS.fg} wrap="truncate-end">
                {watch.expression}
              </Text>
              <Text color={COLORS.fgDim} wrap="truncate-end">
                {' = '}
              </Text>
              {watch.error ? (
                <Text color={COLORS.error} wrap="truncate-end">
                  {'<'}
                  {watch.error}
                  {'>'}
                </Text>
              ) : (
                <Text color={COLORS.warn} wrap="truncate-end">
                  {watch.value ?? ''}
                </Text>
              )}
            </Box>
          );
        })
      )}
    </PanelFrame>
  );
}
