import type { FocusedPanel } from '../../shared/ui/useUiStore.js';

export interface LayoutBudget {
  sourceContentRows: number;
  sideColumns: Record<'stack' | 'variables' | 'watch', number>;
  consoleContentRows: number;
}

const STATUS_BAR_ROWS = 2;
const PANEL_TITLE_ROWS = 1;
// PanelFrame/OutputConsole/CommandBar all draw a real `borderStyle` box
// around their content -- that's 2 extra rows (top+bottom border) on top of
// whatever height their children report. Yoga sizes the border as additional
// box height, not eaten from the content, so every "total rows a panel
// consumes" calculation below must include this or the sum of all panels
// silently exceeds the terminal height and the real terminal scrolls,
// breaking the fixed full-screen layout (k9s/Claude Code never scroll).
const BORDER_ROWS = 2;
const PANEL_CHROME_ROWS = PANEL_TITLE_ROWS + BORDER_ROWS;
const CONSOLE_TOTAL_ROWS = 9; // total incl. its own border + 1-row title bar
const COMMAND_BAR_ROWS = BORDER_ROWS + 1; // border + single content row, no separate title
const MIN_CONTENT_ROWS = 1;

/**
 * Computes exact row budgets for each panel up front, rather than relying on
 * Ink/Yoga to distribute space and then trying to measure the result --
 * simpler and avoids a measure-then-rerender dance for a POC. Ratios mirror
 * the Electron renderer's flex-[3]/flex-[2] source/side-column split.
 */
export function computeLayoutBudget(
  terminalRows: number,
  commandBarOpen: boolean,
  collapsedPanels: ReadonlySet<FocusedPanel>
): LayoutBudget {
  const commandBarRows = commandBarOpen ? COMMAND_BAR_ROWS : 0;
  const mainRows = Math.max(0, terminalRows - STATUS_BAR_ROWS - CONSOLE_TOTAL_ROWS - commandBarRows);

  // Source and side panels sit side-by-side (flex row), so both fill mainRows
  // vertically — the 3:2 flex ratio only governs horizontal width.
  const sourceContentRows = Math.max(MIN_CONTENT_ROWS, mainRows - PANEL_CHROME_ROWS);

  const sidePanels: Array<'stack' | 'variables' | 'watch'> = ['stack', 'variables', 'watch'];
  const expandedCount = sidePanels.filter((p) => !collapsedPanels.has(p)).length;
  // A collapsed panel still renders its border + title row, just no content.
  const collapsedRows = sidePanels.filter((p) => collapsedPanels.has(p)).length * PANEL_CHROME_ROWS;
  const availableForExpanded = Math.max(0, mainRows - collapsedRows);
  const perExpandedTotal = expandedCount > 0 ? Math.floor(availableForExpanded / expandedCount) : 0;

  const sideColumns = {} as Record<'stack' | 'variables' | 'watch', number>;
  for (const panel of sidePanels) {
    if (collapsedPanels.has(panel)) {
      sideColumns[panel] = 0;
    } else {
      sideColumns[panel] = Math.max(MIN_CONTENT_ROWS, perExpandedTotal - PANEL_CHROME_ROWS);
    }
  }

  return {
    sourceContentRows,
    sideColumns,
    consoleContentRows: Math.max(MIN_CONTENT_ROWS, CONSOLE_TOTAL_ROWS - PANEL_CHROME_ROWS)
  };
}
