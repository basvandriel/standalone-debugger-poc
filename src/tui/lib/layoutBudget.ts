import type { FocusedPanel } from '../../shared/ui/useUiStore.js';

export interface LayoutBudget {
  sourceContentRows: number;
  sideColumns: Record<'stack' | 'variables' | 'watch', number>;
  consoleContentRows: number;
}

const STATUS_BAR_ROWS = 2;
const CONSOLE_TOTAL_ROWS = 9; // includes its own 1-row title bar
const PANEL_TITLE_ROWS = 1;
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
  const commandBarRows = commandBarOpen ? 1 : 0;
  const mainRows = Math.max(0, terminalRows - STATUS_BAR_ROWS - CONSOLE_TOTAL_ROWS - commandBarRows);

  const sourceTotalRows = Math.round((mainRows * 3) / 5);
  const sideTotalRows = mainRows - sourceTotalRows;
  const sourceContentRows = Math.max(MIN_CONTENT_ROWS, sourceTotalRows - PANEL_TITLE_ROWS);

  const sidePanels: Array<'stack' | 'variables' | 'watch'> = ['stack', 'variables', 'watch'];
  const expandedCount = sidePanels.filter((p) => !collapsedPanels.has(p)).length;
  const collapsedRows = sidePanels.filter((p) => collapsedPanels.has(p)).length * PANEL_TITLE_ROWS;
  const availableForExpanded = Math.max(0, sideTotalRows - collapsedRows);
  const perExpandedTotal = expandedCount > 0 ? Math.floor(availableForExpanded / expandedCount) : 0;

  const sideColumns = {} as Record<'stack' | 'variables' | 'watch', number>;
  for (const panel of sidePanels) {
    if (collapsedPanels.has(panel)) {
      sideColumns[panel] = 0;
    } else {
      sideColumns[panel] = Math.max(MIN_CONTENT_ROWS, perExpandedTotal - PANEL_TITLE_ROWS);
    }
  }

  return {
    sourceContentRows,
    sideColumns,
    consoleContentRows: Math.max(MIN_CONTENT_ROWS, CONSOLE_TOTAL_ROWS - PANEL_TITLE_ROWS)
  };
}
