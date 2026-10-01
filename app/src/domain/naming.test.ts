import { cleanFileName, cleanNamePart, csvFileName, fileCopyName, fileNamesForRow, folderName, packageFiles, requestNumber, stripInvisible } from './naming';
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
    expect(cleanNamePart('Lab supplies, Zürich office #2')).toBe('Lab-supplies-Zurich-office-2');
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

  it('removes control, zero-width and direction characters from file and folder names', () => {
    const invisible = ['\u0000', '\u0007', '\u001f', '\u007f', '\u200B', '\u200E', '\u200F', '\u202A', '\u202E', '\u2066', '\u2069', '\uFEFF'];
    for (const ch of invisible) {
      expect(stripInvisible(`in${ch}voice`)).toBe('invoice');
      expect(cleanFileName(`in${ch}voice.pdf`)).toBe('invoice.pdf');
      expect(cleanNamePart(`Jane${ch}Doe`)).toBe('JaneDoe');
    }
    // A right-to-left override would make "receipt<override>fdp.exe" read as "receiptexe.pdf".
    expect(cleanFileName('receipt\u202Efdp.exe')).toBe('receiptfdp.exe');
    expect(cleanFileName('receipt.p\u202Edf')).toBe('receipt.pdf');
    expect(fileCopyName('receipt', 1, 0, 'slip\u200B.pdf')).toBe('R01_slip.pdf');
    expect(
      folderName({
        firstPurchaseDate: '2026-10-12',
        ownerName: 'Jane\u202EDoe',
        businessPurpose: 'Lab\u200Bsupplies',
        requestNumber: 'PR-0042',
        submissionNumber: 1
      })
    ).toBe('2026-10-12_JaneDoe_Labsupplies_PR-0042');
    // Ordinary text is left alone.
    expect(stripInvisible('Café, Zürich #2')).toBe('Café, Zürich #2');
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

  it('never leaves a file out: a row that shares a receipt but also holds one of its own has it copied under its own number', () => {
    const lines = [
      line({ id: 'a', rowNumber: 1, files: [file({ id: 'r1', fileName: 'invoice.pdf' })] }),
      line({ id: 'b', rowNumber: 2, files: [file({ id: 'r2', fileName: 'own-slip.pdf', fingerprint: 'b' })], sameReceiptAsRow: 1 })
    ];
    expect(packageFiles(lines).map((p) => [p.lineId, p.kind, p.packageName])).toEqual([
      ['a', 'receipt', 'R01_invoice.pdf'],
      ['b', 'receipt', 'R02_own-slip.pdf']
    ]);
    expect(fileNamesForRow(lines[1], lines, 'receipt')).toEqual(['R01_invoice.pdf', 'R02_own-slip.pdf']);
    expect(fileNamesForRow(lines[0], lines, 'receipt')).toEqual(['R01_invoice.pdf']);
    // A broken pointer still lists the row's own file.
    const broken = { ...lines[1], sameReceiptAsRow: 9 };
    expect(fileNamesForRow(broken, [lines[0], broken], 'receipt')).toEqual(['R02_own-slip.pdf']);
  });
});

describe('a long employee name (flow limit of 120 characters on a folder name)', () => {
  it('is cut, so the request number and the resubmission suffix are never lost', () => {
    const name = 'Maximiliana Alexandra Wilhelmina von Hohenzollern-Sigmaringen the Third';
    const first = folderName({
      firstPurchaseDate: '2026-10-12',
      ownerName: name,
      businessPurpose: 'Lab supplies for the Phase 1 assay of the new compound',
      requestNumber: 'PR-0042',
      submissionNumber: 1
    });
    const second = folderName({
      firstPurchaseDate: '2026-10-12',
      ownerName: name,
      businessPurpose: 'Lab supplies for the Phase 1 assay of the new compound',
      requestNumber: 'PR-0042',
      submissionNumber: 2
    });
    expect(first.length).toBeLessThanOrEqual(120);
    expect(second.length).toBeLessThanOrEqual(120);
    expect(first.endsWith('_PR-0042')).toBe(true);
    expect(second.endsWith('_PR-0042_R2')).toBe(true);
    expect(first).not.toBe(second);
  });
});
