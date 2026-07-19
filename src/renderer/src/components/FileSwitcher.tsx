import { useEffect, useRef, useState } from 'react';
import { useUiStore } from '@shared/ui/useUiStore';
import { fuzzyFilter } from '@shared/ui/fuzzyMatch';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState(0);

  const matches = fuzzyFilter(knownSourceFiles, query, MAX_VISIBLE);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  if (!open) return null;

  function selectAt(index: number): void {
    const target = matches[index];
    if (target) setActiveSourcePath(target);
    close();
  }

  return (
    <div className="flex-none px-2 pb-2">
      <div className="rounded-lg bg-panel-header shadow-elevated ring-1 ring-accent/50">
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="rounded-sm bg-accent-dim px-1.5 py-0.5 font-sans text-[10px] font-semibold text-accent">
            FILE
          </span>
          <input
            ref={inputRef}
            className="flex-1 border-0 bg-transparent text-fg outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                close();
              } else if (e.key === 'Enter') {
                selectAt(selected);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelected((s) => Math.min(Math.max(0, matches.length - 1), s + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelected((s) => Math.max(0, s - 1));
              }
              e.stopPropagation();
            }}
            placeholder="fuzzy find a file..."
          />
        </div>
        {matches.length > 0 && (
          <ul className="max-h-48 overflow-y-auto border-t border-border px-1 py-1 font-mono text-xs">
            {matches.map((m, i) => (
              <li
                key={m}
                className={`cursor-pointer truncate rounded-sm px-2 py-1 ${
                  i === selected ? 'bg-accent-dim text-accent' : 'text-fg-dim'
                }`}
                onClick={() => selectAt(i)}
              >
                {m}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
