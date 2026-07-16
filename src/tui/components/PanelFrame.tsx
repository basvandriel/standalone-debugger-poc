// "unused" React import is required: tsx's automatic JSX runtime silently
// breaks useEffect for components imported from other files without it.
import React, { type ReactNode } from 'react';
import { Box, Text } from 'ink';
import { useUiStore, type FocusedPanel } from '../../shared/ui/useUiStore.js';
import { COLORS } from '../theme.js';

interface PanelFrameProps {
  id: FocusedPanel;
  title: string;
  focused: boolean;
  contentHeight: number;
  children: ReactNode;
}

export function PanelFrame({ id, title, focused, contentHeight, children }: PanelFrameProps) {
  const collapsed = useUiStore((s) => s.collapsedPanels.has(id));

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={focused ? COLORS.accent : COLORS.borderSubtle}
      flexShrink={0}
      width="100%"
      backgroundColor={COLORS.panel}
    >
      <Box paddingX={1} height={1} overflow="hidden" backgroundColor={focused ? COLORS.accentSoft : COLORS.panelHeader}>
        <Text color={focused ? COLORS.accent : COLORS.fgDim} bold wrap="truncate-end">
          {collapsed ? '▸' : '▾'} {title}
        </Text>
        <Box flexGrow={1} />
        <Text color={focused ? COLORS.accent : COLORS.fgMuted} wrap="truncate-end">
          {focused ? 'active' : 'idle'}
        </Text>
      </Box>
      {!collapsed && (
        <Box flexDirection="column" height={contentHeight} overflow="hidden" paddingX={1} backgroundColor={COLORS.panelRaised}>
          {children}
        </Box>
      )}
    </Box>
  );
}
