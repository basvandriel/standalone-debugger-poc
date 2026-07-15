import { create } from 'zustand';
import type { DapLogEntry, OutputEntry, SessionSnapshot } from '@shared/types';

const MAX_LOG_ENTRIES = 500;

interface DbgStore {
  snapshot?: SessionSnapshot;
  output: OutputEntry[];
  dapLog: DapLogEntry[];
  setSnapshot: (snapshot: SessionSnapshot) => void;
  appendOutput: (entry: OutputEntry) => void;
  appendDapLog: (entry: DapLogEntry) => void;
}

export const useDbgStore = create<DbgStore>((set) => ({
  snapshot: undefined,
  output: [],
  dapLog: [],
  setSnapshot: (snapshot) => set({ snapshot }),
  appendOutput: (entry) => set((state) => ({ output: [...state.output, entry].slice(-MAX_LOG_ENTRIES) })),
  appendDapLog: (entry) => set((state) => ({ dapLog: [...state.dapLog, entry].slice(-MAX_LOG_ENTRIES) }))
}));
