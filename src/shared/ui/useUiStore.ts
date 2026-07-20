import { create } from 'zustand';

export type FocusedPanel = 'source' | 'stack' | 'variables' | 'watch' | 'console';
export type OutputTab = 'program' | 'dap';

const PANEL_ORDER: FocusedPanel[] = ['source', 'stack', 'variables', 'watch', 'console'];

interface UiStore {
  focusedPanel: FocusedPanel;
  cycleFocus: (direction: 1 | -1) => void;
  setFocusedPanel: (panel: FocusedPanel) => void;

  cursorLine: number;
  setCursorLine: (line: number) => void;

  sourceLines: string[];
  setSourceLines: (lines: string[]) => void;

  /** Which file is currently on screen -- decoupled from the session's
   * initial --source hint so execution/the file switcher can change it. */
  activeSourcePath?: string;
  setActiveSourcePath: (path: string) => void;

  /** Every file execution has visited, had a breakpoint set in, or that was
   * found by the initial directory scan -- grows monotonically, feeds the
   * fuzzy file switcher. */
  knownSourceFiles: string[];
  addKnownSourceFiles: (paths: string[]) => void;

  fileSwitcherOpen: boolean;
  fileSwitcherQuery: string;
  openFileSwitcher: () => void;
  closeFileSwitcher: () => void;
  setFileSwitcherQuery: (query: string) => void;

  selectedVariableIndex: number;
  setSelectedVariableIndex: (index: number) => void;
  expandedRefs: Set<number>;
  toggleExpandedRef: (ref: number) => void;
  resetVariableExpansion: () => void;

  selectedWatchIndex: number;
  setSelectedWatchIndex: (index: number) => void;

  outputTab: OutputTab;
  setOutputTab: (tab: OutputTab) => void;

  commandBarOpen: boolean;
  commandBarValue: string;
  openCommandBar: () => void;
  closeCommandBar: () => void;
  setCommandBarValue: (value: string) => void;

  collapsedPanels: Set<FocusedPanel>;
  toggleCollapsed: (panel: FocusedPanel) => void;

  autoRestart: boolean;
  toggleAutoRestart: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
  focusedPanel: 'source',
  cycleFocus: (direction) =>
    set((state) => {
      const currentIndex = PANEL_ORDER.indexOf(state.focusedPanel);
      const nextIndex = (currentIndex + direction + PANEL_ORDER.length) % PANEL_ORDER.length;
      return { focusedPanel: PANEL_ORDER[nextIndex] };
    }),
  setFocusedPanel: (panel) => set({ focusedPanel: panel }),

  cursorLine: 1,
  setCursorLine: (line) => set({ cursorLine: Math.max(1, line) }),

  sourceLines: [],
  setSourceLines: (lines) => set({ sourceLines: lines }),

  activeSourcePath: undefined,
  setActiveSourcePath: (path) => set({ activeSourcePath: path }),

  knownSourceFiles: [],
  addKnownSourceFiles: (paths) =>
    set((state) => {
      if (paths.length === 0) return state;
      const next = new Set(state.knownSourceFiles);
      for (const p of paths) next.add(p);
      return { knownSourceFiles: [...next] };
    }),

  fileSwitcherOpen: false,
  fileSwitcherQuery: '',
  openFileSwitcher: () => set({ fileSwitcherOpen: true, fileSwitcherQuery: '' }),
  closeFileSwitcher: () => set({ fileSwitcherOpen: false, fileSwitcherQuery: '' }),
  setFileSwitcherQuery: (query) => set({ fileSwitcherQuery: query }),

  selectedVariableIndex: 0,
  setSelectedVariableIndex: (index) => set({ selectedVariableIndex: Math.max(0, index) }),
  expandedRefs: new Set<number>(),
  toggleExpandedRef: (ref) =>
    set((state) => {
      const next = new Set(state.expandedRefs);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return { expandedRefs: next };
    }),
  resetVariableExpansion: () => set({ expandedRefs: new Set<number>(), selectedVariableIndex: 0 }),

  selectedWatchIndex: 0,
  setSelectedWatchIndex: (index) => set({ selectedWatchIndex: Math.max(0, index) }),

  outputTab: 'program',
  setOutputTab: (tab) => set({ outputTab: tab }),

  commandBarOpen: false,
  commandBarValue: '',
  openCommandBar: () => set({ commandBarOpen: true, commandBarValue: '' }),
  closeCommandBar: () => set({ commandBarOpen: false, commandBarValue: '' }),
  setCommandBarValue: (value) => set({ commandBarValue: value }),

  collapsedPanels: new Set<FocusedPanel>(),
  toggleCollapsed: (panel) =>
    set((state) => {
      const next = new Set(state.collapsedPanels);
      if (next.has(panel)) next.delete(panel);
      else next.add(panel);
      return { collapsedPanels: next };
    }),

  autoRestart: false,
  toggleAutoRestart: () => set((state) => ({ autoRestart: !state.autoRestart })),
}));
