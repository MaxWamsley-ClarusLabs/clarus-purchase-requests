// Rules the SharePoint service and the mock service apply in exactly the same
// way, so the preview behaves like the real site (docs/DATA_MODEL.md lifecycle
// rules; P-006, P-020, P-024, P-027). Pure functions and plain text only: no
// SharePoint calls and no stored state.

import { messages } from '../../domain/messages';
import { findCategory, findPaidBy } from '../../domain/purchaseRules';
import { CategoryId, PurchaseLine, PurchaseRequest, RequestStatus, Submission, SubmissionType } from '../../domain/types';
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
  approveWhen: 'Only a request that is awaiting approval can be approved.',
  returnWhen: 'Only a request that is awaiting approval or submitted can be returned.',
  confirmWhen: 'Categories can be confirmed only on a request that is awaiting approval, approved or submitted.',
  processWhen: 'Only submitted requests can be marked processed.'
} as const;

/**
 * Which step a return comes at (P-006): the approver returns a request that is
 * awaiting approval, the administrator one that is submitted. Undefined when
 * the request cannot be returned from this status.
 */
export function returnStageFor(status: RequestStatus): 'approval' | 'processing' | undefined {
  if (status === 'Awaiting approval') return 'approval';
  if (status === 'Submitted') return 'processing';
  return undefined;
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

/**
 * Applies the employee's change to a row. Changing the category or its
 * description makes the category the employee's own suggestion again, so who
 * confirmed it is cleared (P-024).
 */
export function applyLineChanges(line: PurchaseLine, changes: LineChanges): AppliedLineChanges {
  const written: Partial<PurchaseLine> = normalizeLineChanges(changes);
  const categoryChanged = written.category !== undefined && written.category !== line.category;
  const otherChanged = written.categoryOther !== undefined && written.categoryOther !== line.categoryOther;
  if ((categoryChanged || otherChanged) && line.categoryConfirmedBy !== '') written.categoryConfirmedBy = '';
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
    if (!findCategory(choice.category)) problems.push(`Row ${line.rowNumber}: ${messages.categoryRequired}`);
    else if (choice.category === 'other' && !other) problems.push(`Row ${line.rowNumber}: ${messages.categoryOtherRequired}`);
    else valid.set(line.id, { category: choice.category, categoryOther: choice.category === 'other' ? line255(other) : '' });
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

// ---- Submissions ------------------------------------------------------------

/** Approval requests first, then packages, each newest first (PurchaseDataService.listSubmissionsForRequest). */
export function sortSubmissionsForRequest(submissions: readonly Submission[]): Submission[] {
  const rank = (s: Submission) => (s.type === 'approval' ? 0 : 1);
  return [...submissions].sort((a, b) => rank(a) - rank(b) || b.submissionNumber - a.submissionNumber || b.id - a.id);
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
