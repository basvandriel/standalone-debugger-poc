import { EventEmitter } from 'node:events';

const HEADER_TERMINATOR = '\r\n\r\n';
const CONTENT_LENGTH_RE = /Content-Length:\s*(\d+)/i;

/**
 * Decodes the DAP wire format (Content-Length-framed JSON) from a raw byte
 * stream. Handles partial reads and multiple messages arriving in a single
 * chunk, both of which happen routinely over a child process pipe.
 */
export class DapMessageDecoder extends EventEmitter {
  private buffer: Buffer = Buffer.alloc(0);

  push(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.drain();
  }

  private drain(): void {
    for (;;) {
      const headerEnd = this.buffer.indexOf(HEADER_TERMINATOR);
      if (headerEnd === -1) return;

      const header = this.buffer.subarray(0, headerEnd).toString('utf8');
      const match = CONTENT_LENGTH_RE.exec(header);
      if (!match) {
        this.buffer = this.buffer.subarray(headerEnd + HEADER_TERMINATOR.length);
        continue;
      }

      const contentLength = Number(match[1]);
      const bodyStart = headerEnd + HEADER_TERMINATOR.length;
      const bodyEnd = bodyStart + contentLength;
      if (this.buffer.length < bodyEnd) return;

      const body = this.buffer.subarray(bodyStart, bodyEnd).toString('utf8');
      this.buffer = this.buffer.subarray(bodyEnd);

      try {
        this.emit('message', JSON.parse(body));
      } catch (err) {
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
      }
    }
  }
}

/** Encodes a plain object as a Content-Length-framed DAP message. */
export function encodeDapMessage(message: unknown): Buffer {
  const json = JSON.stringify(message);
  const length = Buffer.byteLength(json, 'utf8');
  return Buffer.from(`Content-Length: ${length}${HEADER_TERMINATOR}${json}`, 'utf8');
}
