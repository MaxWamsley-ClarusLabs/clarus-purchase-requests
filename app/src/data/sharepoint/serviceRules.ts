// Rules the SharePoint service and the mock service apply in exactly the same
// way, so the preview behaves like the real site (docs/DATA_MODEL.md lifecycle
// rules; P-006, P-020, P-024, P-027). Pure functions and plain text only: no
// SharePoint calls and no stored state.

import { messages } from '../../domain/messages';
import {
  CERTIFICATION,
  ITEM_LINK_MAX_LENGTH,
  approvalsSoFar,
  categoryNeedsDescription,
  categoryNeedsReview,
  categoryText,
  findBuyer,
  findCategory,
  findPaidBy
} from '../../domain/purchaseRules';
import { receiptFiles } from '../../domain/receipts';
import { PACKAGE_ATTENTION_MINUTES, STATUS_FOR_SUBMISSION, mayBuy, submissionNeedsAttention } from '../../domain/statuses';
import {
  ApprovalGroup,
  ApprovalRecord,
  BuyerId,
  CategoryId,
  CurrentUser,
  PurchaseLine,
  PurchaseRequest,
  RequestStatus,
  SentRow,
  Submission,
  SubmissionType
} from '../../domain/types';
import { Certification } from '../../export/submission';
import { CategoryChoice, LineChanges, RequestChanges } from '../PurchaseDataService';
import { line255, parseSuggested } from './mapping';

/** The services and the screens use one rule for who may confirm categories (P-024). */
export { canConfirmCategories } from '../../domain/statuses';

/** A call the signed-in person may not make: someone else's request, a locked request, or an administrator-only action. */
export class NotAllowedError extends Error {}

/** The wording of each refusal, so both services say the same thing. */
export const notAllowed = {
  notYours: 'Not your request.',
  locked: 'This request is locked.',
  administratorsOnly: 'Administrators only.',
  draftsOnly: 'Only drafts can be deleted.',
  /** The approver buys the request, so the employee has nothing to submit (P-037). */
  approverBuys: 'The approver buys this request, so there is nothing for you to submit.',
  /** The one who approved a request the approver buys is the one who buys it (P-037). */
  buyerOnly: 'Only the approver who approved this request can change it, attach files to it or mark it purchased.',
  buyWhen: 'Only an approved request that the approver buys can be marked purchased.',
  employeeBuys: 'The employee buys this request, so it is submitted by the employee.',
  /** Who buys is chosen while the request is being made or corrected, not after it has been sent or approved (P-037). */
  buyerLocked: 'Who buys this can be changed only while the request is a draft or has been returned to you.',
  certificationMissing: "The employee's certification is missing from this request. Return it to the employee, who can send it again with the certification.",
  addedRowsFirst: (rows: string) =>
    `You added ${rows} to this request, so it cannot be returned yet. Delete ${rows.startsWith('rows ') ? 'them' : 'it'}, then return it.`,
  reviewFirst: (rows: string) =>
    `Confirm the category of ${rows} first: the account depends on a decision. Use Confirm categories, then mark the request processed.`,
  approveWhen: 'Only a request that is awaiting approval can be approved.',
  changedSinceSent:
    'This request was changed after it was sent for approval, so it cannot be approved as it stands. Return it with a note; the employee can correct it and send it again.',
  returnWhen: 'Only a request that is awaiting approval or submitted can be returned. The approver can also return an approved request they were to buy.',
  confirmWhen: 'Categories can be confirmed only on a request that is awaiting approval, approved or submitted.',
  processWhen: 'Only submitted requests can be marked processed.',
  sharedReceiptHasOwn: 'This row has a receipt of its own. Remove it first, then choose the row whose receipt this row uses.',
  retryNotStuck: `Only an approval email or a package that failed, or that has not finished after ${PACKAGE_ATTENTION_MINUTES} minutes, can be tried again.`,
  retryMovedOn: 'The request has moved on since this was sent, so it cannot be tried again.'
} as const;

/**
 * Which step a return comes at (P-006): the approver returns a request that is
 * awaiting approval, the administrator one that is submitted. The approver who
 * was to buy an approved request may also return it to the employee, which
 * takes the approval back (P-037). Undefined when the request cannot be
 * returned from this status.
 */
export function returnStageFor(status: RequestStatus, buyer: BuyerId = 'self'): 'approval' | 'processing' | undefined {
  if (status === 'Awaiting approval') return 'approval';
  if (status === 'Submitted') return 'processing';
  if (status === 'Approved' && buyer === 'approver') return 'approval';
  return undefined;
}

/**
 * The status a return leaves a request in. A request the approver bought and the
 * administrator returns at processing goes back to the approver, who fixes it
 * and marks it purchased again; every other return goes to the employee
 * (P-037).
 */
export function statusAfterReturn(stage: 'approval' | 'processing', buyer: BuyerId): RequestStatus {
  return stage === 'processing' && buyer === 'approver' ? 'Approved' : 'Returned';
}

/**
 * Why this person may not change a request's rows or files, mark it
 * purchased, or return it from Approved, or '' when they may (P-037, P-040):
 * the approver who approved a request the approver buys, while it is approved.
 */
export function buyRefusal(
  request: Pick<PurchaseRequest, 'buyer' | 'status' | 'approvedByEmail'>,
  user: Pick<CurrentUser, 'email' | 'isAdministrator'>
): string {
  if (!user.isAdministrator) return notAllowed.administratorsOnly;
  if (request.buyer !== 'approver') return notAllowed.employeeBuys;
  if (request.status !== 'Approved') return notAllowed.buyWhen;
  return mayBuy(request, user) ? '' : notAllowed.buyerOnly;
}

/** The rows whose account depends on a decision and that nobody has confirmed yet, which hold up "Mark processed" (P-038). */
export function rowsToReview(lines: readonly PurchaseLine[]): PurchaseLine[] {
  return lines.filter((l) => categoryNeedsReview(l.category) && !l.categoryConfirmedBy);
}

/** "row 2" or "rows 1 and 3", for a refusal. */
export function rowsPhrase(rows: readonly PurchaseLine[]): string {
  const numbers = [...rows].sort((a, b) => a.rowNumber - b.rowNumber).map((l) => l.rowNumber);
  if (numbers.length === 1) return `row ${numbers[0]}`;
  return `rows ${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}`;
}

/**
 * What the employee certified when sending a request the approver buys (P-037),
 * from the newest approval request, which keeps it. Throws NotAllowedError when
 * it is not there or is not the current sentence: the approver then returns the
 * request, so the employee sends it again with the tick.
 */
export function employeeCertification(submissions: readonly Submission[], request: Pick<PurchaseRequest, 'ownerName'>): Certification {
  const newest = sortSubmissionsForRequest(submissions.filter((s) => s.type === 'approval'))[0];
  if (!newest || newest.certificationText !== CERTIFICATION || !newest.submitterEmail) throw new NotAllowedError(notAllowed.certificationMissing);
  return { text: newest.certificationText, email: newest.submitterEmail, name: request.ownerName, on: newest.submittedOn };
}

/** The number for a new row. Rows are numbered 1, 2, 3 in the order shown in the grid. */
export function nextRowNumber(lines: readonly PurchaseLine[]): number {
  return lines.reduce((highest, l) => Math.max(highest, l.rowNumber), 0) + 1;
}

// ---- Changes the employee makes ---------------------------------------------

/** A request change as it is stored: one-line text is cut to a column's length. */
export function applyRequestChanges(request: PurchaseRequest, changes: RequestChanges): PurchaseRequest {
  const next = { ...request };
  if (changes.businessPurpose !== undefined) next.businessPurpose = line255(changes.businessPurpose);
  if (changes.department !== undefined) next.department = line255(changes.department);
  if (changes.projectCode !== undefined) next.projectCode = line255(changes.projectCode);
  // A buyer that is not one of the two is ignored, so a bad value cannot turn the approval rules off.
  if (changes.buyer !== undefined && findBuyer(changes.buyer)) next.buyer = changes.buyer;
  return next;
}

const LINE_CHANGE_KEYS: readonly (keyof LineChanges)[] = [
  'date',
  'vendor',
  'description',
  'category',
  'categoryOther',
  'amountCents',
  'paidBy',
  'noQuoteReason',
  'noReceiptReason',
  'itemLink',
  'noLinkReason',
  'sameReceiptAsRow',
  'suggested'
];

/**
 * A row change as it is stored. Only the fields a row change may carry are
 * kept, and a field left undefined is not a change. One-line text is cut to a
 * column's length, a category or way of paying that is not a choice is empty,
 * the amount is in whole cents, a row pointer means a row or nothing, and the
 * suggestions are in the grid's order.
 */
function normalizeLineChanges(changes: LineChanges): LineChanges {
  const kept: Record<string, unknown> = {};
  for (const key of LINE_CHANGE_KEYS) if (changes[key] !== undefined) kept[key] = changes[key];
  const out = kept as LineChanges;
  if (out.vendor !== undefined) out.vendor = line255(out.vendor);
  if (out.description !== undefined) out.description = line255(out.description);
  if (out.categoryOther !== undefined) out.categoryOther = line255(out.categoryOther);
  if (out.noQuoteReason !== undefined) out.noQuoteReason = line255(out.noQuoteReason);
  if (out.noReceiptReason !== undefined) out.noReceiptReason = line255(out.noReceiptReason);
  if (out.noLinkReason !== undefined) out.noLinkReason = line255(out.noLinkReason);
  // A web address is kept whole, never cut to a shorter one that opens another page: one past the longest allowed is kept so the check can refuse it.
  if (out.itemLink !== undefined) out.itemLink = typeof out.itemLink === 'string' ? out.itemLink.slice(0, ITEM_LINK_MAX_LENGTH + 1) : '';
  if (out.category !== undefined && !findCategory(out.category)) out.category = '';
  if (out.paidBy !== undefined && !findPaidBy(out.paidBy)) out.paidBy = '';
  if (out.amountCents !== undefined)
    out.amountCents = typeof out.amountCents === 'number' && Number.isFinite(out.amountCents) ? Math.round(out.amountCents) : null;
  if (out.sameReceiptAsRow !== undefined)
    out.sameReceiptAsRow = typeof out.sameReceiptAsRow === 'number' && out.sameReceiptAsRow > 0 ? Math.round(out.sameReceiptAsRow) : null;
  if (out.suggested !== undefined) out.suggested = parseSuggested(out.suggested.join(','));
  return out;
}

export interface AppliedLineChanges {
  /** The row after the change. */
  line: PurchaseLine;
  /** What is written: the stored form of the change, plus the confirmation if it was cleared. */
  written: Partial<PurchaseLine>;
}

/** Who is changing the row, and for which request (P-037, P-040). */
export interface LineEditor {
  /** Who buys the request the row is in. When the approver buys, "who paid" is always the company. */
  buyer: BuyerId;
  /** Set when the approver changes the row while buying: a category they choose is confirmed by them, not left as the employee's suggestion. */
  approverName?: string;
}

/** The employee changing a row of a request they buy. */
export const EMPLOYEE_EDITS: LineEditor = { buyer: 'self' };

/**
 * Applies the employee's change to a row.
 * - Only a category that needs a description (Other) keeps one: a change to
 *   the category or its description that leaves another category clears the
 *   description (P-024).
 * - A change to the category as written (the category, or the description of
 *   Other) makes it the employee's own suggestion again, so who confirmed it
 *   is cleared (P-024).
 * - A row holds its own receipt files or uses another row's, never both
 *   (travel D-038): pointing a row that holds a receipt at another row is
 *   refused with NotAllowedError, before anything is written.
 */
export function applyLineChanges(line: PurchaseLine, changes: LineChanges, editor: LineEditor = EMPLOYEE_EDITS): AppliedLineChanges {
  const written: Partial<PurchaseLine> = normalizeLineChanges(changes);
  // The company pays for what the approver buys, whatever is sent (P-037).
  if (editor.buyer === 'approver' && written.paidBy !== undefined) written.paidBy = 'company';
  // Nobody can confirm "who paid" when the approver buys, so it is never left as an unconfirmed suggestion (P-037).
  if (editor.buyer === 'approver' && written.suggested !== undefined) written.suggested = written.suggested.filter((f) => f !== 'paidBy');
  if (written.sameReceiptAsRow !== undefined && written.sameReceiptAsRow !== null && receiptFiles(line).length > 0) {
    throw new NotAllowedError(notAllowed.sharedReceiptHasOwn);
  }
  if (written.category !== undefined || written.categoryOther !== undefined) {
    const category = written.category ?? line.category;
    if (!categoryNeedsDescription(category) && (written.categoryOther ?? line.categoryOther) !== '') written.categoryOther = '';
    const before = categoryText(line.category, line.categoryOther);
    const after = categoryText(category, written.categoryOther ?? line.categoryOther);
    // A change to the category is the employee's suggestion again, or, if the approver made it, confirmed by them (P-024, P-040).
    if (after !== before) {
      if (editor.approverName) written.categoryConfirmedBy = line255(editor.approverName);
      else if (line.categoryConfirmedBy !== '') written.categoryConfirmedBy = '';
    }
  }
  return { line: { ...line, ...written }, written };
}

/**
 * What changes on the other rows when row `removedRow` is deleted: the rows
 * below it move up, and "same receipt as row" pointers follow them (travel D-038).
 * `remaining` is every row except the deleted one.
 */
export function changesAfterDelete(remaining: readonly PurchaseLine[], removedRow: number): Map<string, Partial<PurchaseLine>> {
  const changes = new Map<string, Partial<PurchaseLine>>();
  for (const l of remaining) {
    const change: Partial<PurchaseLine> = {};
    if (l.sameReceiptAsRow === removedRow) change.sameReceiptAsRow = null;
    else if (l.sameReceiptAsRow !== null && l.sameReceiptAsRow > removedRow) change.sameReceiptAsRow = l.sameReceiptAsRow - 1;
    if (l.rowNumber > removedRow) change.rowNumber = l.rowNumber - 1;
    if (Object.keys(change).length > 0) changes.set(l.id, change);
  }
  return changes;
}

// ---- Categories confirmed by the approver or administrator --------------------

/** What confirming the categories changes on one row. */
export interface CategoryUpdate {
  category?: CategoryId;
  categoryOther?: string;
  categoryConfirmedBy: string;
}

/**
 * Checks the categories an approver or administrator chose, and works out what
 * each row changes when they confirm the categories as shown (P-024): every
 * row is marked as confirmed by them, and a row they changed gets its new
 * category. Only rows that change are returned. A choice that is not valid
 * throws an Error with plain text, before anything is written.
 */
export function categoryUpdates(lines: readonly PurchaseLine[], choices: Record<string, CategoryChoice>, confirmedBy: string): Map<string, CategoryUpdate> {
  const chosen = new Map(Object.entries(choices));
  const known = new Set(lines.map((l) => l.id));
  const ordered = [...lines].sort((a, b) => a.rowNumber - b.rowNumber);
  const problems: string[] = [];
  if ([...chosen.keys()].some((id) => !known.has(id))) problems.push(messages.spNotFound);

  const valid = new Map<string, { category: CategoryId; categoryOther: string }>();
  for (const line of ordered) {
    const choice = chosen.get(line.id);
    if (!choice) continue;
    const other = typeof choice.categoryOther === 'string' ? choice.categoryOther.trim() : '';
    const describe = categoryNeedsDescription(choice.category);
    if (!findCategory(choice.category)) problems.push(`Row ${line.rowNumber}: ${messages.categoryRequired}`);
    else if (describe && !other) problems.push(`Row ${line.rowNumber}: ${messages.categoryOtherRequired}`);
    else valid.set(line.id, { category: choice.category, categoryOther: describe ? line255(other) : '' });
  }
  if (problems.length > 0) throw new Error(problems.join(' '));

  const updates = new Map<string, CategoryUpdate>();
  for (const line of ordered) {
    const update: CategoryUpdate = { categoryConfirmedBy: line255(confirmedBy) };
    const choice = valid.get(line.id);
    if (choice && (choice.category !== line.category || choice.categoryOther !== line.categoryOther)) {
      update.category = choice.category;
      update.categoryOther = choice.categoryOther;
    }
    if (update.category !== undefined || line.categoryConfirmedBy !== update.categoryConfirmedBy) updates.set(line.id, update);
  }
  return updates;
}

// ---- Sending for approval ----------------------------------------------------

/**
 * Whether a request holds an approval that sending it for approval again, or
 * returning it at the approval step, must take back (P-019). A request that
 * never had one (a Draft being sent for the first time, or a request returned
 * before it was ever approved) has nothing to clear, so no person or date
 * column is written.
 */
export function holdsApproval(request: Pick<PurchaseRequest, 'approvedOn' | 'approvedBy' | 'approvedByEmail' | 'approvalNote'>): boolean {
  return request.approvedOn !== '' || request.approvedBy !== '' || request.approvedByEmail !== '' || request.approvalNote !== '';
}

// ---- Changing who buys (P-037) ------------------------------------------------

/** Why the buyer cannot be changed now, or '' when it can: only while the request is a draft or has been returned. */
export function buyerChangeRefusal(status: RequestStatus): string {
  return status === 'Draft' || status === 'Returned' ? '' : notAllowed.buyerLocked;
}

/**
 * What changing the buyer of a draft or returned request takes back. An
 * approval was given for the other way of buying (a request returned at
 * processing keeps it), so the approval is taken back as a return at the
 * approval step does, keeping the earlier ones; the request goes through
 * approval again. A bought-before-approval flag belongs to a request the
 * employee buys, so it goes when the approver will buy. Rows keep what the
 * employee chose for "who paid"; the totals and the CSV count the company as
 * the payer while the approver buys.
 */
export function buyerChangeEffects(
  request: Pick<PurchaseRequest, 'approval' | 'approvedOn' | 'approvedBy' | 'approvedByEmail' | 'approvalNote' | 'boughtBeforeApproval'>,
  buyer: BuyerId
): { approval?: ApprovalRecord; clearApprover: boolean; clearBoughtBefore: boolean } {
  return {
    approval: request.approval.approved.length > 0 ? approvalWhenReturned(request.approval) : undefined,
    clearApprover: holdsApproval(request),
    clearBoughtBefore: buyer === 'approver' && request.boughtBeforeApproval
  };
}

// ---- The approval record at each step (P-017, P-019, P-027) -------------------
// A return at processing leaves the record as it is.

/**
 * The record once the request is sent for approval: what is sent now, nothing
 * approved, and every approval so far kept as earlier (`approvalsSoFar`), so a
 * later return cannot make a vendor bought after its approval look bought
 * before it.
 */
export function approvalWhenSent(previous: ApprovalRecord, sent: ApprovalGroup[], rows: SentRow[] = []): ApprovalRecord {
  return { sent, approved: [], earlier: approvalsSoFar(previous), ...(rows.length > 0 ? { rows } : {}) };
}

/** The record once the approver approves: what was sent, what is approved now, and the earlier approvals as they were. */
export function approvalWhenApproved(previous: ApprovalRecord, approved: ApprovalGroup[]): ApprovalRecord {
  return { sent: previous.sent, approved, earlier: previous.earlier, ...(previous.rows ? { rows: previous.rows } : {}) };
}

/** The record once the request is returned at the approval step: nothing approved now; what was sent and the earlier approvals are kept. */
export function approvalWhenReturned(previous: ApprovalRecord): ApprovalRecord {
  return { sent: previous.sent, approved: [], earlier: previous.earlier, ...(previous.rows ? { rows: previous.rows } : {}) };
}

// ---- Submissions ------------------------------------------------------------

/** Approval requests first, then packages, each newest first (PurchaseDataService.listSubmissionsForRequest). */
export function sortSubmissionsForRequest(submissions: readonly Submission[]): Submission[] {
  const rank = (s: Submission) => (s.type === 'approval' ? 0 : 1);
  return [...submissions].sort((a, b) => rank(a) - rank(b) || b.submissionNumber - a.submissionNumber || b.id - a.id);
}

/**
 * Why a submission may not be set back to Ready, or '' when it may (P-030).
 * It may when the request is still at the step the submission is for (an
 * approval request while the request awaits approval, a package while it is
 * submitted), it is the newest of its type for the request, and it failed or
 * has not been finished within PACKAGE_ATTENTION_MINUTES. Anything else could
 * email the approver about a request that has moved on, or make a folder for
 * a package that has been replaced. `all` is every submission of the request.
 */
export function retryRefusal(submission: Submission, all: readonly Submission[], status: RequestStatus, now: Date): string {
  const newest = sortSubmissionsForRequest(all.filter((s) => s.type === submission.type))[0];
  if (status !== STATUS_FOR_SUBMISSION[submission.type] || !newest || newest.id !== submission.id) return notAllowed.retryMovedOn;
  if (!submissionNeedsAttention(submission, now)) return notAllowed.retryNotStuck;
  return '';
}

/**
 * Earlier attempts of this type and number that stopped part-way and are
 * still Uploading. The flow starts only on Ready, so it never saw them; they
 * are removed before the attempt is made again.
 */
export function staleUploading(earlier: readonly Submission[], type: SubmissionType, submissionNumber: number): Submission[] {
  return earlier.filter((s) => s.type === type && s.submissionNumber === submissionNumber && s.packageStatus === 'Uploading');
}

/** The folder the last earlier package went to, which a resubmission replaces (travel D-042). */
export function previousFolderName(earlier: readonly Submission[], submissionNumber: number): string {
  const packages = earlier.filter((s) => s.type === 'package' && s.submissionNumber < submissionNumber);
  const last = packages.sort((a, b) => b.submissionNumber - a.submissionNumber)[0];
  return last ? last.folderName : '';
}
