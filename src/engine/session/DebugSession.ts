import { randomUUID } from 'node:crypto';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { DapClient } from '../dap/DapClient.js';
import { spawnAdapter } from '../dap/spawnAdapter.js';
import type { AdapterDefinition } from '../adapters/types.js';
import type {
  BreakpointDescriptor,
  DapLogDirection,
  DapLogEntry,
  OutputCategory,
  OutputEntry,
  ScopeDescriptor,
  SessionPhase,
  SessionSnapshot,
  StackFrameDescriptor,
  ThreadDescriptor,
  VariableNode,
  WatchDescriptor
} from '../../shared/types.js';

export interface DebugSessionOptions {
  adapterId: string;
  programPath: string;
  sourcePath: string;
  cwd: string;
}

type Unsubscribe = () => void;

interface DapStackFrame {
  id: number;
  name: string;
  line: number;
  column: number;
  source?: { path?: string };
}

interface DapScope {
  name: string;
  variablesReference: number;
  expensive: boolean;
}

interface DapVariable {
  name: string;
  value: string;
  type?: string;
  variablesReference: number;
}

/**
 * Orchestrates a single debug session against one DAP adapter. Contains no
 * Electron imports -- takes/returns only plain data so it can be driven
 * headlessly (see scripts/smoke-test.ts) or from an Electron main process
 * (see src/main/ipc.ts), and could equally be lifted into a future terminal
 * frontend without modification.
 */
export class DebugSession {
  private client?: DapClient;
  private child?: ChildProcessWithoutNullStreams;
  private launchPromise?: Promise<unknown>;

  private phase: SessionPhase = 'idle';
  private errorMessage?: string;

  private readonly breakpointLines = new Map<string, number[]>();
  private readonly breakpoints = new Map<string, BreakpointDescriptor[]>();

  private threads: ThreadDescriptor[] = [];
  private selectedThreadId?: number;
  private stack: StackFrameDescriptor[] = [];
  private selectedFrameId?: number;
  private readonly scopesByFrame = new Map<number, ScopeDescriptor[]>();
  private readonly variablesByRef = new Map<number, VariableNode[]>();
  private watches: WatchDescriptor[] = [];

  private readonly snapshotListeners = new Set<(snapshot: SessionSnapshot) => void>();
  private readonly outputListeners = new Set<(entry: OutputEntry) => void>();
  private readonly dapLogListeners = new Set<(entry: DapLogEntry) => void>();

  constructor(
    private readonly options: DebugSessionOptions,
    private readonly adapter: AdapterDefinition
  ) {}

  onSnapshot(cb: (snapshot: SessionSnapshot) => void): Unsubscribe {
    this.snapshotListeners.add(cb);
    return () => this.snapshotListeners.delete(cb);
  }

  onOutput(cb: (entry: OutputEntry) => void): Unsubscribe {
    this.outputListeners.add(cb);
    return () => this.outputListeners.delete(cb);
  }

  onDapLog(cb: (entry: DapLogEntry) => void): Unsubscribe {
    this.dapLogListeners.add(cb);
    return () => this.dapLogListeners.delete(cb);
  }

  getSnapshot(): SessionSnapshot {
    return this.buildSnapshot();
  }

  async start(): Promise<void> {
    this.phase = 'initializing';
    this.emitSnapshot();

    try {
      // Guards the whole handshake against any single step hanging forever
      // (adapter spawn wedged, initialize/launch never answered, etc.) --
      // without this, a stuck step would leave `start()` unsettled even
      // though nothing external depends on that promise resolving.
      await Promise.race([this.runHandshake(), handshakeTimeout(20_000)]);
      this.phase = 'configuring';
      this.emitSnapshot();
    } catch (err) {
      this.handleFatalError(err);
    }
  }

  private async runHandshake(): Promise<void> {
    const executablePath = await this.adapter.resolveExecutable();
    const child = spawnAdapter(executablePath, this.adapter.spawnArgs);
    this.child = child;
    child.on('exit', (code, signal) => this.handleAdapterExit(code, signal));
    child.on('error', (err) => this.handleFatalError(err));
    child.stderr.on('data', (chunk: Buffer) => {
      this.logDap('incoming', { stderr: chunk.toString('utf8') });
    });

    const client = new DapClient(child.stdout, child.stdin);
    this.client = client;
    client.on('*', (msg: unknown) => this.logDap('incoming', msg));
    client.on('output', (body: { category?: string; output: string }) => this.handleOutputEvent(body));
    client.on('stopped', (body: { threadId?: number; reason: string }) => void this.handleStopped(body));
    client.on('continued', () => this.handleContinued());
    client.on('exited', () => this.handleExited());
    client.on('terminated', () => this.handleTerminated());
    client.on('breakpoint', (body: { breakpoint: { id?: number; line?: number; verified: boolean } }) =>
      this.handleBreakpointEvent(body)
    );

    await this.sendRequest('initialize', {
      clientID: 'dbg',
      clientName: 'dbg',
      adapterID: this.adapter.id,
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
      supportsRunInTerminalRequest: false,
      supportsInvalidatedEvent: true,
      locale: 'en-US'
    });

    // Real lldb-dap only emits `initialized` once it starts processing
    // `launch`, not right after `initialize` responds (confirmed
    // empirically -- see scripts/smoke-test.ts). Fire launch first.
    const initializedPromise = new Promise<void>((resolve) => client.once('initialized', () => resolve()));
    const launchArgs = this.adapter.buildLaunchArgs({
      program: this.options.programPath,
      cwd: this.options.cwd
    });
    const launchRequestPromise = this.sendRequest('launch', launchArgs);
    this.launchPromise = launchRequestPromise;

    // If launch fails outright (e.g. bad --program path), `initialized`
    // will never arrive -- propagate that failure instead of hanging.
    // If launch succeeds, this branch just never resolves and the real
    // `initialized` event wins the race normally.
    await Promise.race([initializedPromise, launchRequestPromise.then(() => new Promise<void>(() => {}))]);
  }

  async toggleBreakpoint(file: string, line: number): Promise<void> {
    if (!this.isSessionLive()) return;
    const current = this.breakpointLines.get(file) ?? [];
    const next = current.includes(line)
      ? current.filter((l) => l !== line)
      : [...current, line].sort((a, b) => a - b);
    this.breakpointLines.set(file, next);

    const response = await this.sendRequest<
      { source: { path: string }; breakpoints: { line: number }[] },
      { breakpoints: { line: number; verified: boolean; id?: number }[] }
    >('setBreakpoints', {
      source: { path: file },
      breakpoints: next.map((l) => ({ line: l }))
    });

    this.breakpoints.set(
      file,
      response.breakpoints.map((b) => ({ line: b.line, verified: b.verified, id: b.id }))
    );
    this.emitSnapshot();
  }

  async beginExecution(): Promise<void> {
    if (this.phase !== 'configuring') return;
    await this.sendRequest('configurationDone');
    this.phase = 'running';
    this.emitSnapshot();
  }

  async continueExecution(): Promise<void> {
    if (this.phase !== 'stopped' || this.selectedThreadId === undefined) return;
    const threadId = this.selectedThreadId;
    this.phase = 'running';
    this.emitSnapshot();
    await this.sendRequest('continue', { threadId });
  }

  async stepOver(): Promise<void> {
    await this.step('next');
  }

  async stepIn(): Promise<void> {
    await this.step('stepIn');
  }

  async stepOut(): Promise<void> {
    await this.step('stepOut');
  }

  private async step(command: 'next' | 'stepIn' | 'stepOut'): Promise<void> {
    if (this.phase !== 'stopped' || this.selectedThreadId === undefined) return;
    // The response only acknowledges acceptance -- actual state refresh
    // happens in handleStopped once the follow-up `stopped` event arrives.
    await this.sendRequest(command, { threadId: this.selectedThreadId });
  }

  async selectFrame(frameId: number): Promise<void> {
    if (!this.isSessionLive() || !this.stack.some((f) => f.id === frameId)) return;
    this.selectedFrameId = frameId;
    if (!this.scopesByFrame.has(frameId)) {
      await this.loadFrameScopes(frameId);
    }
    this.emitSnapshot();
  }

  async expandVariable(variablesReference: number): Promise<VariableNode[]> {
    const cached = this.variablesByRef.get(variablesReference);
    if (cached) return cached;
    if (!this.isSessionLive()) return [];

    const response = await this.sendRequest<{ variablesReference: number }, { variables: DapVariable[] }>(
      'variables',
      { variablesReference }
    );
    const variables = response.variables.map(toVariableNode);
    this.variablesByRef.set(variablesReference, variables);
    this.emitSnapshot();
    return variables;
  }

  async addWatch(expression: string): Promise<void> {
    const watch: WatchDescriptor = { id: randomUUID(), expression };
    this.watches = [...this.watches, watch];
    await this.evaluateWatch(watch);
    this.emitSnapshot();
  }

  async removeWatch(id: string): Promise<void> {
    this.watches = this.watches.filter((w) => w.id !== id);
    this.emitSnapshot();
  }

  async terminate(): Promise<void> {
    const client = this.client;
    const child = this.child;
    if (!client || !child) return;

    await Promise.race([
      this.sendRequest('disconnect', { terminateDebuggee: true }).catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 3000))
    ]);

    client.dispose();
    if (!child.killed) child.kill();
  }

  private assertClient(): DapClient {
    if (!this.client) throw new Error('DebugSession not started');
    return this.client;
  }

  /** False once the adapter is known dead/gone -- avoids issuing requests that would hang forever unanswered. */
  private isSessionLive(): boolean {
    return this.phase !== 'error' && this.phase !== 'terminated' && this.phase !== 'idle';
  }

  private async sendRequest<TArgs = unknown, TBody = unknown>(command: string, args?: TArgs): Promise<TBody> {
    this.logDap('outgoing', { command, arguments: args });
    return this.assertClient().sendRequest<TArgs, TBody>(command, args);
  }

  private async loadFrameScopes(frameId: number): Promise<void> {
    const response = await this.sendRequest<{ frameId: number }, { scopes: DapScope[] }>('scopes', { frameId });
    this.scopesByFrame.set(
      frameId,
      response.scopes.map((s) => ({ name: s.name, variablesReference: s.variablesReference, expensive: s.expensive }))
    );
    for (const scope of response.scopes) {
      if (scope.variablesReference === 0 || this.variablesByRef.has(scope.variablesReference)) continue;
      const varsResponse = await this.sendRequest<{ variablesReference: number }, { variables: DapVariable[] }>(
        'variables',
        { variablesReference: scope.variablesReference }
      );
      this.variablesByRef.set(scope.variablesReference, varsResponse.variables.map(toVariableNode));
    }
  }

  private async evaluateWatch(watch: WatchDescriptor): Promise<void> {
    if (this.phase !== 'stopped' || this.selectedFrameId === undefined) {
      watch.value = undefined;
      watch.error = 'not stopped';
      return;
    }
    try {
      const response = await this.sendRequest<
        { expression: string; frameId: number; context: string },
        { result: string; type?: string }
      >('evaluate', { expression: watch.expression, frameId: this.selectedFrameId, context: 'watch' });
      watch.value = response.result;
      watch.type = response.type;
      watch.error = undefined;
    } catch (err) {
      watch.error = err instanceof Error ? err.message : String(err);
    }
  }

  private async refreshWatches(): Promise<void> {
    for (const watch of this.watches) {
      await this.evaluateWatch(watch);
    }
  }

  private async handleStopped(body: { threadId?: number; reason: string }): Promise<void> {
    this.phase = 'stopped';
    this.scopesByFrame.clear();
    this.variablesByRef.clear();

    try {
      const threadsResponse = await this.sendRequest<undefined, { threads: ThreadDescriptor[] }>('threads');
      this.threads = threadsResponse.threads;
      this.selectedThreadId = body.threadId ?? threadsResponse.threads[0]?.id;

      if (this.selectedThreadId !== undefined) {
        const stackResponse = await this.sendRequest<
          { threadId: number; startFrame: number; levels: number },
          { stackFrames: DapStackFrame[] }
        >('stackTrace', { threadId: this.selectedThreadId, startFrame: 0, levels: 20 });
        this.stack = stackResponse.stackFrames.map((f) => ({
          id: f.id,
          name: f.name,
          line: f.line,
          column: f.column,
          sourcePath: f.source?.path
        }));
        this.selectedFrameId = this.stack[0]?.id;
        if (this.selectedFrameId !== undefined) {
          await this.loadFrameScopes(this.selectedFrameId);
        }
      } else {
        this.stack = [];
        this.selectedFrameId = undefined;
      }

      await this.refreshWatches();
    } catch (err) {
      this.handleFatalError(err);
      return;
    }

    this.emitSnapshot();
  }

  private handleContinued(): void {
    this.phase = 'running';
    this.emitSnapshot();
  }

  private handleExited(): void {
    // Real exit-code surfacing happens in the DAP log; `terminated` drives phase.
  }

  private handleTerminated(): void {
    this.phase = 'terminated';
    this.clearRuntimeState();
    this.emitSnapshot();
  }

  private handleBreakpointEvent(body: { breakpoint: { id?: number; line?: number; verified: boolean } }): void {
    for (const [file, list] of this.breakpoints) {
      const idx = list.findIndex((b) => b.id === body.breakpoint.id);
      if (idx === -1) continue;
      const existing = list[idx]!;
      list[idx] = { ...existing, verified: body.breakpoint.verified, line: body.breakpoint.line ?? existing.line };
      this.breakpoints.set(file, [...list]);
      this.emitSnapshot();
      return;
    }
  }

  private handleOutputEvent(body: { category?: string; output: string }): void {
    const category: OutputCategory =
      body.category === 'stderr' ? 'stderr' : body.category === 'stdout' ? 'stdout' : 'console';
    const entry: OutputEntry = { category, text: body.output, timestamp: Date.now() };
    for (const listener of this.outputListeners) listener(entry);
  }

  private handleAdapterExit(code: number | null, signal: NodeJS.Signals | null): void {
    // Don't clobber a more specific diagnostic (e.g. a bad --program path)
    // with this generic message if we're already in a terminal state.
    if (this.phase === 'terminated' || this.phase === 'error') return;
    this.phase = 'error';
    this.errorMessage = `adapter process exited unexpectedly (code=${code}, signal=${signal})`;
    this.clearRuntimeState();
    this.emitSnapshot();
  }

  private handleFatalError(err: unknown): void {
    this.phase = 'error';
    this.errorMessage = err instanceof Error ? err.message : String(err);
    this.clearRuntimeState();
    this.emitSnapshot();
  }

  /**
   * Once the debuggee/adapter is gone, stack/scopes/variables from the last
   * stop are no longer real -- leaving them in the snapshot would look like
   * the UI is still inspecting a live process. Breakpoints and watch
   * *expressions* survive (still meaningful for the next run); watch
   * *values* don't, since there's nothing left to evaluate them against.
   */
  private clearRuntimeState(): void {
    this.threads = [];
    this.selectedThreadId = undefined;
    this.stack = [];
    this.selectedFrameId = undefined;
    this.scopesByFrame.clear();
    this.variablesByRef.clear();
    this.watches = this.watches.map((w) => ({ ...w, value: undefined, error: 'not running' }));
  }

  private logDap(direction: DapLogDirection, payload: unknown): void {
    const entry: DapLogEntry = { direction, payload, timestamp: Date.now() };
    for (const listener of this.dapLogListeners) listener(entry);
  }

  private emitSnapshot(): void {
    const snapshot = this.buildSnapshot();
    for (const listener of this.snapshotListeners) listener(snapshot);
  }

  private buildSnapshot(): SessionSnapshot {
    const breakpoints: Record<string, BreakpointDescriptor[]> = {};
    for (const [file, list] of this.breakpoints) breakpoints[file] = list;

    const variablesByRef: Record<number, VariableNode[]> = {};
    for (const [ref, vars] of this.variablesByRef) variablesByRef[ref] = vars;

    const scopes = this.selectedFrameId !== undefined ? (this.scopesByFrame.get(this.selectedFrameId) ?? []) : [];

    return {
      phase: this.phase,
      adapterId: this.adapter.id,
      programPath: this.options.programPath,
      sourcePath: this.options.sourcePath,
      errorMessage: this.errorMessage,
      breakpoints,
      threads: this.threads,
      selectedThreadId: this.selectedThreadId,
      stack: this.stack,
      selectedFrameId: this.selectedFrameId,
      scopes,
      watches: this.watches,
      variablesByRef
    };
  }
}

function toVariableNode(v: DapVariable): VariableNode {
  return { name: v.name, value: v.value, type: v.type, variablesReference: v.variablesReference };
}

function handshakeTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`debug adapter handshake timed out after ${ms}ms`)), ms);
  });
}
