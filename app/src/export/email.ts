// The emails' subjects and summaries (travel D-046; P-018). The flow adds the
// heading and the links, escapes the summary and sends it (travel D-067). Two
// emails: the approval email to the approvers when a request is sent for
// approval, and the submission email to the administrator.

import { dateRangeText } from '../domain/dates';
import { formatCents } from '../domain/money';
import { hasReceipt, hasQuote } from '../domain/receipts';
import { ApprovalGroup, PurchaseLine, PurchaseRequest } from '../domain/types';
import { APPROVAL_THRESHOLD_TEXT, categoryText, findPaidBy, isSelfApproved, vendorGroups } from '../domain/purchaseRules';
import { Totals } from '../domain/totals';
import { Issue, issuePrefix } from '../domain/validation';

const SUBJECT_PURPOSE_MAX = 70;

/** A business purpose shortened for an email subject. */
export function shortPurpose(text: string): string {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length <= SUBJECT_PURPOSE_MAX ? one : `${one.slice(0, SUBJECT_PURPOSE_MAX - 3).trimEnd()}...`;
}

export function submissionEmailSubject(submitterName: string, businessPurpose: string, requestNo: string, submissionNumber: number): string {
  const purpose = shortPurpose(businessPurpose);
  return submissionNumber > 1
    ? `Purchase request resubmitted: ${submitterName}, ${purpose} (${requestNo}, R${submissionNumber})`
    : `Purchase request submitted: ${submitterName}, ${purpose} (${requestNo})`;
}

export function approvalEmailSubject(submitterName: string, businessPurpose: string, requestNo: string, round: number): string {
  const purpose = shortPurpose(businessPurpose);
  return round > 1
    ? `Purchase approval needed again: ${submitterName}, ${purpose} (${requestNo}, round ${round})`
    : `Purchase approval needed: ${submitterName}, ${purpose} (${requestNo})`;
}

function header(out: string[], request: PurchaseRequest, lines: readonly PurchaseLine[]): void {
  out.push(`Department: ${request.department}`);
  out.push(`Business purpose: ${request.businessPurpose}`);
  if (request.projectCode.trim()) out.push(`Project or grant code: ${request.projectCode}`);
  const dates = dateRangeText(lines.map((l) => l.date));
  if (dates) out.push(`Purchase dates: ${dates}`);
}

function totalsBlock(out: string[], totals: Totals): void {
  out.push(`To reimburse: ${formatCents(totals.reimburseCents)}`);
  out.push(`Paid by Clarus: ${formatCents(totals.companyCents)}`);
  out.push(`Request total: ${formatCents(totals.requestCents)}`);
}

function boughtBeforeText(groups: readonly ApprovalGroup[]): string {
  return groups
    .filter((g) => g.bought)
    .map((g) => `${g.vendor || 'a purchase with no vendor'} (${formatCents(g.cents)})`)
    .join(', ');
}

export interface ApprovalEmailInput {
  request: PurchaseRequest;
  lines: readonly PurchaseLine[];
  totals: Totals;
  submitterName: string;
  submitterEmail: string;
  /** 1 for the first time it is sent for approval, 2 the next time (after a return, or after a rise past what was approved), and so on. */
  round: number;
  sentOn: string;
  /** The vendor totals that need approval, flagged when already bought (P-017). */
  groups: readonly ApprovalGroup[];
}

/**
 * The approval email's summary, as plain text. The flow escapes it and turns
 * line breaks into HTML line breaks before sending, so nothing stored in the
 * list, which employees can edit directly (travel D-002), is ever sent as HTML.
 */
export function buildApprovalEmailSummary(input: ApprovalEmailInput): string {
  const { request, lines, totals } = input;
  const byKey = new Map(vendorGroups(lines).map((g) => [g.key, g]));
  const out: string[] = [];
  out.push(`Requested by: ${input.submitterName} (${input.submitterEmail})`);
  header(out, request, lines);
  out.push(`Sent for approval: ${input.sentOn}${input.round > 1 ? ` (round ${input.round}, sent again)` : ''}`);
  out.push('');
  out.push(`Needs your approval (vendor totals of ${APPROVAL_THRESHOLD_TEXT} or more):`);
  for (const group of input.groups) {
    const vendorLines = (byKey.get(group.key)?.lineIds ?? []).map((id) => lines.find((l) => l.id === id)).filter((l): l is PurchaseLine => !!l);
    const reasons = vendorLines.map((l) => l.noQuoteReason.trim()).filter((r) => r);
    const quote = vendorLines.some((l) => hasQuote(l)) ? 'quote attached' : reasons.length > 0 ? `no quote: ${reasons[0]}` : 'no quote';
    out.push(`- ${group.vendor || 'A purchase with no vendor'}: ${formatCents(group.cents)} (${quote})`);
  }
  if (input.groups.some((g) => g.bought)) {
    out.push(
      '',
      `FLAG, bought before approval: ${boughtBeforeText(input.groups)}. The purchase was already made when the request was sent. You can still approve or return it.`
    );
  }
  out.push('');
  totalsBlock(out, totals);
  out.push('', `All purchases (${lines.length}):`);
  for (const l of lines) {
    const paid = findPaidBy(l.paidBy)?.label ?? 'who paid not chosen';
    out.push(
      `${l.rowNumber}. ${l.date}, ${l.vendor}, ${l.description}, ${l.amountCents === null ? 'no amount' : formatCents(l.amountCents)}, ${paid}, ${categoryText(l.category, l.categoryOther) || 'no category'}`
    );
  }
  return out.join('\n');
}

export interface SubmissionEmailInput {
  request: PurchaseRequest;
  lines: readonly PurchaseLine[];
  totals: Totals;
  submitterName: string;
  /** What the employee certified at Submit (travel D-064). */
  certification: { email: string; text: string; submittedOn: string };
  receiptCount: number;
  quoteCount: number;
  warnings: readonly Issue[];
  previousFolderName: string;
}

/**
 * The submission email's summary, as plain text, escaped by the flow. It names
 * the approval (who, when), and flags a purchase bought before approval so the
 * administrator sees it (P-017).
 */
export function buildSubmissionEmailSummary(input: SubmissionEmailInput): string {
  const { request, lines, totals } = input;
  const noReceipt = lines.filter((l) => !hasReceipt(l, lines));
  const out: string[] = [];
  out.push(`Submitted by: ${input.submitterName} (${input.certification.email})`);
  header(out, request, lines);
  out.push('');
  totalsBlock(out, totals);
  out.push('');
  out.push(`Purchases: ${lines.length}. Receipt files: ${input.receiptCount}. Quote files: ${input.quoteCount}.`);
  if (request.approvedBy) {
    const self = isSelfApproved(request.ownerEmail, request.approvedByEmail) ? ' (self-approved)' : '';
    out.push(
      `Approval: approved by ${request.approvedBy}${self} on ${request.approvedOn}.${request.approvalNote.trim() ? ` Note: ${request.approvalNote.trim()}` : ''}`
    );
  } else {
    out.push(`Approval: not needed, every vendor total is under ${APPROVAL_THRESHOLD_TEXT}.`);
  }
  const bought = request.approval.approved.some((g) => g.bought) ? request.approval.approved : request.approval.sent;
  if (bought.some((g) => g.bought)) {
    out.push(`FLAG, bought before approval: ${boughtBeforeText(bought)}. The purchase was already made when the request was sent for approval.`);
  }
  if (noReceipt.length > 0) {
    out.push('', 'Rows without a receipt:');
    for (const l of noReceipt) out.push(`- Row ${l.rowNumber}: ${l.noReceiptReason}`);
  }
  const unconfirmed = lines.filter((l) => !l.categoryConfirmedBy);
  if (unconfirmed.length > 0) {
    out.push(
      '',
      `Categories only suggested by the employee (not confirmed by an approver or administrator): rows ${unconfirmed.map((l) => l.rowNumber).join(', ')}.`
    );
  }
  if (input.warnings.length > 0) {
    out.push('', 'Warnings the employee submitted with:');
    for (const w of input.warnings) out.push(`- ${issuePrefix(w)}${w.message}`);
  }
  out.push('', `Certified by ${input.submitterName} at submission, ${input.certification.submittedOn}:`, `"${input.certification.text}"`);
  if (input.previousFolderName) out.push('', `This replaces the earlier folder: ${input.previousFolderName}`);
  return out.join('\n');
}
