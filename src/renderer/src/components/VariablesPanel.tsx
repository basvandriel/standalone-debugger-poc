import { useEffect, useMemo, useRef } from 'react';
import type { SessionSnapshot } from '@shared/types';
import { useUiStore } from '../store/useUiStore';
import { flattenScopes } from '../lib/flattenVariables';
import { Panel } from './Panel';
import { emptyStackMessage } from '../lib/phaseMessages';

interface VariablesPanelProps {
  snapshot: SessionSnapshot;
}

export function VariablesPanel({ snapshot }: VariablesPanelProps) {
  const focusedPanel = useUiStore((s) => s.focusedPanel);
  const selectedIndex = useUiStore((s) => s.selectedVariableIndex);
  const expandedRefs = useUiStore((s) => s.expandedRefs);
  const toggleExpandedRef = useUiStore((s) => s.toggleExpandedRef);
  const isFocused = focusedPanel === 'variables';

  const rows = useMemo(
    () => flattenScopes(snapshot.scopes, snapshot.variablesByRef, expandedRefs),
    [snapshot.scopes, snapshot.variablesByRef, expandedRefs]
  );

  const selectedRowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isFocused) selectedRowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [isFocused, selectedIndex]);

  function handleRowClick(row: (typeof rows)[number]): void {
    if (!row.expandable) return;
    if (!row.expanded) void window.dbg.expandVariable(row.variablesReference);
    toggleExpandedRef(row.variablesReference);
  }

  return (
    <Panel id="variables" title="variables" focused={isFocused}>
      {rows.length === 0 ? (
        <div className="text-fg-dim">{emptyStackMessage(snapshot.phase)}</div>
      ) : (
        rows.map((row, idx) => {
          const isSelected = isFocused && idx === selectedIndex;
          return (
            <div
              key={row.key}
              ref={isSelected ? selectedRowRef : undefined}
              className={`cursor-pointer truncate px-2 py-px hover:bg-hover ${isSelected ? 'bg-selection' : ''} ${
                row.isScopeHeader ? 'mt-1 cursor-default text-accent' : ''
              }`}
              style={{ paddingLeft: 8 + row.depth * 14 }}
              onClick={() => handleRowClick(row)}
            >
              {row.isScopeHeader ? (
                <strong>{row.name}</strong>
              ) : (
                <>
                  <span className="inline-block w-3 text-fg-dim">{row.expandable ? (row.expanded ? '▾' : '▸') : ' '}</span>
                  <span className="text-fg">{row.name}</span>
                  <span className="text-fg-dim"> = </span>
                  <span className="text-warn">{row.value}</span>
                  {row.type && <span className="text-fg-dim"> ({row.type})</span>}
                </>
              )}
            </div>
          );
        })
      )}
    </Panel>
  );
}
