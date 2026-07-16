// "unused" React import is required: tsx's automatic JSX runtime silently
// breaks useEffect for components imported from other files without it.
import React from 'react';
import { Box, Text } from 'ink';
import type { SessionPhase, SessionSnapshot } from '../../shared/types.js';
import { useUiStore, type FocusedPanel } from '../../shared/ui/useUiStore.js';
import { TUI_KEYS } from '../../shared/ui/keybindings.js';
import { COLORS } from '../theme.js';
import { Spinner } from './Spinner.js';

interface StatusBarProps {
  snapshot: SessionSnapshot;
}

const K = TUI_KEYS;
const HINTS: Record<FocusedPanel, string> = {
  source: `${K.moveDown}/${K.moveUp} move  ${K.toggleBreakpoint} breakpoint  ${K.startContinue} run/continue  ${K.stepOver}/${K.stepIn}/${K.stepOut} step  ${K.stop} quit  ${K.commandBar} cmd  ${K.fold} fold`,
  stack: `${K.moveDown}/${K.moveUp} select frame  ${K.startContinue} run/continue  ${K.stepOver}/${K.stepIn}/${K.stepOut} step  ${K.stop} quit  ${K.commandBar} cmd  ${K.fold} fold`,
  variables: `${K.moveDown}/${K.moveUp} move  ${K.expand}/${K.toggleEntry} expand  ${K.collapse} collapse  ${K.stop} quit  ${K.commandBar} cmd  ${K.fold} fold`,
  watch: `${K.moveDown}/${K.moveUp} move  ${K.removeWatch} remove  ${K.stop} quit  ${K.commandBar} cmd  ${K.fold} fold`,
  console: `${K.switchTab} switch tab  ${K.stop} quit  ${K.commandBar} cmd  ${K.fold} fold`
};

const PHASE_LABEL: Record<SessionPhase, string> = {
  idle: 'idle',
  initializing: 'starting',
  configuring: 'ready',
  running: 'running',
  stopped: 'paused',
  terminated: 'exited',
  error: 'error'
};

const PHASE_COLOR: Record<SessionPhase, string> = {
  idle: COLORS.fgDim,
  initializing: COLORS.fgDim,
  configuring: COLORS.accent,
  running: COLORS.warn,
  stopped: COLORS.success,
  terminated: COLORS.fgDim,
  error: COLORS.error
};

const PHASE_BADGE_BG: Record<SessionPhase, string> = {
  idle: COLORS.panelHeader,
  initializing: COLORS.panelHeader,
  configuring: COLORS.accentDim,
  running: COLORS.warnDim,
  stopped: COLORS.successDim,
  terminated: COLORS.panelHeader,
  error: COLORS.errorDim
};

export function StatusBar({ snapshot }: StatusBarProps) {
  const focusedPanel = useUiStore((s) => s.focusedPanel);
  const currentFrame = snapshot.stack.find((f) => f.id === snapshot.selectedFrameId);
  const currentThread = snapshot.threads.find((t) => t.id === snapshot.selectedThreadId);
  const focusedLabel = focusedPanel;

  return (
    <Box flexDirection="column" flexShrink={0} width="100%">
      <Box gap={2} width="100%" overflow="hidden" paddingX={1}>
        <Box flexShrink={0} gap={1}>
          <Text color={COLORS.accent} bold>
            dbg
          </Text>
          <Text color={COLORS.fgDim}>{snapshot.adapterId}</Text>
        </Box>
        <Box flexShrink={0} paddingX={1} backgroundColor={PHASE_BADGE_BG[snapshot.phase]}>
          {snapshot.phase === 'initializing' ? (
            <Box gap={1}>
              <Spinner color={PHASE_COLOR[snapshot.phase]} />
              <Text color={PHASE_COLOR[snapshot.phase]} bold>
                {PHASE_LABEL[snapshot.phase]}
              </Text>
            </Box>
          ) : (
            <Text color={PHASE_COLOR[snapshot.phase]} bold>
              ● {PHASE_LABEL[snapshot.phase]}
            </Text>
          )}
        </Box>
        <Box flexShrink={0} paddingX={1} backgroundColor={COLORS.selectionSoft}>
          <Text color={COLORS.accent} bold>
            {focusedLabel}
          </Text>
        </Box>
        {/* Only the dynamic-length path/thread/error info shrinks -- the
            labels above must always stay fully readable. */}
        <Box flexShrink={1} overflow="hidden">
          <Text color={COLORS.fgDim} wrap="truncate-end">
            {snapshot.programPath}
          </Text>
        </Box>
        {currentThread && (
          <Box flexShrink={1} overflow="hidden">
            <Text color={COLORS.fgDim} wrap="truncate-end">
              {currentThread.name}
              {currentFrame ? ` @ ${currentFrame.name}:${currentFrame.line}` : ''}
            </Text>
          </Box>
        )}
        {snapshot.errorMessage && (
          <Box flexShrink={1} overflow="hidden">
            <Text color={COLORS.error} wrap="truncate-end">
              error: {snapshot.errorMessage}
            </Text>
          </Box>
        )}
      </Box>
      <Box paddingX={1} gap={1}>
        <Text color={COLORS.fgMuted}>•</Text>
        <Text color={COLORS.fgDim} wrap="truncate-end">
          {currentThread ? `${currentThread.name}` : 'no active thread'}
          {currentFrame ? `  →  ${currentFrame.name}:${currentFrame.line}` : ''}
        </Text>
      </Box>
      <Text color={COLORS.fgMuted} wrap="truncate-end">
        {HINTS[focusedPanel]}
      </Text>
    </Box>
  );
}
