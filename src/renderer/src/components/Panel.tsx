import type { ReactNode, Ref } from 'react';
import { useUiStore, type FocusedPanel } from '@shared/ui/useUiStore';
import { ChevronDownIcon, ChevronRightIcon } from './icons';

interface PanelProps {
  id: FocusedPanel;
  title: ReactNode;
  focused: boolean;
  bodyClassName?: string;
  bodyRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}

export function Panel({ id, title, focused, bodyClassName = 'py-1', bodyRef, children }: PanelProps) {
  const collapsed = useUiStore((s) => s.collapsedPanels.has(id));
  const toggleCollapsed = useUiStore((s) => s.toggleCollapsed);

  return (
    <div
      className={`flex min-h-0 min-w-0 ${collapsed ? 'flex-none' : 'flex-1'} flex-col overflow-hidden rounded-lg bg-panel shadow-panel ring-1 transition-shadow duration-150 ${
        focused ? 'ring-2 ring-accent' : 'ring-border-subtle'
      }`}
    >
      <div
        className="flex flex-none cursor-pointer items-center gap-1.5 truncate bg-panel-header px-2.5 py-1.5 font-sans text-[11px] font-medium tracking-wide text-fg-dim transition-colors select-none hover:text-fg"
        onClick={() => toggleCollapsed(id)}
      >
        <span className="flex-none text-fg-dim">{collapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}</span>
        <span className="truncate lowercase">{title}</span>
      </div>
      {!collapsed && (
        <div ref={bodyRef} className={`min-h-0 flex-1 overflow-auto ${bodyClassName}`}>
          {children}
        </div>
      )}
    </div>
  );
}
