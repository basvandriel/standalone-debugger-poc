// "unused" React import is required: tsx's automatic JSX runtime silently
// breaks useEffect for components imported from other files without it.
import React from 'react';
import { Box, useWindowSize } from 'ink';
import type { DapLogEntry, OutputEntry, SessionSnapshot } from '../../shared/types.js';
import { useUiStore } from '../../shared/ui/useUiStore.js';
import { StatusBar } from './StatusBar.js';
import { SourcePanel } from './SourcePanel.js';
import { CallStackPanel } from './CallStackPanel.js';
import { VariablesPanel } from './VariablesPanel.js';
import { WatchPanel } from './WatchPanel.js';
import { OutputConsole } from './OutputConsole.js';
import { CommandBar } from './CommandBar.js';
import { computeLayoutBudget } from '../lib/layoutBudget.js';
import type { HighlightToken } from '../lib/highlightSourceTokens.js';
import type { DebugSession } from '../../engine/session/DebugSession.js';

interface LayoutProps {
  snapshot: SessionSnapshot;
  output: OutputEntry[];
  dapLog: DapLogEntry[];
  highlightedLines: HighlightToken[][] | undefined;
  session: DebugSession;
  exit: () => void;
}

export function Layout({ snapshot, output, dapLog, highlightedLines, session, exit }: LayoutProps) {
  const { columns, rows } = useWindowSize();
  const commandBarOpen = useUiStore((s) => s.commandBarOpen);
  const collapsedPanels = useUiStore((s) => s.collapsedPanels);

  const budget = computeLayoutBudget(rows || 40, commandBarOpen, collapsedPanels);

  return (
    <Box flexDirection="column" width={columns || 100} paddingX={1}>
      <StatusBar snapshot={snapshot} />
      <Box marginTop={1}>
        <Box flexGrow={3} flexBasis={0} marginRight={1}>
          <SourcePanel snapshot={snapshot} highlightedLines={highlightedLines} contentHeight={budget.sourceContentRows} />
        </Box>
        <Box flexDirection="column" flexGrow={2} flexBasis={0}>
          <CallStackPanel snapshot={snapshot} contentHeight={budget.sideColumns.stack} />
          <VariablesPanel snapshot={snapshot} contentHeight={budget.sideColumns.variables} />
          <WatchPanel snapshot={snapshot} contentHeight={budget.sideColumns.watch} />
        </Box>
      </Box>
      <Box marginTop={1}>
        <OutputConsole output={output} dapLog={dapLog} contentHeight={budget.consoleContentRows} />
      </Box>
      <CommandBar sourcePath={snapshot.sourcePath} session={session} exit={exit} />
    </Box>
  );
}
