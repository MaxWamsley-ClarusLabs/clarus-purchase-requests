import { cleanFileName, cleanNamePart, csvFileName, folderName, packageReceipts, receiptCopyName, receiptNamesForRow, reportNumber } from './naming';
import { line, receipt } from '../testing/builders';

describe('report numbers and folder names', () => {
  it('pads report numbers to four digits', () => {
    expect(reportNumber(42)).toBe('TR-0042');
    expect(reportNumber(12345)).toBe('TR-12345');
  });

  it('builds the folder name from trip start, owner, trip and report number', () => {
    expect(folderName({ tripStart: '2026-10-12', ownerName: 'Jane Doe', tripName: 'Boston Conference', reportNumber: 'TR-0042', submissionNumber: 1 })).toBe(
      '2026-10-12_Jane-Doe_Boston-Conference_TR-0042'
    );
  });

  it('adds _R2 for a resubmission', () => {
    expect(folderName({ tripStart: '2026-10-12', ownerName: 'Jane Doe', tripName: 'Boston', reportNumber: 'TR-0042', submissionNumber: 2 })).toBe(
      '2026-10-12_Jane-Doe_Boston_TR-0042_R2'
    );
  });

  it('removes accents, slashes and other unsafe characters, and caps the trip name at 40 characters', () => {
    expect(cleanNamePart('São Paulo / trip #2')).toBe('Sao-Paulo-trip-2');
    const long = folderName({
      tripStart: '2026-10-12',
      ownerName: 'José Núñez',
      tripName: 'A very long trip name that goes on and on beyond forty characters',
      reportNumber: 'TR-0007',
      submissionNumber: 1
    });
    expect(long).toBe('2026-10-12_Jose-Nunez_A-very-long-trip-name-that-goes-on-and-o_TR-0007');
    expect(long).not.toMatch(/[\\/]/);
  });

  it('names the CSV file', () => {
    expect(csvFileName('TR-0042', 1)).toBe('TR-0042_Expenses.csv');
    expect(csvFileName('TR-0042', 2)).toBe('TR-0042_R2_Expenses.csv');
  });
});

describe('receipt copies', () => {
  it('prefixes the row number, and numbers extra files on the same row', () => {
    expect(receiptCopyName(1, 0, 'IMG_4432.jpg')).toBe('R01_IMG_4432.jpg');
    expect(receiptCopyName(1, 1, 'slip.pdf')).toBe('R01-2_slip.pdf');
    expect(receiptCopyName(12, 0, 'a.png')).toBe('R12_a.png');
  });

  it('cleans characters SharePoint does not allow', () => {
    expect(cleanFileName('hotel: folio? "final".pdf')).toBe('hotel- folio- -final-.pdf');
    expect(cleanFileName('.pdf')).toBe('receipt.pdf');
  });

  it('copies a shared receipt once, under the row that holds it', () => {
    const lines = [
      line({ id: 'a', rowNumber: 1, receipts: [receipt({ id: 'r1', fileName: 'folio.pdf' })] }),
      line({ id: 'b', rowNumber: 2, receipts: [], sameReceiptAsRow: 1 })
    ];
    expect(packageReceipts(lines).map((p) => p.packageName)).toEqual(['R01_folio.pdf']);
    expect(receiptNamesForRow(lines[1], lines)).toEqual(['R01_folio.pdf']);
  });
});
