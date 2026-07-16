export type SessionPhase =
  | "idle"
  | "initializing"
  | "configuring"
  | "running"
  | "stopped"
  | "terminated"
  | "error";

export interface BreakpointDescriptor {
  line: number;
  verified: boolean;
  id?: number;
}

export interface ThreadDescriptor {
  id: number;
  name: string;
}

export interface StackFrameDescriptor {
  id: number;
  name: string;
  line: number;
  column: number;
  sourcePath?: string;
}

export interface ScopeDescriptor {
  name: string;
  variablesReference: number;
  expensive: boolean;
}

export interface VariableNode {
  name: string;
  value: string;
  type?: string;
  variablesReference: number;
}

export interface WatchDescriptor {
  id: string;
  expression: string;
  value?: string;
  type?: string;
  error?: string;
}

export type OutputCategory = "stdout" | "stderr" | "console";

export interface OutputEntry {
  category: OutputCategory;
  text: string;
  timestamp: number;
}

export type DapLogDirection = "outgoing" | "incoming";

export interface DapLogEntry {
  direction: DapLogDirection;
  payload: unknown;
  timestamp: number;
}

export interface SessionSnapshot {
  phase: SessionPhase;
  adapterId: string;
  programPath: string;
  sourcePath: string;
  errorMessage?: string;
  breakpoints: Record<string, BreakpointDescriptor[]>;
  threads: ThreadDescriptor[];
  selectedThreadId?: number;
  stack: StackFrameDescriptor[];
  selectedFrameId?: number;
  scopes: ScopeDescriptor[];
  watches: WatchDescriptor[];
  /** Everything fetched so far: top-level scope vars (auto-fetched on stop) plus any lazily-expanded nodes, keyed by DAP variablesReference. */
  variablesByRef: Record<number, VariableNode[]>;
}

export interface CliOptions {
  adapter: string;
  program: string;
  source: string;
  cwd: string;
  logFile?: string;
}

export const IPC = {
  GET_INITIAL_STATE: "dbg:getInitialState",
  READ_SOURCE_FILE: "dbg:readSourceFile",
  TOGGLE_BREAKPOINT: "dbg:toggleBreakpoint",
  BEGIN_EXECUTION: "dbg:beginExecution",
  CONTINUE_EXECUTION: "dbg:continueExecution",
  STEP_OVER: "dbg:stepOver",
  STEP_IN: "dbg:stepIn",
  STEP_OUT: "dbg:stepOut",
  SELECT_FRAME: "dbg:selectFrame",
  EXPAND_VARIABLE: "dbg:expandVariable",
  ADD_WATCH: "dbg:addWatch",
  REMOVE_WATCH: "dbg:removeWatch",
  TERMINATE: "dbg:terminate",
  RESTART: "dbg:restart",
  RENDERER_READY: "dbg:rendererReady",

  SNAPSHOT: "dbg:snapshot",
  OUTPUT: "dbg:output",
  DAP_LOG: "dbg:dapLog",
} as const;
