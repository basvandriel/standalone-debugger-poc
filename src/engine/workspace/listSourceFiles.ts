import { readdir } from 'node:fs/promises';
import path from 'node:path';

export interface ListSourceFilesOptions {
  extensions?: string[];
  maxDepth?: number;
  maxFiles?: number;
}

// Covers every language this POC's only adapter (lldb-dap) debugs.
const DEFAULT_EXTENSIONS = ['.rs', '.c', '.h', '.hpp', '.cpp', '.cc', '.hh'];
const DEFAULT_MAX_DEPTH = 6;
const DEFAULT_MAX_FILES = 500;
const SKIP_DIRS = new Set(['target', 'node_modules', '.git']);

/**
 * Bounded recursive directory walk that seeds the fuzzy file switcher with
 * files execution hasn't reached yet -- deliberately not a "project root"
 * concept, just a shallow scan from wherever the initial --source lives.
 * No Electron/Ink imports, so the TUI calls this directly and Electron
 * exposes it over IPC (see IPC.LIST_SOURCE_FILES). Errors reading any one
 * directory (permissions, races) are swallowed -- a partial file list is
 * fine for a browsing aid, not worth failing session startup over.
 */
export async function listSourceFiles(
  rootDir: string,
  opts: ListSourceFilesOptions = {},
): Promise<string[]> {
  const extensions = opts.extensions ?? DEFAULT_EXTENSIONS;
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxFiles = opts.maxFiles ?? DEFAULT_MAX_FILES;

  const results: string[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (results.length >= maxFiles || depth > maxDepth) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= maxFiles) return;
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(path.join(dir, entry.name), depth + 1);
      } else if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
        results.push(path.join(dir, entry.name));
      }
    }
  }

  await walk(rootDir, 0);
  return results;
}
