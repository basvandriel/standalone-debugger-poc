import type { DapLogEntry, OutputEntry, SessionSnapshot } from '@shared/types';
import { useUiStore } from '@shared/ui/useUiStore';
import { StatusBar } from './StatusBar';
import { SourcePanel } from './SourcePanel';
import { CallStackPanel } from './CallStackPanel';
import { VariablesPanel } from './VariablesPanel';
import { WatchPanel } from './WatchPanel';
import { OutputConsole } from './OutputConsole';
import { CommandBar } from './CommandBar';
import { FileSwitcher } from './FileSwitcher';

interface LayoutProps {
  snapshot: SessionSnapshot;
  output: OutputEntry[];
  dapLog: DapLogEntry[];
  highlightedLines: string[] | undefined;
}

export function Layout({ snapshot, output, dapLog, highlightedLines }: LayoutProps) {
  const activeSourcePath = useUiStore((s) => s.activeSourcePath);

  return (
    <div className="flex h-full flex-col bg-bg">
      <StatusBar snapshot={snapshot} />
      <div className="flex min-h-0 flex-1 gap-2 p-2">
        <div className="flex min-w-0 flex-3">
          <SourcePanel snapshot={snapshot} highlightedLines={highlightedLines} />
        </div>
        <div className="flex min-w-0 flex-2 flex-col gap-2">
          <CallStackPanel snapshot={snapshot} />
          <VariablesPanel snapshot={snapshot} />
          <WatchPanel snapshot={snapshot} />
        </div>
      </div>
      <div className="flex h-50 flex-none px-2 pb-2">
        <OutputConsole output={output} dapLog={dapLog} />
      </div>
      <FileSwitcher />
      <CommandBar sourcePath={activeSourcePath} />
    </div>
  );
}
