import type { DapLogEntry, OutputEntry, SessionSnapshot } from '@shared/types';
import { StatusBar } from './StatusBar';
import { SourcePanel } from './SourcePanel';
import { CallStackPanel } from './CallStackPanel';
import { VariablesPanel } from './VariablesPanel';
import { WatchPanel } from './WatchPanel';
import { OutputConsole } from './OutputConsole';
import { CommandBar } from './CommandBar';

interface LayoutProps {
  snapshot: SessionSnapshot;
  output: OutputEntry[];
  dapLog: DapLogEntry[];
  highlightedLines: string[] | undefined;
}

export function Layout({ snapshot, output, dapLog, highlightedLines }: LayoutProps) {
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
      <CommandBar sourcePath={snapshot.sourcePath} />
    </div>
  );
}
