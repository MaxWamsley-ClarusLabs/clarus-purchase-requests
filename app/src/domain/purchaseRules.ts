// THE PURCHASING POLICY, IN ONE PLACE (P-004).
//
// Every number and every piece of policy wording the app enforces is defined
// here: the approval and quote thresholds, how vendor totals are counted, how
// an approval is kept honest, the "bought before approval" test, the
// categories and their suggested accounts, who paid, the project quick picks
// and the certification sentence. Max will write a new purchasing policy after
// the app is complete (the last stage in docs/STRATEGY.md); changing the
// policy means changing this file, its tests (purchaseRules.test.ts) and the
// wording in messages.ts and content/instructions.ts.
//
// Status of each rule: docs/DECISIONS.md and docs/QUESTIONS_FOR_MAX.md.
// Decided by Max: the $500 approval threshold (P-005), the certification
// sentence (P-010), the categories (P-012) and the who-paid choices (P-003).
// Everything else here is Provisional (Claude, awaiting Max).

import { isValidIsoDate } from './dates';
import { formatDollars } from './money';
import { ApprovalGroup, ApprovalRecord, CategoryId, FileKind, IsoDate, PaidById, RequestStatus } from './types';

// ---- Thresholds ------------------------------------------------------------

/**
 * A vendor total of this much or more, within one request, needs the
 * approver's approval in the app before the purchase. Under it, no approval is
 * needed, but the request is still submitted with receipts. Decided by Max
 * (P-005). The attached F2 form's $100 is the old P4 wording and is not used.
 */
export const APPROVAL_THRESHOLD_CENTS = 50000;

/**
 * A vendor total of this much or more also needs a quote, or a written
 * no-quote reason, attached to the approval request. Provisional (P-015): the
 * F2 form says "over $500"; this is "$500 or more", the same number as the
 * approval threshold.
 */
export const QUOTE_THRESHOLD_CENTS = 50000;

/**
 * After approval, a vendor total may rise this much above the approved amount
 * (taxes, shipping) before it needs approval again. Provisional (P-019); the
 * number is a guess. 0 means any increase needs approval again.
 */
export const OVERRUN_TOLERANCE_PERCENT = 10;

/** For wording: "$500". */
export const APPROVAL_THRESHOLD_TEXT = formatDollars(APPROVAL_THRESHOLD_CENTS);
export const QUOTE_THRESHOLD_TEXT = formatDollars(QUOTE_THRESHOLD_CENTS);

// ---- Certification ---------------------------------------------------------

/**
 * The employee's certification at Submit (P-010), the F2 form's sentence,
 * exactly. Ticked with a box tied to the account; no signature. Changing this
 * text changes what employees certify: record it in docs/DECISIONS.md.
 */
export const CERTIFICATION =
  'I certify that the listed purchases are for official Clarus Labs business purposes, are not personal expenses, have not been reimbursed elsewhere, and that the information provided is accurate to the best of my knowledge.';

// ---- Project or grant code -------------------------------------------------

/**
 * Offered as quick picks for the project or grant code. Never filled in by
 * default (P-003). Add a line here for each new award.
 */
export const PROJECT_QUICK_PICKS: readonly string[] = ['NSF SBIR Phase 1 (Award # 2528301)'];

// ---- Categories and suggested QuickBooks accounts --------------------------

/**
 * The suggested QuickBooks accounts below are UNVERIFIED, TO CONFIRM WITH MAX
 * (P-009, P-025). They are plain account names, without numbers, because the
 * chart of accounts could not be looked up (the QuickBooks connector is not
 * used). The administrator decides the account, as in travel (travel D-020).
 */
export const QUICKBOOKS_MAPPING_STATUS = 'Unverified, to confirm with Max';

export interface Category {
  id: CategoryId;
  /** The form's wording. */
  label: string;
  /** A short gloss for the Instructions and tooltips. Claude's wording, not policy. */
  covers: string;
  /** Unverified, to confirm with Max. '' for Other: the administrator decides. */
  suggestedAccount: string;
}

export const CATEGORIES: readonly Category[] = [
  {
    id: 'rdMaterials',
    label: 'R&D Materials & Supplies / Equipment',
    covers: 'Materials, supplies and equipment for research and development work',
    suggestedAccount: 'R&D Materials and Supplies'
  },
  {
    id: 'advertising',
    label: 'Advertising/Marketing/Website',
    covers: 'Advertising, marketing materials, and website or domain costs',
    suggestedAccount: 'Advertising and Marketing'
  },
  {
    id: 'computer',
    label: 'Computer, H/W & S/W Supplies',
    covers: 'Computer hardware, software and related supplies',
    suggestedAccount: 'Computer and Software'
  },
  { id: 'office', label: 'Office Supplies', covers: 'Everyday office supplies', suggestedAccount: 'Office Supplies' },
  { id: 'training', label: 'Training and Education', covers: 'Courses, training and educational materials', suggestedAccount: 'Training and Education' },
  { id: 'shipping', label: 'Shipping/Postage', covers: 'Shipping and postage', suggestedAccount: 'Shipping and Postage' },
  { id: 'insurance', label: 'Business Insurance', covers: 'Business insurance premiums', suggestedAccount: 'Insurance' },
  { id: 'other', label: 'Other', covers: 'Anything that fits none of the above. Describe it', suggestedAccount: '' }
];

export function findCategory(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

/** The category as written in the CSV and emails: "Other: Lab safety audit" for Other with a description. */
export function categoryText(id: string, other: string): string {
  const category = findCategory(id);
  if (!category) return '';
  return category.id === 'other' && other.trim() ? `${category.label}: ${other.trim()}` : category.label;
}

// ---- Who paid --------------------------------------------------------------

export interface PaidBy {
  id: PaidById;
  label: string;
  shortLabel: string;
  /** Employee-paid lines are "To reimburse" (P-011). */
  reimbursable: boolean;
  help: string;
}

export const PAID_BY_OPTIONS: readonly PaidBy[] = [
  { id: 'company', label: 'Company', shortLabel: 'Company', reimbursable: false, help: 'Paid by Clarus (company card or invoice). Not reimbursed to you.' },
  { id: 'employee', label: 'Employee', shortLabel: 'Employee', reimbursable: true, help: 'You paid, so Clarus reimburses you.' }
];

export function findPaidBy(id: string): PaidBy | undefined {
  return PAID_BY_OPTIONS.find((p) => p.id === id);
}

// ---- How vendor totals are counted (P-016) ---------------------------------

/**
 * A vendor name for matching: capitals, spaces and punctuation ignored, so
 * "Amazon", "AMAZON." and "amazon" are one vendor, and "City Cab Co." matches
 * "CITY CAB CO".
 */
export function vendorKey(vendor: string): string {
  return vendor
    .replace(/['’]/g, '')
    .replace(/[^A-Za-z0-9À-ɏ\s]/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** The part of a line the thresholds look at. */
export interface GroupLine {
  id: string;
  vendor: string;
  amountCents: number | null;
}

export interface VendorGroup {
  /** `vendorKey`, or `line:<id>` for a line with no vendor yet, which counts on its own. */
  key: string;
  /** The vendor as first typed. */
  vendor: string;
  totalCents: number;
  lineIds: string[];
  needsApproval: boolean;
  needsQuote: boolean;
}

/**
 * Totals the lines by vendor within one request. A request has one business
 * purpose and one project or grant code, so "the same vendor for the same
 * business purpose" is "the same vendor in the request". Every line counts,
 * whoever paid. A negative amount (possible only by editing the list directly)
 * counts as zero, so it cannot bring a vendor total under a threshold.
 */
export function vendorGroups(lines: readonly GroupLine[]): VendorGroup[] {
  const groups = new Map<string, VendorGroup>();
  for (const line of lines) {
    const key = vendorKey(line.vendor) || `line:${line.id}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, vendor: line.vendor.trim(), totalCents: 0, lineIds: [], needsApproval: false, needsQuote: false };
      groups.set(key, group);
    }
    if (!group.vendor && line.vendor.trim()) group.vendor = line.vendor.trim();
    group.totalCents += Math.max(0, line.amountCents ?? 0);
    group.lineIds.push(line.id);
  }
  return Array.from(groups.values()).map((g) => ({
    ...g,
    needsApproval: g.totalCents >= APPROVAL_THRESHOLD_CENTS,
    needsQuote: g.totalCents >= QUOTE_THRESHOLD_CENTS
  }));
}

/** The vendor totals that need approval. */
export function groupsNeedingApproval(lines: readonly GroupLine[]): VendorGroup[] {
  return vendorGroups(lines).filter((g) => g.needsApproval);
}

/** Whether any vendor total in the request needs approval (P-005). */
export function requiresApproval(lines: readonly GroupLine[]): boolean {
  return groupsNeedingApproval(lines).length > 0;
}

// ---- The quote rule (P-015) ------------------------------------------------

export interface QuoteLine extends GroupLine {
  noQuoteReason: string;
  files: readonly { kind: FileKind }[];
}

export interface QuoteGap {
  group: VendorGroup;
  /** The first line of the vendor's lines, where the message is shown. */
  firstLineId: string;
}

/**
 * The vendor totals at or over the quote threshold that have neither a quote
 * file nor a no-quote reason on any of their lines. The quote is for the
 * approval request, so it is checked when the request is sent for approval.
 */
export function quoteGaps(lines: readonly QuoteLine[]): QuoteGap[] {
  const byId = new Map(lines.map((l) => [l.id, l]));
  return vendorGroups(lines)
    .filter((g) => g.needsQuote)
    .filter((g) =>
      g.lineIds.every((id) => {
        const line = byId.get(id)!;
        return !line.files.some((f) => f.kind === 'quote') && line.noQuoteReason.trim() === '';
      })
    )
    .map((group) => ({ group, firstLineId: group.lineIds[0] }));
}

// ---- Bought before approval (P-017) ----------------------------------------

export interface BoughtLine extends GroupLine {
  date: IsoDate;
  /** The line has a receipt or invoice attached, or uses another row's receipt. */
  hasReceipt: boolean;
}

/**
 * A line looks already bought when it is dated before the day the request is
 * sent for approval, or already has a receipt or invoice attached. An invalid
 * or missing date does not count as bought on its own.
 */
export function isAlreadyBought(line: Pick<BoughtLine, 'date' | 'hasReceipt'>, sentOn: IsoDate): boolean {
  return line.hasReceipt || (isValidIsoDate(line.date) && line.date < sentOn);
}

/**
 * The vendor totals that need approval, as recorded when the request is sent
 * for approval, each flagged "bought" if any of its lines was already bought.
 */
export function groupsForApproval(lines: readonly BoughtLine[], sentOn: IsoDate): ApprovalGroup[] {
  const byId = new Map(lines.map((l) => [l.id, l]));
  return groupsNeedingApproval(lines).map((g) => ({
    key: g.key,
    vendor: g.vendor,
    cents: g.totalCents,
    bought: g.lineIds.some((id) => isAlreadyBought(byId.get(id)!, sentOn))
  }));
}

/**
 * The totals the approver approves: each vendor total that needs approval, at
 * its current amount (the request is locked while it awaits approval), with
 * the bought flag carried over from when it was sent.
 */
export function groupsForApproved(lines: readonly GroupLine[], sent: readonly ApprovalGroup[]): ApprovalGroup[] {
  return groupsNeedingApproval(lines).map((g) => ({
    key: g.key,
    vendor: g.vendor,
    cents: g.totalCents,
    bought: sent.find((s) => s.key === g.key)?.bought ?? false
  }));
}

/** Whether any recorded vendor total was bought before approval. */
export function anyBoughtBefore(groups: readonly ApprovalGroup[]): boolean {
  return groups.some((g) => g.bought);
}

// ---- Approval covers what the approver saw (P-019) -------------------------

export const EMPTY_APPROVAL: ApprovalRecord = { sent: [], approved: [] };

/** The most a vendor total may reach, at this approved amount, without a new approval. */
export function allowedCents(approvedCents: number): number {
  return approvedCents + Math.floor((approvedCents * OVERRUN_TOLERANCE_PERCENT) / 100);
}

export interface GroupCoverage {
  group: VendorGroup;
  /** What the approver approved for this vendor; null if it was not approved. */
  approvedCents: number | null;
  covered: boolean;
}

/**
 * For each vendor total that needs approval: was it approved, and is it still
 * within the allowance? A total that has fallen under the threshold needs no
 * approval and is not listed.
 */
export function approvalCoverage(groups: readonly VendorGroup[], approved: readonly ApprovalGroup[]): GroupCoverage[] {
  return groups
    .filter((g) => g.needsApproval)
    .map((group) => {
      const match = approved.find((a) => a.key === group.key);
      return { group, approvedCents: match ? match.cents : null, covered: !!match && group.totalCents <= allowedCents(match.cents) };
    });
}

export type ApprovalState =
  /** Every vendor total is under the threshold. */
  | 'notRequired'
  /** Approval is needed and the request has not been approved (or has been returned). */
  | 'needed'
  /** Sent, waiting for the approver. */
  | 'pending'
  /** Approved, and what was approved still covers the request. */
  | 'approved'
  /** Approved, but a vendor total has since risen past the allowance or a new one needs approval. */
  | 'changed';

/**
 * Where the request stands on approval. `needed` and `changed` both mean the
 * employee has to send the request for approval before submitting.
 */
export function approvalState(status: RequestStatus, groups: readonly VendorGroup[], record: ApprovalRecord): ApprovalState {
  if (!groups.some((g) => g.needsApproval)) return 'notRequired';
  if (status === 'Awaiting approval') return 'pending';
  if (record.approved.length === 0) return 'needed';
  return approvalCoverage(groups, record.approved).every((c) => c.covered) ? 'approved' : 'changed';
}

/** Whether the employee must send the request for approval before submitting it. */
export function mustSendForApproval(state: ApprovalState): boolean {
  return state === 'needed' || state === 'changed';
}

export type LineApprovalStatus = 'notRequired' | 'needed' | 'pending' | 'approved' | 'changed';

export interface LineApproval {
  status: LineApprovalStatus;
  /** The line's vendor total was bought before approval (P-017). */
  boughtBefore: boolean;
}

/**
 * The approval status of each line, which the app works out (P-003), by line
 * ID. A line takes the status of its vendor total.
 */
export function lineApprovals(lines: readonly GroupLine[], status: RequestStatus, record: ApprovalRecord): Map<string, LineApproval> {
  const groups = vendorGroups(lines);
  const state = approvalState(status, groups, record);
  const coverage = new Map(approvalCoverage(groups, record.approved).map((c) => [c.group.key, c.covered]));
  const result = new Map<string, LineApproval>();
  for (const group of groups) {
    let lineStatus: LineApprovalStatus;
    if (!group.needsApproval) lineStatus = 'notRequired';
    else if (state === 'pending') lineStatus = 'pending';
    else if (record.approved.length === 0) lineStatus = 'needed';
    else lineStatus = coverage.get(group.key) ? 'approved' : 'changed';
    const boughtBefore =
      group.needsApproval && (record.approved.some((a) => a.key === group.key && a.bought) || record.sent.some((s) => s.key === group.key && s.bought));
    for (const id of group.lineIds) result.set(id, { status: lineStatus, boughtBefore });
  }
  return result;
}

/** An approver who is also the requester approved their own request (P-020). */
export function isSelfApproved(ownerEmail: string, approvedByEmail: string): boolean {
  return !!ownerEmail && !!approvedByEmail && ownerEmail.trim().toLowerCase() === approvedByEmail.trim().toLowerCase();
}
