import { useEffect, useRef } from 'react';
import { useUiStore } from '../store/useUiStore';

interface CommandBarProps {
  sourcePath: string;
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
    } else if (cmd === 'bp' && arg) {
      const line = Number(arg);
      if (Number.isFinite(line) && line > 0) window.dbg.toggleBreakpoint(sourcePath, line);
    } else if (cmd === 'quit' || cmd === 'q') {
      window.close();
    }
  }

  return (
    <div className="flex flex-none items-center border-t border-accent bg-panel-header px-2 py-1">
      <span className="mr-1 text-accent">:</span>
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
  );
}
