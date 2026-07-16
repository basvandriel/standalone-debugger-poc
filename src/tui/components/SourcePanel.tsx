// "unused" React import is required: tsx's automatic JSX runtime silently
// breaks useEffect for components imported from other files without it.
import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import type { SessionSnapshot } from '../../shared/types.js';
import { useUiStore } from '../../shared/ui/useUiStore.js';
import { PanelFrame } from './PanelFrame.js';
import { COLORS } from '../theme.js';
import { computeWindowStart } from '../lib/visibleWindow.js';
import type { HighlightToken } from '../lib/highlightSourceTokens.js';

interface SourcePanelProps {
  snapshot: SessionSnapshot;
  highlightedLines: HighlightToken[][] | undefined;
  contentHeight: number;
}

export function SourcePanel({ snapshot, highlightedLines, contentHeight }: SourcePanelProps) {
  const sourceLines = useUiStore((s) => s.sourceLines);
  const cursorLine = useUiStore((s) => s.cursorLine);
  const focusedPanel = useUiStore((s) => s.focusedPanel);
  const isFocused = focusedPanel === 'source';

  const breakpoints = snapshot.breakpoints[snapshot.sourcePath] ?? [];
  const breakpointByLine = new Map(breakpoints.map((b) => [b.line, b]));
  const currentFrame = snapshot.stack.find((f) => f.id === snapshot.selectedFrameId);
  const currentLine = currentFrame?.sourcePath === snapshot.sourcePath ? currentFrame.line : undefined;
  const activeLine = currentLine ?? (isFocused ? cursorLine : undefined);

  const [windowStart, setWindowStart] = useState(0);
  useEffect(() => {
    setWindowStart((prev) => computeWindowStart(sourceLines.length, (activeLine ?? 1) - 1, contentHeight, prev));
  }, [activeLine, sourceLines.length, contentHeight]);

  const visible = sourceLines.slice(windowStart, windowStart + contentHeight);

  return (
    <PanelFrame
      id="source"
      title={snapshot.sourcePath.split('/').pop() ?? snapshot.sourcePath}
      focused={isFocused}
      contentHeight={contentHeight}
    >
      {sourceLines.length === 0 ? (
        <Text color={COLORS.fgDim}>(no source loaded)</Text>
      ) : (
        visible.map((text, i) => {
          const idx = windowStart + i;
          const line = idx + 1;
          const bp = breakpointByLine.get(line);
          const isCurrent = line === currentLine;
          const isCursor = isFocused && line === cursorLine;
          const tokens = highlightedLines?.[idx];
          return (
            <Box key={line} backgroundColor={isCurrent ? COLORS.accentDim : undefined} width="100%" overflow="hidden">
              <Text color={COLORS.error} wrap="truncate-end">
                {bp ? (bp.verified ? '●' : '○') : ' '}
              </Text>
              <Text color={isCursor ? COLORS.accent : COLORS.fgDim} wrap="truncate-end">
                {String(line).padStart(4, ' ')}{' '}
              </Text>
              {tokens ? (
                tokens.map((token, tokenIdx) => (
                  <Text key={tokenIdx} color={token.color} wrap="truncate-end">
                    {token.content}
                  </Text>
                ))
              ) : (
                <Text color={COLORS.fg} wrap="truncate-end">
                  {text}
                </Text>
              )}
            </Box>
          );
        })
      )}
    </PanelFrame>
  );
}
