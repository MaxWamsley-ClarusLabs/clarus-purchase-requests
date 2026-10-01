import { ACCOUNT_COLUMN, CSV_COLUMNS, approverText, buildPurchasesCsv, csvCell } from './csv';
import { vendorKey } from '../domain/purchaseRules';
import { ApprovalRecord } from '../domain/types';
import { file, line, quote, request } from '../testing/builders';

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
    expect(csvCell('Pipettes, tips')).toBe('"Pipettes, tips"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
  });
  it('stops spreadsheet formulas', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('@x')).toBe("'@x");
  });
});

// Acme's vendor total is $1,000.00: approved, and bought before approval. Borealis is small.
const approval: ApprovalRecord = {
  sent: [{ key: vendorKey('Acme Lab Supply'), vendor: 'Acme Lab Supply', cents: 100000, bought: true }],
  approved: [{ key: vendorKey('Acme Lab Supply'), vendor: 'Acme Lab Supply', cents: 100000, bought: true }],
  earlier: []
};

describe('buildPurchasesCsv', () => {
  const lines = [
    line({
      id: 'a',
      rowNumber: 1,
      vendor: 'Acme Lab Supply',
      description: 'Pipette tips, 10 boxes',
      files: [quote({ fileName: 'quote.pdf' }), file({ fileName: 'invoice.pdf' })],
      category: 'rdMaterials',
      categoryConfirmedBy: 'Max Wamsley',
      amountCents: 61244,
      paidBy: 'company'
    }),
    line({
      id: 'b',
      rowNumber: 2,
      vendor: 'Acme Lab Supply',
      description: 'Centrifuge tubes',
      files: [],
      sameReceiptAsRow: 1,
      amountCents: 38756,
      paidBy: 'company'
    }),
    line({
      id: 'c',
      rowNumber: 3,
      vendor: 'Borealis Office',
      description: 'Printer paper',
      files: [],
      noReceiptReason: 'Clerk gave no receipt',
      category: 'office',
      amountCents: 3500,
      paidBy: 'employee'
    }),
    line({
      id: 'd',
      rowNumber: 4,
      vendor: 'Cedar Advisors',
      description: 'Safety audit',
      category: 'other',
      categoryOther: 'Lab safety audit',
      amountCents: 9900,
      paidBy: 'company',
      files: [file({ id: 'f4', fileName: 'audit.pdf', fingerprint: 'd' })]
    })
  ];
  const approved = request({
    status: 'Approved',
    approval,
    approvedBy: 'Max Wamsley',
    approvedByEmail: 'max.wamsley@example.com',
    approvedOn: '2026-10-14 10:05',
    boughtBeforeApproval: true,
    projectCode: 'NSF SBIR Phase 1 (Award # 2528301)'
  });
  const csv = buildPurchasesCsv({
    request: approved,
    lines,
    submissionNumber: 1,
    submitterName: 'Jane Doe',
    submittedOn: '2026-10-16 09:00',
    certifiedBy: { name: 'Jane Doe', email: 'jane.doe@example.com' },
    warnings: []
  });
  const rows = parseCsv(csv.slice(1));
  const header = CSV_COLUMNS as readonly string[];
  const cellOf = (rowIndex: number, name: string) => rows[rowIndex][header.indexOf(name)];

  it('starts with a byte-order mark and uses CRLF line endings', () => {
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
  });

  it('has one header row and one row per purchase, with the agreed columns', () => {
    expect(rows[0]).toEqual([...CSV_COLUMNS]);
    expect(CSV_COLUMNS).toHaveLength(31);
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.length === CSV_COLUMNS.length)).toBe(true);
  });

  it('names the QuickBooks account column exactly (P-038), in the ninth column', () => {
    expect(ACCOUNT_COLUMN).toBe('QuickBooks account');
    expect(rows[0][8]).toBe('QuickBooks account');
    expect(csv.slice(1).split('\r\n')[0]).toContain(',QuickBooks account,Amount,');
    expect(rows[0].slice(0, 10)).toEqual([
      'Request',
      'Row',
      'Date',
      'Vendor',
      'What was bought and why',
      'Item link',
      'Category',
      'Category confirmed by',
      ACCOUNT_COLUMN,
      'Amount'
    ]);
  });

  it('has the category, the account, the grant code, the approval status and the approver (P-009, P-038)', () => {
    const at = (name: string) => cellOf(1, name);
    expect(at('Request')).toBe('PR-0042');
    expect(at('What was bought and why')).toBe('Pipette tips, 10 boxes');
    expect(at('Category')).toBe('R&D Materials & Supplies');
    expect(at('Category confirmed by')).toBe('Max Wamsley');
    expect(at(ACCOUNT_COLUMN)).toBe('6182 R&D Materials & Supplies');
    expect(at('Project or grant code')).toBe('NSF SBIR Phase 1 (Award # 2528301)');
    expect(at('Approval status')).toBe('Approved');
    expect(at('Approved by')).toBe('Max Wamsley');
    expect(at('Approved on')).toBe('2026-10-14 10:05');
    expect(at('Amount')).toBe('612.44');
    expect(at('Who bought')).toBe('Employee');
    expect(at('Who paid')).toBe('Company');
    expect(at('Reimbursable')).toBe('No');
    expect(at('Certified by')).toBe('Jane Doe (jane.doe@example.com)');
    expect(at('Department')).toBe('R&D');
    expect(at('Purchase dates')).toBe('2026-10-12');
  });

  it('flags a purchase bought before approval on every line of that vendor, and only those (P-017)', () => {
    expect(cellOf(1, 'Bought before approval')).toBe('Yes');
    expect(cellOf(2, 'Bought before approval')).toBe('Yes');
    expect(cellOf(3, 'Bought before approval')).toBe('No');
  });

  it('gives each line the approval status of its vendor total', () => {
    expect(cellOf(2, 'Approval status')).toBe('Approved');
    expect(cellOf(3, 'Approval status')).toBe('Not required');
    expect(cellOf(3, 'Approved by')).toBe('');
  });

  it('lists quote and receipt copies apart, and a shared receipt on each row that uses it', () => {
    expect(cellOf(1, 'Quote files')).toBe('Q01_quote.pdf');
    expect(cellOf(1, 'Receipt files')).toBe('R01_invoice.pdf');
    expect(cellOf(2, 'Receipt files')).toBe('R01_invoice.pdf');
    expect(cellOf(2, 'Quote files')).toBe('');
    expect(cellOf(3, 'No-receipt reason')).toBe('Clerk gave no receipt');
    expect(cellOf(3, 'Reimbursable')).toBe('Yes');
  });

  it('writes Other with its description, and says the administrator decides the account (P-038)', () => {
    expect(cellOf(4, 'Category')).toBe('Other: Lab safety audit');
    expect(cellOf(4, ACCOUNT_COLUMN)).toBe('Administrator decides');
    expect(cellOf(3, 'Category confirmed by')).toBe('');
    expect(cellOf(3, ACCOUNT_COLUMN)).toBe('6180 Office Supplies');
  });

  it('marks a self-approval (P-020)', () => {
    expect(approverText(approved)).toBe('Max Wamsley');
    expect(approverText({ ...approved, ownerEmail: 'max.wamsley@example.com' })).toBe('Max Wamsley (self-approved)');
    expect(approverText({ approvedBy: '', approvedByEmail: '', ownerEmail: 'a@x.com' })).toBe('');
  });

  it('carries request-level warnings on every row and row warnings on their own row', () => {
    const warned = buildPurchasesCsv({
      request: approved,
      lines: [lines[0], lines[2]],
      submissionNumber: 2,
      submitterName: 'Jane Doe',
      submittedOn: '2026-10-16 09:00',
      certifiedBy: { name: 'Jane Doe', email: 'jane.doe@example.com' },
      warnings: [
        {
          severity: 'warning',
          scope: 'row',
          field: 'amount',
          lineId: 'c',
          rowNumber: 3,
          message: 'Same date, vendor and amount as row 9. Check it is not entered twice.'
        }
      ]
    });
    const parsed = parseCsv(warned.slice(1));
    expect(parsed[1][header.indexOf('Warnings')]).toBe('');
    expect(parsed[2][header.indexOf('Warnings')]).toContain('Same date, vendor and amount as row 9');
    expect(parsed[1][header.indexOf('Submission')]).toBe('2');
  });
});

describe('buildPurchasesCsv when the approver buys (P-037, P-039, P-040)', () => {
  const approverRequest = request({
    buyer: 'approver',
    status: 'Approved',
    approval: { sent: [], approved: [{ key: vendorKey('Acme Lab Supply'), vendor: 'Acme Lab Supply', cents: 12500, bought: false }], earlier: [] },
    approvedBy: 'Max Wamsley',
    approvedByEmail: 'max.wamsley@example.com',
    approvedOn: '2026-10-14 10:05'
  });
  const lines = [
    line({ id: 'a', rowNumber: 1, itemLink: 'https://www.example.com/item/42', paidBy: 'employee', category: 'equipment', files: [file()] }),
    line({
      id: 'b',
      rowNumber: 2,
      vendor: 'Local Hardware',
      amountCents: 800,
      itemLink: '',
      noLinkReason: 'Not sold online',
      paidBy: '',
      category: 'repairs',
      files: [file({ id: 'f2', fileName: 'r2.pdf', fingerprint: 'b' })]
    })
  ];
  const csv = buildPurchasesCsv({
    request: approverRequest,
    lines,
    submissionNumber: 1,
    submitterName: 'Max Wamsley',
    submittedOn: '2026-10-16 09:00',
    certifiedBy: { name: 'Jane Doe', email: 'jane.doe@example.com' },
    warnings: []
  });
  const rows = parseCsv(csv.slice(1));
  const header = CSV_COLUMNS as readonly string[];
  const at = (rowIndex: number, name: string) => rows[rowIndex][header.indexOf(name)];

  it('says the approver bought it, and counts the company as the payer on every row, whatever is stored', () => {
    for (const i of [1, 2]) {
      expect(at(i, 'Who bought')).toBe('Approver');
      expect(at(i, 'Who paid')).toBe('Company');
      expect(at(i, 'Reimbursable')).toBe('No');
      expect(at(i, 'Approval status')).toBe('Approved');
      expect(at(i, 'Bought before approval')).toBe('No');
    }
  });

  it('names the approver as the one who submitted and the employee as the one who certified', () => {
    expect(at(1, 'Submitted by')).toBe('Max Wamsley');
    expect(at(1, 'Certified by')).toBe('Jane Doe (jane.doe@example.com)');
    expect(at(1, 'Approved by')).toBe('Max Wamsley');
  });

  it('carries the item link, or the reason there is none', () => {
    expect(at(1, 'Item link')).toBe('https://www.example.com/item/42');
    expect(at(2, 'Item link')).toBe('');
    expect(at(2, 'No-link reason')).toBe('Not sold online');
  });

  it('says the administrator decides Equipment, and gives the repairs account', () => {
    expect(at(1, ACCOUNT_COLUMN)).toContain('6175 Equipment');
    expect(at(1, ACCOUNT_COLUMN)).toContain('administrator decides');
    expect(at(2, ACCOUNT_COLUMN)).toBe('6170 Repairs & maintenance');
  });

  it('stops a link typed into the list from running as a formula', () => {
    const hostile = buildPurchasesCsv({
      request: approverRequest,
      lines: [line({ id: 'a', itemLink: '=HYPERLINK("http://evil.example")' })],
      submissionNumber: 1,
      submitterName: 'Max Wamsley',
      submittedOn: '2026-10-16 09:00',
      certifiedBy: { name: 'Jane Doe', email: 'jane.doe@example.com' },
      warnings: []
    });
    expect(parseCsv(hostile.slice(1))[1][header.indexOf('Item link')]).toBe(`'=HYPERLINK("http://evil.example")`);
  });
});
