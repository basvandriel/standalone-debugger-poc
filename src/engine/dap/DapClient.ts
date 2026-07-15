import { EventEmitter } from 'node:events';
import type { Readable, Writable } from 'node:stream';
import { DapMessageDecoder, encodeDapMessage } from './DapMessageStream.js';
import type { DebugProtocol } from './protocol.js';

interface PendingRequest {
  resolve: (body: unknown) => void;
  reject: (err: Error) => void;
  command: string;
}

export class DapError extends Error {
  constructor(
    message: string,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'DapError';
  }
}

/**
 * Transport-level DAP client: Content-Length framing, request/response
 * correlation via `seq`, and event dispatch. Takes plain streams rather than
 * a ChildProcess so it stays decoupled from how the adapter was spawned, and
 * contains zero adapter-specific logic so it is reusable against any DAP
 * server (debugpy, delve, codelldb, ...), not just lldb-dap.
 */
export class DapClient extends EventEmitter {
  private seq = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly decoder = new DapMessageDecoder();

  constructor(
    private readonly input: Readable,
    private readonly output: Writable
  ) {
    super();
    this.decoder.on('message', (msg: unknown) => this.handleMessage(msg as DebugProtocol.ProtocolMessage));
    this.decoder.on('error', (err: Error) => this.emit('decodeError', err));
    this.input.on('data', (chunk: Buffer) => this.decoder.push(chunk));
  }

  sendRequest<TArgs = unknown, TBody = unknown>(command: string, args?: TArgs): Promise<TBody> {
    const seq = this.seq++;
    const request: DebugProtocol.Request = {
      seq,
      type: 'request',
      command,
      arguments: args as unknown
    };
    return new Promise<TBody>((resolve, reject) => {
      this.pending.set(seq, { resolve: resolve as (body: unknown) => void, reject, command });
      this.output.write(encodeDapMessage(request));
    });
  }

  private handleMessage(msg: DebugProtocol.ProtocolMessage): void {
    this.emit('*', msg);

    if (msg.type === 'response') {
      const response = msg as DebugProtocol.Response;
      const pending = this.pending.get(response.request_seq);
      if (!pending) return;
      this.pending.delete(response.request_seq);
      if (response.success) {
        pending.resolve(response.body);
      } else {
        pending.reject(new DapError(response.message ?? `${pending.command} failed`, response.body));
      }
      return;
    }

    if (msg.type === 'event') {
      const event = msg as DebugProtocol.Event;
      this.emit(event.event, event.body);
    }

    // Reverse requests (type === 'request', e.g. runInTerminal) are not used
    // by this client (runInTerminal is never requested), so no handling
    // beyond the '*' log emit above is needed.
  }

  dispose(): void {
    for (const pending of this.pending.values()) {
      pending.reject(new DapError('DapClient disposed'));
    }
    this.pending.clear();
    this.removeAllListeners();
  }
}
