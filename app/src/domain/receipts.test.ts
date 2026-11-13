import { checkReceiptFile, hasQuote, hasReceipt, quoteFiles, receiptFiles, receiptSourceRow, vendorReceiptRow } from './receipts';
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

describe('one receipt covers a vendor (P-049)', () => {
  const acme1 = line({ id: 'a', rowNumber: 1, vendor: 'Acme Lab Supply', files: [file()] });
  const acme2 = line({ id: 'b', rowNumber: 2, vendor: 'acme  LAB supply', files: [] });
  const other = line({ id: 'c', rowNumber: 3, vendor: 'Northwind Office Supply', files: [] });
  const all = [acme1, acme2, other];

  it('a row with no receipt of its own is covered by the receipt on another row of its vendor, matched as the vendor totals match', () => {
    expect(vendorReceiptRow(acme2, all)).toBe(acme1);
    expect(receiptSourceRow(acme2, all)).toBe(acme1);
    expect(hasReceipt(acme2, all)).toBe(true);
  });

  it('a row of another vendor is not covered', () => {
    expect(vendorReceiptRow(other, all)).toBeUndefined();
    expect(receiptSourceRow(other, all)).toBe(other);
    expect(hasReceipt(other, all)).toBe(false);
  });

  it('a row that holds a receipt uses its own, and the first holder in row order covers the rest', () => {
    expect(receiptSourceRow(acme1, all)).toBe(acme1);
    const third = line({ id: 'd', rowNumber: 4, vendor: 'Acme Lab Supply', files: [] });
    const secondHolder = line({ id: 'e', rowNumber: 2, vendor: 'Acme Lab Supply', files: [file({ id: 'f2' })] });
    expect(receiptSourceRow(third, [third, secondHolder, acme1])).toBe(acme1);
    expect(receiptSourceRow(secondHolder, [third, secondHolder, acme1])).toBe(secondHolder);
  });

  it('a quote does not cover, a row with no vendor name has no vendor to share with, and a row that points elsewhere holds nothing for others', () => {
    const quoted = line({ id: 'q', rowNumber: 1, vendor: 'Acme Lab Supply', files: [quote()] });
    expect(hasReceipt(acme2, [quoted, acme2])).toBe(false);
    const nameless = line({ id: 'n', rowNumber: 2, vendor: '', files: [] });
    const namelessHolder = line({ id: 'h', rowNumber: 1, vendor: '', files: [file()] });
    expect(hasReceipt(nameless, [namelessHolder, nameless])).toBe(false);
    const pointer = line({ id: 'p', rowNumber: 1, vendor: 'Acme Lab Supply', files: [file({ id: 'pf' })], sameReceiptAsRow: 5 });
    expect(vendorReceiptRow(acme2, [pointer, acme2])).toBeUndefined();
  });

  it('a pointer to another row still wins, for a receipt that covers rows with different vendor names', () => {
    const typo = line({ id: 't', rowNumber: 3, vendor: 'Acme Lab Suply', files: [], sameReceiptAsRow: 1 });
    expect(receiptSourceRow(typo, [acme1, acme2, typo])).toBe(acme1);
  });
});
