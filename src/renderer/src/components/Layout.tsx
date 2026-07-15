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
}

export function Layout({ snapshot, output, dapLog }: LayoutProps) {
  return (
    <div className="flex h-full flex-col">
      <StatusBar snapshot={snapshot} />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-3 border-r border-border">
          <SourcePanel snapshot={snapshot} />
        </div>
        <div className="flex min-w-0 flex-2 flex-col">
          <CallStackPanel snapshot={snapshot} />
          <VariablesPanel snapshot={snapshot} />
          <WatchPanel snapshot={snapshot} />
        </div>
      </div>
      <div className="flex h-50 flex-none border-t border-border">
        <OutputConsole output={output} dapLog={dapLog} />
      </div>
      <CommandBar sourcePath={snapshot.sourcePath} />
    </div>
  );
}
