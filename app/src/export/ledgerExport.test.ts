import { ledgerRow, line } from '../testing/builders';
import { LEDGER_COLUMNS, buildLedgerWorkbook, ledgerCells, ledgerFileName } from './ledgerExport';
import { buildXlsx, columnName, sheetName } from './xlsx';

/** The files inside a zip, read straight from its central directory. The writer stores files without compression. */
function unzip(bytes: Uint8Array): Record<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (view.getUint32(end, true) !== 0x06054b50) end--;
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const out: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    const dataAt = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(dataAt, dataAt + size);
    if (method !== 0) throw new Error(`${name} is compressed, but the writer only stores`);
    out[name] = new TextDecoder().decode(data);
    at += 46 + nameLength + extraLength + commentLength;
  }
  return out;
}

const posted = ledgerRow({
  requestNumber: 'PR-0042',
  receipts: [
    { fileName: 'R01_hosting.pdf', url: 'https://contoso.sharepoint.com/Purchase_Receipts/PR-0042/R01_hosting.pdf' },
    { fileName: 'R01-2_page2.pdf', url: 'https://contoso.sharepoint.com/Purchase_Receipts/PR-0042/R01-2_page2.pdf' }
  ],
  receiptPlace: 'archive',
  line: line({
    id: '5',
    vendor: 'Brightline & Sons <Hosting>',
    description: '=HYPERLINK("http://evil.example","click")',
    quantity: 3,
    amountCents: 34800,
    category: 'subscriptions'
  }),
  entry: { account: '6150 Dues and Subscriptions', className: '5.0 Internal R&D', posted: true, postedBy: 'Bea Keeper', postedOn: '2026-11-16 14:05' }
});

describe('the Ledger download', () => {
  it('has one cell for every column, in order, with money and quantity as numbers', () => {
    const cells = ledgerCells(posted);
    expect(cells).toHaveLength(LEDGER_COLUMNS.length);
    const at = (name: (typeof LEDGER_COLUMNS)[number]) => cells[LEDGER_COLUMNS.indexOf(name)];
    expect(LEDGER_COLUMNS[0]).toBe('Posted');
    expect(at('Posted')).toBe('Y');
    expect(at('Quantity')).toBe(3);
    expect(at('Amount')).toEqual({ dollars: 348 });
    expect(at('QuickBooks account')).toBe('6150 Dues and Subscriptions');
    expect(at('Class')).toBe('5.0 Internal R&D');
    expect(at('Receipt')).toEqual({ text: 'R01_hosting.pdf', url: 'https://contoso.sharepoint.com/Purchase_Receipts/PR-0042/R01_hosting.pdf' });
    expect(at('Receipt files')).toBe('R01_hosting.pdf; R01-2_page2.pdf');
    expect(at('Reimbursable')).toBe('No');
  });

  it('marks a line not posted with N and starts from the category account', () => {
    const cells = ledgerCells(ledgerRow());
    expect(cells[0]).toBe('N');
    expect(cells[LEDGER_COLUMNS.indexOf('QuickBooks account')]).toBe('6182 R&D Materials & Supplies');
    expect(cells[LEDGER_COLUMNS.indexOf('Receipt')]).toBe('');
  });

  it('shows a receipt with no address as its file name only', () => {
    const cells = ledgerCells(ledgerRow({ receipts: [{ fileName: 'R01_x.pdf', url: '' }] }));
    expect(cells[LEDGER_COLUMNS.indexOf('Receipt')]).toBe('R01_x.pdf');
  });

  it('is a real .xlsx: the parts are there, escaped, and the text is never a formula', () => {
    const files = unzip(buildLedgerWorkbook([posted], new Date(2026, 10, 16)));
    expect(Object.keys(files).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/_rels/sheet1.xml.rels',
      'xl/worksheets/sheet1.xml'
    ]);
    const sheet = files['xl/worksheets/sheet1.xml'];
    expect(sheet).toContain('Brightline &amp; Sons &lt;Hosting&gt;');
    // The description that looks like a formula is stored as text in an inline string, not as a formula element.
    expect(sheet).toContain('t="inlineStr"');
    expect(sheet).not.toContain('<f>');
    expect(sheet).toContain(`<hyperlink ref="${columnName(LEDGER_COLUMNS.indexOf('Receipt'))}2" r:id="rId1"/>`);
    expect(files['xl/worksheets/_rels/sheet1.xml.rels']).toContain(
      'Target="https://contoso.sharepoint.com/Purchase_Receipts/PR-0042/R01_hosting.pdf" TargetMode="External"'
    );
    expect(sheet).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
    expect(sheet).toContain(`<autoFilter ref="A1:${columnName(LEDGER_COLUMNS.length - 1)}2"/>`);
  });

  it('drops characters XML does not allow, so Excel never refuses the file', () => {
    const bytes = buildXlsx({ name: 'x', header: ['a'], rows: [['bad\u0001char\u0000 and a lone \uD800 end']] });
    const sheet = unzip(bytes)['xl/worksheets/sheet1.xml'];
    expect(sheet).toContain('badchar and a lone  end');
    expect([...sheet].some((ch) => ch.charCodeAt(0) < 9)).toBe(false);
  });

  it('names columns and sheets the way Excel does', () => {
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnName)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA', 'ZZ', 'AAA']);
    expect(sheetName('Purchases/ledger: [all]*?')).toBe('Purchases ledger   all');
    expect(sheetName('x'.repeat(40))).toHaveLength(31);
    expect(sheetName('   ')).toBe('Sheet1');
  });

  it('is named for the day', () => {
    expect(ledgerFileName('2026-11-16')).toBe('Purchases_Ledger_2026-11-16.xlsx');
  });
});
