// The purchases CSV in each request folder (travel D-045, D-048; P-009, P-026).
// UTF-8 with a byte-order mark, commas, CRLF line endings, one header row,
// YYYY-MM-DD dates and plain two-decimal amounts. The suggested QuickBooks
// account is UNVERIFIED, TO CONFIRM WITH MAX (purchaseRules.ts, P-025), and
// its column header says so.

import { dateRangeText } from '../domain/dates';
import { centsToPlain } from '../domain/money';
import { fileNamesForRow } from '../domain/naming';
import { LINE_APPROVAL_DISPLAY } from '../domain/statuses';
import { QUICKBOOKS_MAPPING_STATUS, categoryText, findCategory, findPaidBy, isSelfApproved, lineApprovals } from '../domain/purchaseRules';
import { Issue } from '../domain/validation';
import { PurchaseLine, PurchaseRequest } from '../domain/types';

/** "Suggested QuickBooks account (Unverified, to confirm with Max)": the mapping's status is part of the header wherever the CSV is opened. */
export const SUGGESTED_ACCOUNT_COLUMN = `Suggested QuickBooks account (${QUICKBOOKS_MAPPING_STATUS})` as const;

// Purchase columns come first so the useful part is visible when the file is
// opened in Excel; the request columns repeat on every row after them (travel D-048).
export const CSV_COLUMNS = [
  'Request',
  'Row',
  'Date',
  'Vendor',
  'What was bought and why',
  'Category',
  'Category confirmed by',
  SUGGESTED_ACCOUNT_COLUMN,
  'Amount',
  'Who paid',
  'Reimbursable',
  'Project or grant code',
  'Approval status',
  'Bought before approval',
  'Approved by',
  'Approved on',
  'Quote files',
  'Receipt files',
  'No-quote reason',
  'No-receipt reason',
  'Warnings',
  'Submission',
  'Submitted by',
  'Submitted on',
  'Department',
  'Purchase dates',
  'Business purpose',
  'Certified by'
] as const;

/**
 * Quotes a value when needed. Text that a spreadsheet could read as a formula
 * (starting with = + - @ or a control character) gets a leading apostrophe, so
 * opening the file in Excel never runs anything.
 */
export function csvCell(value: string): string {
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export interface CsvInput {
  request: PurchaseRequest;
  lines: readonly PurchaseLine[];
  submissionNumber: number;
  submitterName: string;
  /** The account that certified the request at Submit (travel D-064). */
  submitterEmail: string;
  submittedOn: string;
  /** Warnings shown to the employee at submission; blocking issues cannot exist here. */
  warnings: readonly Issue[];
}

/** "Max Wamsley", or "Max Wamsley (self-approved)" when the approver is the requester (P-020). */
export function approverText(request: Pick<PurchaseRequest, 'approvedBy' | 'approvedByEmail' | 'ownerEmail'>): string {
  if (!request.approvedBy) return '';
  return isSelfApproved(request.ownerEmail, request.approvedByEmail) ? `${request.approvedBy} (self-approved)` : request.approvedBy;
}

export function buildPurchasesCsv(input: CsvInput): string {
  const { request, lines } = input;
  const approvals = lineApprovals(lines, request.status, request.approval);
  const purchaseDates = dateRangeText(lines.map((l) => l.date));
  const rows: string[][] = [CSV_COLUMNS.slice()];
  for (const line of lines) {
    const category = findCategory(line.category);
    const paidBy = findPaidBy(line.paidBy);
    const approval = approvals.get(line.id) ?? { status: 'notRequired' as const, boughtBefore: false };
    const approved = approval.status === 'approved';
    // Request-level warnings repeat on every row, like the request columns (travel D-048).
    const lineWarnings = input.warnings.filter((w) => w.lineId === line.id || w.scope === 'request').map((w) => w.message);
    const values: Record<(typeof CSV_COLUMNS)[number], string> = {
      Request: request.requestNumber,
      Row: String(line.rowNumber),
      Date: line.date,
      Vendor: line.vendor,
      'What was bought and why': line.description,
      Category: categoryText(line.category, line.categoryOther),
      'Category confirmed by': line.categoryConfirmedBy,
      [SUGGESTED_ACCOUNT_COLUMN]: category ? category.suggestedAccount : '',
      Amount: line.amountCents === null ? '' : centsToPlain(line.amountCents),
      'Who paid': paidBy ? paidBy.label : '',
      Reimbursable: paidBy ? (paidBy.reimbursable ? 'Yes' : 'No') : '',
      'Project or grant code': request.projectCode,
      'Approval status': LINE_APPROVAL_DISPLAY[approval.status].label,
      'Bought before approval': approval.boughtBefore ? 'Yes' : 'No',
      'Approved by': approved ? approverText(request) : '',
      'Approved on': approved ? request.approvedOn : '',
      'Quote files': fileNamesForRow(line, lines, 'quote').join('; '),
      'Receipt files': fileNamesForRow(line, lines, 'receipt').join('; '),
      'No-quote reason': line.noQuoteReason,
      'No-receipt reason': line.noReceiptReason,
      Warnings: lineWarnings.join('; '),
      Submission: String(input.submissionNumber),
      'Submitted by': input.submitterName,
      'Submitted on': input.submittedOn,
      Department: request.department,
      'Purchase dates': purchaseDates,
      'Business purpose': request.businessPurpose,
      'Certified by': `${input.submitterName} (${input.submitterEmail})`
    };
    rows.push(CSV_COLUMNS.map((c) => values[c]));
  }
  return '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
