import type { ReactNode, Ref } from 'react';
import { useUiStore, type FocusedPanel } from '@shared/ui/useUiStore';

interface PanelProps {
  id: FocusedPanel;
  title: ReactNode;
  focused: boolean;
  bottomBorder?: boolean;
  bodyClassName?: string;
  bodyRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}

export function Panel({ id, title, focused, bottomBorder = true, bodyClassName = 'py-0.5', bodyRef, children }: PanelProps) {
  const collapsed = useUiStore((s) => s.collapsedPanels.has(id));
  const toggleCollapsed = useUiStore((s) => s.toggleCollapsed);

  return (
    <div
      className={`flex min-h-0 min-w-0 ${collapsed ? 'flex-none' : 'flex-1'} flex-col bg-panel ${
        bottomBorder ? 'border-b border-border' : ''
      } ${focused ? 'outline-1 -outline-offset-1 outline-accent' : ''}`}
    >
      <div
        className="flex flex-none cursor-pointer items-center gap-1 truncate border-b border-border bg-panel-header px-2 py-0.75 text-[11px] tracking-wide text-fg-dim lowercase select-none"
        onClick={() => toggleCollapsed(id)}
      >
        <span className="w-2.5 flex-none">{collapsed ? '▸' : '▾'}</span>
        <span className="truncate">{title}</span>
      </div>
      {!collapsed && (
        <div ref={bodyRef} className={`min-h-0 flex-1 overflow-auto ${bodyClassName}`}>
          {children}
        </div>
      )}
    </div>
  );
}
