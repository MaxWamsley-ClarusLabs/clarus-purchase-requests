// The purchases CSV in each request folder (travel D-045, D-048; P-009, P-026).
// UTF-8 with a byte-order mark, commas, CRLF line endings, one header row,
// YYYY-MM-DD dates and plain two-decimal amounts. The QuickBooks account is
// the number and exact name from the May 1, 2026 account list Max supplied
// (purchaseRules.ts, P-038), and its column header says where it is from.
// Equipment and Other say that the administrator decides.

import { dateRangeText } from '../domain/dates';
import { centsToPlain } from '../domain/money';
import { fileNamesForRow } from '../domain/naming';
import { LINE_APPROVAL_DISPLAY } from '../domain/statuses';
import { categoryText, findCategory, findPaidBy, isSelfApproved, lineApprovals } from '../domain/purchaseRules';
import { Issue } from '../domain/validation';
import { PurchaseLine, PurchaseRequest } from '../domain/types';

/** The account number and exact name from the category (P-038). Where the mapping comes from is QUICKBOOKS_MAPPING_STATUS, shown on the administrator's CSV tab. */
export const ACCOUNT_COLUMN = 'QuickBooks account' as const;

// Purchase columns come first so the useful part is visible when the file is
// opened in Excel; the request columns repeat on every row after them (travel D-048).
export const CSV_COLUMNS = [
  'Request',
  'Row',
  'Date',
  'Vendor',
  'What was bought and why',
  'Item link',
  'Category',
  'Category confirmed by',
  ACCOUNT_COLUMN,
  'Amount',
  'Who bought',
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
  'No-link reason',
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

/** Who certified the request, and when (travel D-064). The employee, when sending it to the approver who buys it (P-037), or at Submit. */
export interface CertifiedBy {
  name: string;
  /** The signed-in account that ticked the certification. */
  email: string;
}

export interface CsvInput {
  request: PurchaseRequest;
  lines: readonly PurchaseLine[];
  submissionNumber: number;
  /** Who submitted the package: the employee, or the approver who bought it (P-037). */
  submitterName: string;
  submittedOn: string;
  certifiedBy: CertifiedBy;
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
  const approvals = lineApprovals(lines, request.status, request.approval, request.buyer);
  const purchaseDates = dateRangeText(lines.map((l) => l.date));
  const rows: string[][] = [CSV_COLUMNS.slice()];
  for (const line of lines) {
    const category = findCategory(line.category);
    // When the approver buys, the company pays for every row, whatever a row's stored "who paid" says (P-037).
    const paidBy = findPaidBy(request.buyer === 'approver' ? 'company' : line.paidBy);
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
      'Item link': line.itemLink,
      Category: categoryText(line.category, line.categoryOther),
      'Category confirmed by': line.categoryConfirmedBy,
      [ACCOUNT_COLUMN]: category ? category.accountText : '',
      Amount: line.amountCents === null ? '' : centsToPlain(line.amountCents),
      'Who bought': request.buyer === 'approver' ? 'Approver' : 'Employee',
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
      'No-link reason': line.noLinkReason,
      Warnings: lineWarnings.join('; '),
      Submission: String(input.submissionNumber),
      'Submitted by': input.submitterName,
      'Submitted on': input.submittedOn,
      Department: request.department,
      'Purchase dates': purchaseDates,
      'Business purpose': request.businessPurpose,
      'Certified by': `${input.certifiedBy.name} (${input.certifiedBy.email})`
    };
    rows.push(CSV_COLUMNS.map((c) => values[c]));
  }
  return '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
