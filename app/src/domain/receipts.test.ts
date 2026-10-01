import { checkReceiptFile, hasQuote, hasReceipt, quoteFiles, receiptFiles, receiptSourceRow } from './receipts';
import { file, line, quote } from '../testing/builders';

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

describe('receipts and quotes (P-021)', () => {
  it('a quote never counts as the receipt', () => {
    const quoteOnly = line({ files: [quote()] });
    expect(receiptFiles(quoteOnly)).toEqual([]);
    expect(quoteFiles(quoteOnly)).toHaveLength(1);
    expect(hasReceipt(quoteOnly, [quoteOnly])).toBe(false);
    expect(hasQuote(quoteOnly)).toBe(true);
  });

  it('a row with a receipt and a quote has both', () => {
    const both = line({ files: [quote(), file({ id: 'f2', fileName: 'invoice.pdf' })] });
    expect(receiptFiles(both).map((f) => f.fileName)).toEqual(['invoice.pdf']);
    expect(hasReceipt(both, [both])).toBe(true);
  });

  it('a row with no files has neither', () => {
    const none = line({ files: [] });
    expect(hasReceipt(none, [none])).toBe(false);
    expect(hasQuote(none)).toBe(false);
  });
});

describe('shared receipts', () => {
  const holder = line({ id: 'a', rowNumber: 1, files: [file()] });
  const sharer = line({ id: 'b', rowNumber: 2, files: [], sameReceiptAsRow: 1 });

  it("a row sharing another row's receipt has a receipt", () => {
    expect(receiptSourceRow(sharer, [holder, sharer])).toBe(holder);
    expect(hasReceipt(sharer, [holder, sharer])).toBe(true);
  });

  it('a row cannot share a row that holds only a quote', () => {
    const quoted = line({ id: 'q', rowNumber: 1, files: [quote()] });
    const shares = line({ id: 's', rowNumber: 2, files: [], sameReceiptAsRow: 1 });
    expect(hasReceipt(shares, [quoted, shares])).toBe(false);
  });

  it('pointing at itself, at a missing row, or at another sharing row is broken', () => {
    expect(receiptSourceRow(line({ rowNumber: 3, sameReceiptAsRow: 3 }), [])).toBeUndefined();
    expect(receiptSourceRow(line({ rowNumber: 3, sameReceiptAsRow: 9 }), [holder])).toBeUndefined();
    const chained = line({ id: 'c', rowNumber: 3, files: [], sameReceiptAsRow: 2 });
    expect(receiptSourceRow(chained, [holder, sharer, chained])).toBeUndefined();
  });
});
