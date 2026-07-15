import type { DbgApi } from '../../preload/index';

declare global {
  interface Window {
    dbg: DbgApi;
  }
}

export {};
