import { buildExpensesCsv, csvCell, CSV_COLUMNS } from './csv';
import { line, receipt, report } from '../testing/builders';

/** A small CSV reader for the tests: handles quoted cells with commas, quotes and line breaks. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' && text[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
    } else cell += ch;
  }
  return rows;
}

describe('csvCell', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('Boston, MA')).toBe('"Boston, MA"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
  });
  it('stops spreadsheet formulas', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('@x')).toBe("'@x");
  });
});

describe('buildExpensesCsv', () => {
  const lines = [
    line({
      id: 'a',
      rowNumber: 1,
      receipts: [receipt({ fileName: 'folio.pdf' })],
      category: 'lodging',
      paymentType: 'companyCard',
      amountCents: 61244,
      vendor: 'Harbor Hotel'
    }),
    line({
      id: 'b',
      rowNumber: 2,
      receipts: [],
      sameReceiptAsRow: 1,
      category: 'meals',
      paymentType: 'companyCard',
      amountCents: 4210,
      vendor: 'Harbor Hotel restaurant'
    }),
    line({
      id: 'c',
      rowNumber: 3,
      receipts: [],
      noReceiptReason: 'Taxi driver had no receipts',
      category: 'transportation',
      paymentType: 'personal',
      amountCents: 3500,
      vendor: 'City Taxi'
    })
  ];
  const csv = buildExpensesCsv({
    report: report(),
    lines,
    submissionNumber: 1,
    submitterName: 'Jane Doe',
    submitterEmail: 'jane.doe@example.com',
    submittedOn: '2026-10-16 09:00',
    warnings: []
  });
  const rows = parseCsv(csv.slice(1));
  const header = CSV_COLUMNS as readonly string[];
  const cellOf = (rowIndex: number, name: string) => rows[rowIndex][header.indexOf(name)];

  it('starts with a byte-order mark and uses CRLF line endings', () => {
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('has one header row and one row per expense', () => {
    expect(rows[0]).toEqual([...CSV_COLUMNS]);
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.length === CSV_COLUMNS.length)).toBe(true);
  });

  it('repeats the trip details and fills the QuickBooks suggestions', () => {
    const at = (name: string) => cellOf(1, name);
    expect(at('Report')).toBe('TR-0042');
    expect(at('Trip purpose')).toBe('NSF Phase I project work');
    expect(at('Suggested class')).toBe('1.01 NSF Phase 1 SBIR');
    expect(at('Suggested QuickBooks account')).toBe('6102 Lodging');
    expect(at('Suggested payment account')).toBe('Credit Cards');
    expect(at('Amount')).toBe('612.44');
    expect(at('Reimbursable')).toBe('No');
    expect(at('Receipt files')).toBe('R01_folio.pdf');
    expect(at('Destination')).toBe('Boston, MA');
    expect(at('Certified by')).toBe('Jane Doe (jane.doe@example.com)');
  });

  it('lists a shared receipt on each row that uses it, and leaves the payment account blank for personal rows', () => {
    expect(cellOf(2, 'Receipt files')).toBe('R01_folio.pdf');
    expect(cellOf(3, 'Suggested payment account')).toBe('');
    expect(cellOf(3, 'No-receipt reason')).toBe('Taxi driver had no receipts');
    expect(cellOf(3, 'Reimbursable')).toBe('Yes');
  });
});
