import { useEffect, useRef } from 'react';
import { useUiStore } from '@shared/ui/useUiStore';

interface CommandBarProps {
  sourcePath: string | undefined;
}

export function CommandBar({ sourcePath }: CommandBarProps) {
  const open = useUiStore((s) => s.commandBarOpen);
  const value = useUiStore((s) => s.commandBarValue);
  const setValue = useUiStore((s) => s.setCommandBarValue);
  const close = useUiStore((s) => s.closeCommandBar);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  function runCommand(raw: string): void {
    const trimmed = raw.trim();
    const [cmd, ...rest] = trimmed.split(/\s+/);
    const arg = rest.join(' ');

    if (cmd === 'watch' && arg) {
      window.dbg.addWatch(arg);
    } else if (cmd === 'bp' && arg && sourcePath) {
      const line = Number(arg);
      if (Number.isFinite(line) && line > 0) window.dbg.toggleBreakpoint(sourcePath, line);
    } else if (cmd === 'quit' || cmd === 'q') {
      window.close();
    }
  }

  return (
    <div className="flex-none px-2 pb-2">
      <div className="flex items-center gap-2 rounded-lg bg-panel-header px-3 py-2 shadow-elevated ring-1 ring-accent/50">
        <span className="rounded-sm bg-accent-dim px-1.5 py-0.5 font-sans text-[10px] font-semibold text-accent">
          CMD
        </span>
        <input
          ref={inputRef}
          className="flex-1 border-0 bg-transparent text-fg outline-none"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              close();
            } else if (e.key === 'Enter') {
              runCommand(value);
              close();
            }
            e.stopPropagation();
          }}
          placeholder="watch <expr> | bp <line> | quit"
        />
      </div>
    </div>
  );
}
