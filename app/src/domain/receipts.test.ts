import { checkReceiptFile, hasReceipt, receiptSourceRow } from './receipts';
import { line, receipt } from '../testing/builders';

describe('checkReceiptFile', () => {
  it('accepts PDF, JPG, PNG and HEIC up to 15 MB', () => {
    expect(checkReceiptFile('a.PDF', 10)).toEqual({ ok: true });
    expect(checkReceiptFile('a.jpeg', 10)).toEqual({ ok: true });
    expect(checkReceiptFile('a.heic', 15 * 1024 * 1024)).toEqual({ ok: true });
  });
  it('refuses other types, empty files and files over 15 MB', () => {
    expect(checkReceiptFile('a.docx', 10)).toEqual({ ok: false, reason: 'type' });
    expect(checkReceiptFile('a.pdf', 0)).toEqual({ ok: false, reason: 'empty' });
    expect(checkReceiptFile('a.pdf', 15 * 1024 * 1024 + 1)).toEqual({ ok: false, reason: 'size' });
  });
});

describe('shared receipts', () => {
  const holder = line({ id: 'a', rowNumber: 1, receipts: [receipt()] });
  const sharer = line({ id: 'b', rowNumber: 2, receipts: [], sameReceiptAsRow: 1 });

  it("a row sharing another row's receipt has a receipt", () => {
    expect(receiptSourceRow(sharer, [holder, sharer])).toBe(holder);
    expect(hasReceipt(sharer, [holder, sharer])).toBe(true);
  });

  it('pointing at itself, at a missing row, or at another sharing row is broken', () => {
    expect(receiptSourceRow(line({ rowNumber: 3, sameReceiptAsRow: 3 }), [])).toBeUndefined();
    expect(receiptSourceRow(line({ rowNumber: 3, sameReceiptAsRow: 9 }), [holder])).toBeUndefined();
    const chained = line({ id: 'c', rowNumber: 3, receipts: [], sameReceiptAsRow: 2 });
    expect(receiptSourceRow(chained, [holder, sharer, chained])).toBeUndefined();
  });
});
