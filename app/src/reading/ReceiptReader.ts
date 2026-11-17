// Reads receipts for suggestions (D-074). The screens use this, never the
// engine directly: the engine (engine.ts) is loaded only when the first receipt
// is read, and if it cannot start in this browser the reader says so once and
// then stays out of the way. The employee then types the details, as before.

import { EMPTY_GUESS, ReceiptGuess } from '../domain/receiptText';
import { ReaderAssets } from './assets';

export interface ReceiptReader {
  /**
   * What the receipt suggests, or null if the reader could not run. Never
   * throws. Receipts are read one at a time, in the order asked.
   */
  read(file: Blob, fileName: string): Promise<ReceiptGuess | null>;
  /** False once the reader has failed to start in this browser. */
  readonly available: boolean;
}

export interface ReaderEngine {
  readReceipt(file: Blob, fileName: string, assets: ReaderAssets): Promise<ReceiptGuess>;
  startReader(assets: ReaderAssets): Promise<void>;
}

/** Loads the engine as its own script, the first time it is needed. */
const loadEngine = (): Promise<ReaderEngine> => import(/* webpackChunkName: 'receipt-reader' */ './engine');

/**
 * Time limits, so a row never shows "Reading" for ever. Starting includes the
 * first download of about 9 MB (D-079); one receipt normally takes 0.1 to 3 seconds.
 */
export const READER_TIME_LIMITS = { startMs: 120000, readMs: 60000 };

function withinTime<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No answer within ${ms / 1000} seconds.`)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (reason) => {
        clearTimeout(timer);
        reject(reason);
      }
    );
  });
}

/**
 * A reader that loads its engine on first use. `onUnavailable` is called once
 * if the engine cannot start (for example if the site's security settings
 * block it), with the reason for the browser's console.
 */
export function createReceiptReader(
  assets: ReaderAssets,
  onUnavailable: (reason: unknown) => void,
  load: () => Promise<ReaderEngine> = loadEngine,
  limits: { startMs: number; readMs: number } = READER_TIME_LIMITS
): ReceiptReader {
  let engine: Promise<ReaderEngine> | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  const state = { available: true };

  const start = (): Promise<ReaderEngine> => {
    if (!engine) {
      engine = withinTime(
        load().then(async (e) => {
          await e.startReader(assets);
          return e;
        }),
        limits.startMs
      );
    }
    return engine;
  };

  const readOne = async (file: Blob, fileName: string): Promise<ReceiptGuess | null> => {
    if (!state.available) return null;
    let e: ReaderEngine;
    try {
      e = await start();
    } catch (reason) {
      if (state.available) {
        state.available = false;
        onUnavailable(reason);
      }
      return null;
    }
    try {
      return await withinTime(e.readReceipt(file, fileName, assets), limits.readMs);
    } catch {
      // One unreadable or very slow file (for example a damaged image) suggests nothing.
      return EMPTY_GUESS;
    }
  };

  return {
    get available() {
      return state.available;
    },
    read(file, fileName) {
      const result = queue.then(() => readOne(file, fileName));
      queue = result.catch(() => undefined);
      return result;
    }
  };
}
