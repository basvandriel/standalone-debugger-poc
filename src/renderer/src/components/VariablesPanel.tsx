import { useMemo } from 'react';
import type { SessionSnapshot } from '@shared/types';
import { useUiStore } from '../store/useUiStore';
import { flattenScopes } from '../lib/flattenVariables';

interface VariablesPanelProps {
  snapshot: SessionSnapshot;
}

export function VariablesPanel({ snapshot }: VariablesPanelProps) {
  const focusedPanel = useUiStore((s) => s.focusedPanel);
  const selectedIndex = useUiStore((s) => s.selectedVariableIndex);
  const expandedRefs = useUiStore((s) => s.expandedRefs);
  const isFocused = focusedPanel === 'variables';

  const rows = useMemo(
    () => flattenScopes(snapshot.scopes, snapshot.variablesByRef, expandedRefs),
    [snapshot.scopes, snapshot.variablesByRef, expandedRefs]
  );

  return (
    <div className={`panel variables-panel ${isFocused ? 'panel-focused' : ''}`}>
      <div className="panel-title">variables</div>
      <div className="panel-scroll">
        {rows.length === 0 ? (
          <div className="dim">(not stopped)</div>
        ) : (
          rows.map((row, idx) => (
            <div
              key={row.key}
              className={`list-row ${isFocused && idx === selectedIndex ? 'list-row-selected' : ''} ${row.isScopeHeader ? 'variable-scope-header' : ''}`}
              style={{ paddingLeft: 8 + row.depth * 14 }}
              onClick={() => row.expandable && window.dbg.expandVariable(row.variablesReference)}
            >
              {row.isScopeHeader ? (
                <strong>{row.name}</strong>
              ) : (
                <>
                  <span className="variable-toggle">{row.expandable ? (row.expanded ? '▾' : '▸') : ' '}</span>
                  <span className="variable-name">{row.name}</span>
                  <span className="dim"> = </span>
                  <span className="variable-value">{row.value}</span>
                  {row.type && <span className="dim"> ({row.type})</span>}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
