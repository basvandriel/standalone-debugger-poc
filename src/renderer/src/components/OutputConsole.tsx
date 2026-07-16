import { useEffect, useRef } from 'react';
import type { DapLogEntry, OutputCategory, OutputEntry } from '@shared/types';
import { useUiStore } from '@shared/ui/useUiStore';
import { Panel } from './Panel';

interface OutputConsoleProps {
  output: OutputEntry[];
  dapLog: DapLogEntry[];
}

const CATEGORY_CLASS: Record<OutputCategory, string> = {
  stdout: 'text-fg',
  stderr: 'text-error',
  console: 'text-fg-dim'
};

const NEAR_BOTTOM_THRESHOLD_PX = 32;

export function OutputConsole({ output, dapLog }: OutputConsoleProps) {
  const focusedPanel = useUiStore((s) => s.focusedPanel);
  const outputTab = useUiStore((s) => s.outputTab);
  const setOutputTab = useUiStore((s) => s.setOutputTab);
  const isFocused = focusedPanel === 'console';

  const bodyRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const handleScroll = (): void => {
      isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD_PX;
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  // Follows new output like a terminal tail -- but only while the user
  // hasn't scrolled up to read history, so it doesn't yank the view away
  // mid-review of older log lines.
  useEffect(() => {
    const el = bodyRef.current;
    if (el && isNearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [output.length, dapLog.length, outputTab]);

  const title = (
    <>
      <span
        className={`cursor-pointer ${outputTab === 'program' ? 'font-bold text-accent' : 'text-fg-dim'}`}
        onClick={() => setOutputTab('program')}
      >
        program output
      </span>{' '}
      <span
        className={`cursor-pointer ${outputTab === 'dap' ? 'font-bold text-accent' : 'text-fg-dim'}`}
        onClick={() => setOutputTab('dap')}
      >
        dap log
      </span>{' '}
      <span className="text-fg-dim">(←/→ to switch)</span>
    </>
  );

  return (
    <Panel
      id="console"
      title={title}
      focused={isFocused}
      bottomBorder={false}
      bodyClassName="py-0.5 text-[12px]"
      bodyRef={bodyRef}
    >
      {outputTab === 'program'
        ? output.map((entry, idx) => (
            <div key={idx} className={`px-2 wrap-break-word whitespace-pre-wrap ${CATEGORY_CLASS[entry.category]}`}>
              {entry.text}
            </div>
          ))
        : dapLog.map((entry, idx) => (
            <div key={idx} className="px-2 text-[10px] wrap-break-word whitespace-pre-wrap text-fg-dim">
              {entry.direction === 'outgoing' ? '->' : '<-'} {JSON.stringify(entry.payload)}
            </div>
          ))}
    </Panel>
  );
}
