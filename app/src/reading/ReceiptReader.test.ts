import { EMPTY_GUESS, ReceiptGuess } from '../domain/receiptText';
import { READER_FILES, readerAssetsIn } from './assets';
import { createReceiptReader, ReaderEngine } from './ReceiptReader';

const assets = readerAssetsIn('https://example.com/assets/');
const blob = new Blob(['x']);

function fakeEngine(read: (name: string) => Promise<ReceiptGuess>, start: () => Promise<void> = async () => undefined): ReaderEngine {
  return { readReceipt: (_file, name) => read(name), startReader: start };
}

describe('receipt reader (D-074)', () => {
  it('reads receipts one at a time, in the order asked, and loads the engine once', async () => {
    const order: string[] = [];
    let loads = 0;
    const engine = fakeEngine(async (name) => {
      order.push(`start ${name}`);
      await new Promise((resolve) => setTimeout(resolve, name === 'a.png' ? 20 : 0));
      order.push(`end ${name}`);
      return { ...EMPTY_GUESS, vendor: name };
    });
    const reader = createReceiptReader(
      assets,
      () => undefined,
      async () => {
        loads += 1;
        return engine;
      }
    );
    const results = await Promise.all([reader.read(blob, 'a.png'), reader.read(blob, 'b.pdf')]);
    expect(results.map((r) => r?.vendor)).toEqual(['a.png', 'b.pdf']);
    expect(order).toEqual(['start a.png', 'end a.png', 'start b.pdf', 'end b.pdf']);
    expect(loads).toBe(1);
  });

  it('says once that it cannot start, then stays out of the way', async () => {
    const reasons: unknown[] = [];
    const reader = createReceiptReader(
      assets,
      (r) => reasons.push(r),
      async () =>
        fakeEngine(
          async () => EMPTY_GUESS,
          async () => {
            throw new Error('blocked by the page security settings');
          }
        )
    );
    expect(await reader.read(blob, 'a.png')).toBeNull();
    expect(await reader.read(blob, 'b.png')).toBeNull();
    expect(reasons).toHaveLength(1);
    expect(reader.available).toBe(false);
  });

  it('suggests nothing for a file it cannot read, and carries on', async () => {
    const reader = createReceiptReader(
      assets,
      () => undefined,
      async () =>
        fakeEngine(async (name) => {
          if (name === 'bad.png') throw new Error('damaged image');
          return { ...EMPTY_GUESS, vendor: 'Metro Parking' };
        })
    );
    expect(await reader.read(blob, 'bad.png')).toEqual(EMPTY_GUESS);
    expect((await reader.read(blob, 'good.png'))?.vendor).toBe('Metro Parking');
  });

  it('gives up on a start or a read that takes too long', async () => {
    const never = new Promise<never>(() => undefined);
    const stuckStart = createReceiptReader(
      assets,
      () => undefined,
      async () =>
        fakeEngine(
          async () => EMPTY_GUESS,
          () => never
        ),
      { startMs: 10, readMs: 10 }
    );
    expect(await stuckStart.read(blob, 'a.png')).toBeNull();
    expect(stuckStart.available).toBe(false);

    const stuckRead = createReceiptReader(
      assets,
      () => undefined,
      async () => fakeEngine(() => never),
      { startMs: 10, readMs: 10 }
    );
    expect(await stuckRead.read(blob, 'a.png')).toEqual(EMPTY_GUESS);
    expect(stuckRead.available).toBe(true);
  });

  it('finds its files next to the app script', () => {
    expect(assets).toEqual({
      workerUrl: `https://example.com/assets/${READER_FILES.worker}`,
      coreSimdUrl: `https://example.com/assets/${READER_FILES.coreSimd}`,
      coreUrl: `https://example.com/assets/${READER_FILES.core}`,
      languageFolderUrl: 'https://example.com/assets'
    });
  });
});
