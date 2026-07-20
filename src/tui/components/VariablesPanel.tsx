// "unused" React import is required: tsx's automatic JSX runtime silently
// breaks useEffect for components imported from other files without it.
import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text } from 'ink';
import type { SessionSnapshot } from '../../shared/types.js';
import { useUiStore } from '../../shared/ui/useUiStore.js';
import { flattenScopes } from '../../shared/ui/flattenVariables.js';
import { emptyStackMessage } from '../../shared/ui/phaseMessages.js';
import { TUI_KEYS } from '../../shared/ui/keybindings.js';
import { PanelFrame } from './PanelFrame.js';
import { COLORS } from '../theme.js';
import { computeWindowStart } from '../lib/visibleWindow.js';

interface VariablesPanelProps {
  snapshot: SessionSnapshot;
  contentHeight: number;
}

export function VariablesPanel({ snapshot, contentHeight }: VariablesPanelProps) {
  const focusedPanel = useUiStore((s) => s.focusedPanel);
  const selectedIndex = useUiStore((s) => s.selectedVariableIndex);
  const expandedRefs = useUiStore((s) => s.expandedRefs);
  const isFocused = focusedPanel === 'variables';

  const rows = useMemo(
    () => flattenScopes(snapshot.scopes, snapshot.variablesByRef, expandedRefs),
    [snapshot.scopes, snapshot.variablesByRef, expandedRefs]
  );

  const [windowStart, setWindowStart] = useState(0);
  useEffect(() => {
    setWindowStart((prev) => computeWindowStart(rows.length, selectedIndex, contentHeight, prev));
  }, [selectedIndex, rows.length, contentHeight]);

  const visible = rows.slice(windowStart, windowStart + contentHeight);

  return (
    <PanelFrame id="variables" title="variables" focused={isFocused} contentHeight={contentHeight}>
      {rows.length === 0 ? (
        <Text color={COLORS.fgDim}>{emptyStackMessage(snapshot.phase, TUI_KEYS.startContinue)}</Text>
      ) : (
        visible.map((row, i) => {
          const idx = windowStart + i;
          const isSelected = isFocused && idx === selectedIndex;
          return (
            <Box
              key={row.key}
              backgroundColor={isSelected ? COLORS.selectionBg : undefined}
              paddingLeft={row.depth * 2}
              width="100%"
              overflow="hidden"
            >
              {row.isScopeHeader ? (
                <Text color={COLORS.fgDim} bold>
                  {row.name.toUpperCase()}
                </Text>
              ) : (
                <>
                  {/* Name part never shrinks — truncation only applies to value/type */}
                  <Box flexShrink={0}>
                    <Text color={COLORS.fgDim}>
                      {row.expandable ? (row.expanded ? '▾ ' : '▸ ') : '  '}
                    </Text>
                    <Text color={COLORS.fg}>{row.name}</Text>
                    <Text color={COLORS.fgDim}>{' = '}</Text>
                  </Box>
                  <Box flexGrow={1} overflow="hidden">
                    <Text color={COLORS.warn} wrap="truncate-end">
                      {row.value}
                      {row.type ? ` (${row.type})` : ''}
                    </Text>
                  </Box>
                </>
              )}
            </Box>
          );
        })
      )}
    </PanelFrame>
  );
}
