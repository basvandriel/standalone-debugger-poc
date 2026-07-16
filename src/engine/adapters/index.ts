import { lldbDapAdapter } from "./lldbDap.js";
import type { AdapterDefinition } from "./types.js";

export const adapters: AdapterDefinition[] = [lldbDapAdapter];
export const adapterById: Record<string, AdapterDefinition> =
  Object.fromEntries(adapters.map((adapter) => [adapter.id, adapter]));

export function getAdapter(adapterId: string): AdapterDefinition | undefined {
  return adapterById[adapterId];
}

export const DEFAULT_ADAPTER_ID = lldbDapAdapter.id;
