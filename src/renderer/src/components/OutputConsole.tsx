import type { DapLogEntry, OutputEntry } from '@shared/types';
import { useUiStore } from '../store/useUiStore';

interface OutputConsoleProps {
  output: OutputEntry[];
  dapLog: DapLogEntry[];
}

export function OutputConsole({ output, dapLog }: OutputConsoleProps) {
  const focusedPanel = useUiStore((s) => s.focusedPanel);
  const outputTab = useUiStore((s) => s.outputTab);
  const setOutputTab = useUiStore((s) => s.setOutputTab);
  const isFocused = focusedPanel === 'console';

  return (
    <div className={`panel console-panel ${isFocused ? 'panel-focused' : ''}`}>
      <div className="panel-title">
        <span className={outputTab === 'program' ? 'tab-active' : 'tab'} onClick={() => setOutputTab('program')}>
          program output
        </span>{' '}
        <span className={outputTab === 'dap' ? 'tab-active' : 'tab'} onClick={() => setOutputTab('dap')}>
          dap log
        </span>{' '}
        <span className="dim">(←/→ to switch)</span>
      </div>
      <div className="panel-scroll console-scroll">
        {outputTab === 'program'
          ? output.map((entry, idx) => (
              <div key={idx} className={`console-line console-${entry.category}`}>
                {entry.text}
              </div>
            ))
          : dapLog.map((entry, idx) => (
              <div key={idx} className="console-line dap-log-line">
                {entry.direction === 'outgoing' ? '->' : '<-'} {JSON.stringify(entry.payload)}
              </div>
            ))}
      </div>
    </div>
  );
}
