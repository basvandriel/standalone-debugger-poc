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
    <div className="layout">
      <StatusBar snapshot={snapshot} />
      <div className="layout-main">
        <div className="layout-source-col">
          <SourcePanel snapshot={snapshot} />
        </div>
        <div className="layout-side-col">
          <CallStackPanel snapshot={snapshot} />
          <VariablesPanel snapshot={snapshot} />
          <WatchPanel snapshot={snapshot} />
        </div>
      </div>
      <div className="layout-console-row">
        <OutputConsole output={output} dapLog={dapLog} />
      </div>
      <CommandBar sourcePath={snapshot.sourcePath} />
    </div>
  );
}
