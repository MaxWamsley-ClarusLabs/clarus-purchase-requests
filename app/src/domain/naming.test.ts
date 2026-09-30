import { cleanFileName, cleanNamePart, csvFileName, fileCopyName, fileNamesForRow, folderName, packageFiles, requestNumber } from './naming';
import { file, line, quote } from '../testing/builders';

describe('request numbers and folder names', () => {
  it('pads request numbers to four digits', () => {
    expect(requestNumber(42)).toBe('PR-0042');
    expect(requestNumber(12345)).toBe('PR-12345');
  });

  it('builds the folder name from the earliest purchase date, employee, business purpose and request number (P-026)', () => {
    expect(
      folderName({ firstPurchaseDate: '2026-10-12', ownerName: 'Jane Doe', businessPurpose: 'Lab supplies', requestNumber: 'PR-0042', submissionNumber: 1 })
    ).toBe('2026-10-12_Jane-Doe_Lab-supplies_PR-0042');
  });

  it('adds _R2 for a resubmission', () => {
    expect(folderName({ firstPurchaseDate: '2026-10-12', ownerName: 'Jane Doe', businessPurpose: 'Lab', requestNumber: 'PR-0042', submissionNumber: 2 })).toBe(
      '2026-10-12_Jane-Doe_Lab_PR-0042_R2'
    );
  });

  it('removes accents, slashes and other unsafe characters, and caps the purpose at 40 characters', () => {
    expect(cleanNamePart('Café / supplies #2')).toBe('Cafe-supplies-2');
    const long = folderName({
      firstPurchaseDate: '2026-10-12',
      ownerName: 'José Núñez',
      businessPurpose: 'A very long business purpose that goes on and on beyond forty characters',
      requestNumber: 'PR-0007',
      submissionNumber: 1
    });
    expect(long).toBe('2026-10-12_Jose-Nunez_A-very-long-business-purpose-that-goes-o_PR-0007');
    expect(long).not.toMatch(/[\\/]/);
  });

  it('leaves out a part that is empty, rather than leaving a gap', () => {
    expect(folderName({ firstPurchaseDate: '', ownerName: 'Jane Doe', businessPurpose: '', requestNumber: 'PR-0042', submissionNumber: 1 })).toBe(
      'Jane-Doe_PR-0042'
    );
  });

  it('names the CSV file', () => {
    expect(csvFileName('PR-0042', 1)).toBe('PR-0042_Purchases.csv');
    expect(csvFileName('PR-0042', 2)).toBe('PR-0042_R2_Purchases.csv');
  });
});

describe('file copies', () => {
  it('prefixes R and the row number for receipts, Q for quotes, and numbers extra files on the same row', () => {
    expect(fileCopyName('receipt', 1, 0, 'IMG_4432.jpg')).toBe('R01_IMG_4432.jpg');
    expect(fileCopyName('receipt', 1, 1, 'slip.pdf')).toBe('R01-2_slip.pdf');
    expect(fileCopyName('quote', 1, 0, 'quote.pdf')).toBe('Q01_quote.pdf');
    expect(fileCopyName('quote', 12, 1, 'b.png')).toBe('Q12-2_b.png');
  });

  it('cleans characters SharePoint does not allow', () => {
    expect(cleanFileName('invoice: "final"?.pdf')).toBe('invoice- -final--.pdf');
    expect(cleanFileName('.pdf')).toBe('receipt.pdf');
  });

  it('copies a shared receipt once, under the row that holds it, and never shares quotes', () => {
    const lines = [
      line({ id: 'a', rowNumber: 1, files: [file({ id: 'r1', fileName: 'invoice.pdf' }), quote({ id: 'q1', fileName: 'quote.pdf' })] }),
      line({ id: 'b', rowNumber: 2, files: [quote({ id: 'q2', fileName: 'quote-b.pdf' })], sameReceiptAsRow: 1 })
    ];
    expect(packageFiles(lines).map((p) => [p.kind, p.packageName])).toEqual([
      ['receipt', 'R01_invoice.pdf'],
      ['quote', 'Q01_quote.pdf'],
      ['quote', 'Q02_quote-b.pdf']
    ]);
    expect(fileNamesForRow(lines[1], lines, 'receipt')).toEqual(['R01_invoice.pdf']);
    expect(fileNamesForRow(lines[1], lines, 'quote')).toEqual(['Q02_quote-b.pdf']);
    expect(fileNamesForRow(lines[0], lines, 'quote')).toEqual(['Q01_quote.pdf']);
  });
});
