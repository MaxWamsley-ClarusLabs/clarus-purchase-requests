// The emails' subjects and summaries (travel D-046; P-018). The flow adds the
// heading and the links, escapes the summary and sends it (travel D-067). Two
// emails: the approval email to the approvers when a request is sent for
// approval, and the submission email to the administrator. The item link is
// left out of both: a web address an employee typed, in an email to the
// approver, is the easiest way to mislead them, so it is shown only in the app
// and the CSV (P-039).

import { dateRangeText } from '../domain/dates';
import { formatCents } from '../domain/money';
import { hasReceipt, hasQuote } from '../domain/receipts';
import { ApprovalGroup, BuyerId, PurchaseLine, PurchaseRequest } from '../domain/types';
import { APPROVAL_THRESHOLD_TEXT, categoryNeedsReview, categoryText, findPaidBy, isSelfApproved, sameAsSent, vendorGroups } from '../domain/purchaseRules';
import { Totals } from '../domain/totals';
import { Issue, issuePrefix } from '../domain/validation';

const SUBJECT_PURPOSE_MAX = 70;

/** A business purpose shortened for an email subject. */
export function shortPurpose(text: string): string {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length <= SUBJECT_PURPOSE_MAX ? one : `${one.slice(0, SUBJECT_PURPOSE_MAX - 3).trimEnd()}...`;
}

/** For a request the approver bought (P-037), the subject names the employee who asked, and says it was bought. */
export function submissionEmailSubject(
  submitterName: string,
  businessPurpose: string,
  requestNo: string,
  submissionNumber: number,
  buyer: BuyerId = 'self'
): string {
  const purpose = shortPurpose(businessPurpose);
  const what = buyer === 'approver' ? 'Purchase request bought' : 'Purchase request submitted';
  const again = buyer === 'approver' ? 'Purchase request bought again' : 'Purchase request resubmitted';
  return submissionNumber > 1
    ? `${again}: ${submitterName}, ${purpose} (${requestNo}, R${submissionNumber})`
    : `${what}: ${submitterName}, ${purpose} (${requestNo})`;
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

/** "row 2" for one row, "rows 1, 2" for several. */
function rowsText(rowNumbers: readonly number[]): string {
  return rowNumbers.length === 1 ? `row ${rowNumbers[0]}` : `rows ${rowNumbers.join(', ')}`;
}

/**
 * One line of text: line breaks and runs of spaces become one space. The app
 * keeps these fields on one line, but an employee can edit their own items
 * directly (travel D-002), and a line break in an email line could start a
 * line that looks like the app wrote it, such as the approval or the
 * certification.
 */
export function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** The request and rows with every one-line text field made one line, for the email text. */
function plain(request: PurchaseRequest, lines: readonly PurchaseLine[]): { request: PurchaseRequest; lines: PurchaseLine[] } {
  return {
    request: {
      ...request,
      businessPurpose: oneLine(request.businessPurpose),
      department: oneLine(request.department),
      projectCode: oneLine(request.projectCode),
      ownerName: oneLine(request.ownerName),
      approvedBy: oneLine(request.approvedBy),
      approvalNote: oneLine(request.approvalNote)
    },
    lines: lines.map((l) => ({
      ...l,
      vendor: oneLine(l.vendor),
      description: oneLine(l.description),
      categoryOther: oneLine(l.categoryOther),
      noQuoteReason: oneLine(l.noQuoteReason),
      noReceiptReason: oneLine(l.noReceiptReason)
    }))
  };
}

function boughtBeforeText(groups: readonly ApprovalGroup[]): string {
  return groups
    .filter((g) => g.bought)
    .map((g) => `${oneLine(g.vendor) || 'a purchase with no vendor'} (${formatCents(g.cents)})`)
    .join(', ');
}

export interface ApprovalEmailInput {
  request: PurchaseRequest;
  lines: readonly PurchaseLine[];
  totals: Totals;
  submitterName: string;
  submitterEmail: string;
  /** When the approver buys (P-037), the email says so and what approving means. Default: the employee buys. */
  buyer?: BuyerId;
  /** 1 for the first time it is sent for approval, 2 the next time (after a return, or after a rise past what was approved), and so on. */
  round: number;
  sentOn: string;
  /** The vendor totals that need approval, flagged when already bought (P-017). */
  groups: readonly ApprovalGroup[];
  /** What the employee certified when sending a request the approver buys (P-037); shown at the end. */
  certification?: { name: string; email: string; text: string };
}

/**
 * The approval email's summary, as plain text. The flow escapes it and turns
 * line breaks into HTML line breaks before sending, so nothing stored in the
 * list, which employees can edit directly (travel D-002), is ever sent as HTML.
 */
export function buildApprovalEmailSummary(input: ApprovalEmailInput): string {
  const { request, lines } = plain(input.request, input.lines);
  const buyer = input.buyer ?? 'self';
  const totals = input.totals;
  const byKey = new Map(vendorGroups(lines, buyer).map((g) => [g.key, g]));
  const out: string[] = [];
  out.push(`Requested by: ${oneLine(input.submitterName)} (${oneLine(input.submitterEmail)})`);
  header(out, request, lines);
  out.push(`Sent for approval: ${input.sentOn}${input.round > 1 ? ` (round ${input.round}, sent again)` : ''}`);
  out.push('');
  if (buyer === 'approver') {
    out.push('The approver buys this request. Approving it means you buy it, attach the receipt and mark it purchased.');
    out.push('');
    out.push('Every vendor total needs your approval, whatever the amount:');
  } else {
    out.push(`Needs your approval (vendor totals of ${APPROVAL_THRESHOLD_TEXT} or more):`);
  }
  for (const group of input.groups) {
    const vendorLines = (byKey.get(group.key)?.lineIds ?? []).map((id) => lines.find((l) => l.id === id)).filter((l): l is PurchaseLine => !!l);
    const reasons = vendorLines.map((l) => l.noQuoteReason.trim()).filter((r) => r);
    // A quote is asked for at QUOTE_THRESHOLD_TEXT or more, so a smaller vendor total says nothing about one (P-015).
    const quote = !byKey.get(group.key)?.needsQuote
      ? ''
      : vendorLines.some((l) => hasQuote(l))
        ? ' (quote attached)'
        : reasons.length > 0
          ? ` (no quote: ${reasons[0]})`
          : ' (no quote)';
    out.push(`- ${oneLine(group.vendor) || 'A purchase with no vendor'}: ${formatCents(group.cents)}${quote}`);
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
    const amount = l.amountCents === null ? 'no amount' : formatCents(l.amountCents);
    const category = categoryText(l.category, l.categoryOther) || 'no category';
    // Nobody is asked who paid when the approver buys, and the item link is only in the app (P-037, P-039).
    const paid = buyer === 'approver' ? '' : `, ${findPaidBy(l.paidBy)?.label ?? 'who paid not chosen'}`;
    out.push(`${l.rowNumber}. ${l.date}, ${l.vendor}, ${l.description}, ${amount}${paid}, ${category}`);
  }
  if (input.certification) {
    out.push(
      '',
      `Certified by ${oneLine(input.certification.name)} (${oneLine(input.certification.email)}) when sent, ${input.sentOn}:`,
      `"${oneLine(input.certification.text)}"`
    );
  }
  return out.join('\n');
}

export interface SubmissionEmailInput {
  request: PurchaseRequest;
  lines: readonly PurchaseLine[];
  totals: Totals;
  /** Who submitted the package: the employee, or the approver who bought it (P-037). */
  submitterName: string;
  /** The submitting account; the certifying account when absent, because the employee submits and certifies at once (travel D-064). */
  submitterEmail?: string;
  /** Who bought it. Default: the employee. */
  buyer?: BuyerId;
  /**
   * What the employee certified (travel D-064): at Submit when the employee
   * buys, when the request was sent to the approver when the approver buys.
   * `name` is who certified, the submitter when absent.
   */
  certification: { email: string; text: string; submittedOn: string; name?: string };
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
  const { request, lines } = plain(input.request, input.lines);
  const { totals } = input;
  const approverBought = input.buyer === 'approver';
  const noReceipt = lines.filter((l) => !hasReceipt(l, lines));
  const out: string[] = [];
  if (approverBought) {
    out.push(`Bought by the approver: ${oneLine(input.submitterName)} (${oneLine(input.submitterEmail ?? input.certification.email)})`);
    out.push(`Requested by: ${request.ownerName} (${oneLine(request.ownerEmail)})`);
  } else {
    out.push(`Submitted by: ${oneLine(input.submitterName)} (${oneLine(input.certification.email)})`);
  }
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
  // The rows the employee sent are kept with the approval (P-040); the administrator should know the approver changed them.
  const sentRows = request.approval.rows ?? [];
  if (approverBought && sentRows.length > 0 && !sameAsSent(input.lines, sentRows)) {
    out.push('The approver changed the rows after the employee sent the request. The request page in Purchase Requests shows the rows as sent and as bought.');
  }
  const bought = request.approval.approved.some((g) => g.bought) ? request.approval.approved : request.approval.sent;
  if (!approverBought && bought.some((g) => g.bought)) {
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
      `Categories only suggested by the employee (not confirmed by an approver or administrator): ${rowsText(unconfirmed.map((l) => l.rowNumber))}.`
    );
  }
  // Rows whose account is the administrator's decision and has not been confirmed (P-038) must be confirmed before the request is marked processed.
  const review = lines.filter((l) => categoryNeedsReview(l.category) && !l.categoryConfirmedBy);
  if (review.length > 0) {
    out.push(
      '',
      `The administrator must confirm the category before this is marked processed (the account depends on a decision): ${rowsText(review.map((l) => l.rowNumber))}.`
    );
  }
  if (input.warnings.length > 0) {
    out.push('', approverBought ? 'Warnings:' : 'Warnings the employee submitted with:');
    for (const w of input.warnings) out.push(`- ${issuePrefix(w)}${oneLine(w.message)}`);
  }
  const certifier = oneLine(input.certification.name ?? input.submitterName);
  out.push(
    '',
    approverBought
      ? `Certified by ${certifier} (${oneLine(input.certification.email)}) when the request was sent, ${input.certification.submittedOn}:`
      : `Certified by ${certifier} at submission, ${input.certification.submittedOn}:`,
    `"${oneLine(input.certification.text)}"`
  );
  if (input.previousFolderName) out.push('', `This replaces the earlier folder: ${oneLine(input.previousFolderName)}`);
  return out.join('\n');
}
