// What the Ledger's "Download Excel" holds: one row per purchase line, with what a bookkeeper needs to post it to
// QuickBooks and a link to each receipt (P-052). Built from the rows on screen, so it matches what was seen.

import { LedgerRow, effectiveAccount, ledgerPaidBy } from '../domain/ledger';
import { centsToPlain } from '../domain/money';
import { categoryText, findCategory } from '../domain/purchaseRules';
import { XlsxCell, buildXlsx } from './xlsx';

/** Posted first, then the bookkeeper's columns, then the purchase, then where it came from. */
export const LEDGER_COLUMNS = [
  'Posted',
  'Posted by',
  'Posted on',
  'Request',
  'Row',
  'Date',
  'Vendor',
  'What was bought and why',
  'QuickBooks account',
  'Class',
  'Quantity',
  'Amount',
  'Who paid',
  'Reimbursable',
  'Category',
  'Category confirmed by',
  'Project or grant code',
  'Receipt',
  'Receipt files',
  'No-receipt reason',
  'Item link',
  'Business purpose',
  'Department',
  'Submitted by',
  'Submitted on',
  'Approved by',
  'Approved on',
  'Submission',
  'Request status'
] as const;

const WIDTHS: Record<(typeof LEDGER_COLUMNS)[number], number> = {
  Posted: 9,
  'Posted by': 16,
  'Posted on': 17,
  Request: 10,
  Row: 5,
  Date: 11,
  Vendor: 24,
  'What was bought and why': 42,
  'QuickBooks account': 36,
  Class: 34,
  Quantity: 9,
  Amount: 12,
  'Who paid': 10,
  Reimbursable: 12,
  Category: 28,
  'Category confirmed by': 18,
  'Project or grant code': 24,
  Receipt: 34,
  'Receipt files': 40,
  'No-receipt reason': 24,
  'Item link': 36,
  'Business purpose': 36,
  Department: 14,
  'Submitted by': 16,
  'Submitted on': 17,
  'Approved by': 16,
  'Approved on': 17,
  Submission: 11,
  'Request status': 14
};

/** The cells of one row, in the order of LEDGER_COLUMNS. The first receipt is a link; every receipt file is named in the next column. */
export function ledgerCells(row: LedgerRow): XlsxCell[] {
  const paid = ledgerPaidBy(row);
  const first = row.receipts[0];
  const category = findCategory(row.line.category);
  const values: Record<(typeof LEDGER_COLUMNS)[number], XlsxCell> = {
    Posted: row.entry.posted ? 'Y' : 'N',
    'Posted by': row.entry.postedBy,
    'Posted on': row.entry.postedOn,
    Request: row.requestNumber,
    Row: row.line.rowNumber,
    Date: row.line.date,
    Vendor: row.line.vendor,
    'What was bought and why': row.line.description,
    'QuickBooks account': effectiveAccount(row),
    Class: row.entry.className,
    Quantity: row.line.quantity,
    Amount: row.line.amountCents === null ? null : { dollars: Number(centsToPlain(row.line.amountCents)) },
    'Who paid': paid ? paid.label : '',
    Reimbursable: paid ? (paid.reimbursable ? 'Yes' : 'No') : '',
    Category: category ? categoryText(row.line.category, row.line.categoryOther) : '',
    'Category confirmed by': row.line.categoryConfirmedBy,
    'Project or grant code': row.projectCode,
    Receipt: first ? (first.url ? { text: first.fileName, url: first.url } : first.fileName) : '',
    'Receipt files': row.receipts.map((r) => r.fileName).join('; '),
    'No-receipt reason': row.line.noReceiptReason,
    'Item link': row.line.itemLink,
    'Business purpose': row.businessPurpose,
    Department: row.department,
    'Submitted by': row.submitterName,
    'Submitted on': row.submittedOn,
    'Approved by': row.approvedBy,
    'Approved on': row.approvedOn,
    Submission: row.submissionNumber,
    'Request status': row.requestStatus
  };
  return LEDGER_COLUMNS.map((c) => values[c]);
}

/** The workbook for these rows, in the order given. */
export function buildLedgerWorkbook(rows: readonly LedgerRow[], modified: Date = new Date()): Uint8Array {
  return buildXlsx({ name: 'Purchases ledger', header: LEDGER_COLUMNS, rows: rows.map(ledgerCells), widths: LEDGER_COLUMNS.map((c) => WIDTHS[c]) }, modified);
}

/** "Purchases_Ledger_2026-11-16.xlsx" */
export function ledgerFileName(today: string): string {
  return `Purchases_Ledger_${today}.xlsx`;
}
