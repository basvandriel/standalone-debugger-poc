import type { ScopeDescriptor, VariableNode } from '@shared/types';

export interface FlatVariableRow {
  key: string;
  depth: number;
  name: string;
  value: string;
  type?: string;
  variablesReference: number;
  expandable: boolean;
  expanded: boolean;
  isScopeHeader: boolean;
}

/**
 * Flattens scopes -> variables -> (lazily) expanded children into a single
 * list of visible rows, so both rendering and j/k keyboard navigation can
 * work off the same "what's on screen right now" shape.
 */
export function flattenScopes(
  scopes: ScopeDescriptor[],
  variablesByRef: Record<number, VariableNode[]>,
  expandedRefs: ReadonlySet<number>
): FlatVariableRow[] {
  const rows: FlatVariableRow[] = [];
  for (const scope of scopes) {
    rows.push({
      key: `scope-${scope.variablesReference}`,
      depth: 0,
      name: scope.name,
      value: '',
      variablesReference: 0,
      expandable: false,
      expanded: false,
      isScopeHeader: true
    });
    const children = variablesByRef[scope.variablesReference] ?? [];
    flattenNodes(children, variablesByRef, expandedRefs, 1, `scope-${scope.variablesReference}`, rows);
  }
  return rows;
}

function flattenNodes(
  nodes: VariableNode[],
  variablesByRef: Record<number, VariableNode[]>,
  expandedRefs: ReadonlySet<number>,
  depth: number,
  parentKey: string,
  out: FlatVariableRow[]
): void {
  nodes.forEach((node, index) => {
    // Index disambiguates siblings that share a name -- DAP debug info
    // routinely has multiple same-named entries (e.g. several `<null>`
    // fields, or overloaded/anonymous entries in low-level structures),
    // and `node.name` alone is not guaranteed unique among siblings.
    const key = `${parentKey}/${index}:${node.name}`;
    const expandable = node.variablesReference !== 0;
    const expanded = expandable && expandedRefs.has(node.variablesReference);
    out.push({
      key,
      depth,
      name: node.name,
      value: node.value,
      type: node.type,
      variablesReference: node.variablesReference,
      expandable,
      expanded,
      isScopeHeader: false
    });
    if (expanded) {
      const children = variablesByRef[node.variablesReference] ?? [];
      flattenNodes(children, variablesByRef, expandedRefs, depth + 1, key, out);
    }
  });
}
