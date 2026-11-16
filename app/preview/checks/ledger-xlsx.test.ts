// Opens the Ledger's Excel download in a real spreadsheet program (LibreOffice, when it is installed) and checks that the
// cells came out right: the header, money as money, text kept as text (never run as a formula) and a real link. Lives here,
// not beside the other unit tests, because it needs Node's file and process modules, which the SharePoint build does not.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildLedgerWorkbook } from '../../src/export/ledgerExport';
import { ledgerRow, line } from '../../src/testing/builders';

const posted = ledgerRow({
  requestNumber: 'PR-0042',
  receipts: [{ fileName: 'R01_hosting.pdf', url: 'https://contoso.sharepoint.com/Purchase_Receipts/PR-0042/R01_hosting.pdf' }],
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

describe('the Ledger download in a spreadsheet program', () => {
  it('opens with the right cells (when LibreOffice is installed)', () => {
    let soffice = '';
    try {
      soffice = execFileSync('which', ['soffice'], { encoding: 'utf8' }).trim();
    } catch {
      return; // Not installed here: the unit tests of the writer still hold.
    }
    const dir = mkdtempSync(join(tmpdir(), 'ledger-xlsx-'));
    writeFileSync(join(dir, 'ledger.xlsx'), buildLedgerWorkbook([posted, ledgerRow()]));
    execFileSync(soffice, ['--headless', '--convert-to', 'html', '--outdir', dir, join(dir, 'ledger.xlsx')], { stdio: 'ignore', timeout: 120000 });
    const html = readFileSync(join(dir, 'ledger.html'), 'utf8');
    expect(html).toContain('<b>Posted</b>');
    expect(html).toContain('$348.00');
    expect(html).toContain('=HYPERLINK(&quot;http://evil.example&quot;');
    expect(html).toContain('<a href="https://contoso.sharepoint.com/Purchase_Receipts/PR-0042/R01_hosting.pdf">R01_hosting.pdf</a>');
    expect(html).not.toContain('href="http://evil.example');
  }, 150000);
});
