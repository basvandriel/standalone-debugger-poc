// "unused" React import is required: tsx's automatic JSX runtime silently
// breaks useEffect for components imported from other files without it.
import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useUiStore } from '../../shared/ui/useUiStore.js';
import { fuzzyFilter } from '../../shared/ui/fuzzyMatch.js';
import { COLORS } from '../theme.js';

const MAX_VISIBLE = 8;

/**
 * Fuzzy jump-to-file overlay -- the candidate list is `knownSourceFiles`
 * (files execution has visited, files with breakpoints, plus a one-time
 * directory scan seeded at session start), not a project-wide index, so
 * there's no project-root config to set up first.
 */
export function FileSwitcher() {
  const open = useUiStore((s) => s.fileSwitcherOpen);
  const query = useUiStore((s) => s.fileSwitcherQuery);
  const setQuery = useUiStore((s) => s.setFileSwitcherQuery);
  const close = useUiStore((s) => s.closeFileSwitcher);
  const knownSourceFiles = useUiStore((s) => s.knownSourceFiles);
  const setActiveSourcePath = useUiStore((s) => s.setActiveSourcePath);

  const [selected, setSelected] = useState(0);
  const matches = fuzzyFilter(knownSourceFiles, query, MAX_VISIBLE);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useInput(
    (input, key) => {
      // Reads live state via getState() rather than the render-captured
      // `query` closure, same reasoning as CommandBar: rapid keystrokes can
      // arrive faster than React commits the previous update.
      const current = useUiStore.getState().fileSwitcherQuery;
      if (key.escape) {
        close();
        return;
      }
      if (key.return) {
        const target = matches[selected];
        if (target) setActiveSourcePath(target);
        close();
        return;
      }
      if (key.downArrow) {
        setSelected((s) => Math.min(Math.max(0, matches.length - 1), s + 1));
        return;
      }
      if (key.upArrow) {
        setSelected((s) => Math.max(0, s - 1));
        return;
      }
      if (key.backspace || key.delete) {
        setQuery(current.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setQuery(current + input);
      }
    },
    { isActive: open },
  );

  if (!open) return null;

  return (
    <Box flexDirection="column" flexShrink={0} borderStyle="round" borderColor={COLORS.accent} paddingX={1}>
      <Box gap={1}>
        <Box backgroundColor={COLORS.accentDim} paddingX={1}>
          <Text color={COLORS.accent} bold>
            FILE
          </Text>
        </Box>
        <Text color={COLORS.fg}>{query}</Text>
        <Text color={COLORS.fgDim}>{query ? '' : 'fuzzy find a file...'}</Text>
      </Box>
      {matches.length === 0 ? (
        <Text color={COLORS.fgDim}>(no matches)</Text>
      ) : (
        matches.map((m, i) => (
          <Text key={m} color={i === selected ? COLORS.accent : COLORS.fgDim} wrap="truncate-end">
            {i === selected ? '> ' : '  '}
            {m}
          </Text>
        ))
      )}
    </Box>
  );
}
