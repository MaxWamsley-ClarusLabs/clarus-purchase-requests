// THE PURCHASING POLICY, IN ONE PLACE (P-004).
//
// Every number and every piece of policy wording the app enforces is defined
// here: the approval and quote thresholds, how vendor totals are counted, how
// an approval is kept honest, the "bought before approval" test, the
// categories and their suggested accounts, who paid, the canned no-quote and
// no-receipt reasons, the project quick picks and the certification sentence.
// Max will write a new purchasing policy after the app is complete (the last
// stage in docs/STRATEGY.md); changing the policy means changing this file,
// its tests (purchaseRules.test.ts) and the wording in messages.ts and
// content/instructions.ts.
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
  /** The employee describes the category in their own words (the form's "Other: ____", P-024). */
  needsDescription: boolean;
}

export const CATEGORIES: readonly Category[] = [
  {
    id: 'rdMaterials',
    label: 'R&D Materials & Supplies / Equipment',
    covers: 'Materials, supplies and equipment for research and development work',
    suggestedAccount: 'R&D Materials and Supplies',
    needsDescription: false
  },
  {
    id: 'advertising',
    label: 'Advertising/Marketing/Website',
    covers: 'Advertising, marketing materials, and website or domain costs',
    suggestedAccount: 'Advertising and Marketing',
    needsDescription: false
  },
  {
    id: 'computer',
    label: 'Computer, H/W & S/W Supplies',
    covers: 'Computer hardware, software and related supplies',
    suggestedAccount: 'Computer and Software',
    needsDescription: false
  },
  { id: 'office', label: 'Office Supplies', covers: 'Everyday office supplies', suggestedAccount: 'Office Supplies', needsDescription: false },
  {
    id: 'training',
    label: 'Training and Education',
    covers: 'Courses, training and educational materials',
    suggestedAccount: 'Training and Education',
    needsDescription: false
  },
  { id: 'shipping', label: 'Shipping/Postage', covers: 'Shipping and postage', suggestedAccount: 'Shipping and Postage', needsDescription: false },
  { id: 'insurance', label: 'Business Insurance', covers: 'Business insurance premiums', suggestedAccount: 'Insurance', needsDescription: false },
  { id: 'other', label: 'Other', covers: 'Anything that fits none of the above. Describe it', suggestedAccount: '', needsDescription: true }
];

export function findCategory(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

/** Whether the category is one the employee must describe (Other). */
export function categoryNeedsDescription(id: string): boolean {
  return findCategory(id)?.needsDescription ?? false;
}

/** The category as written in the CSV and emails: "Other: Lab safety audit" for Other with a description. */
export function categoryText(id: string, other: string): string {
  const category = findCategory(id);
  if (!category) return '';
  return category.needsDescription && other.trim() ? `${category.label}: ${other.trim()}` : category.label;
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

// ---- Canned reasons --------------------------------------------------------

/**
 * Quick picks for "No quote: say why" (P-015). Free text is still allowed.
 * Policy, because a pick satisfies the quote rule in one click: "Already
 * purchased" is the bought-before-approval case (P-017).
 */
export const NO_QUOTE_REASONS: readonly string[] = ['Already purchased'];

/** Quick picks for "No receipt: say why". Free text is still allowed. */
export const NO_RECEIPT_REASONS: readonly string[] = ['Receipt lost', 'No receipt given'];

// ---- How vendor totals are counted (P-016) ---------------------------------

// Built from strings: Unicode property escapes in a regular expression literal
// need a newer TypeScript target than the SharePoint build uses.
const COMBINING_MARKS = new RegExp('\\p{M}+', 'gu');
const NOT_LETTER_OR_NUMBER = new RegExp('[^\\p{L}\\p{N}]+', 'gu');

/**
 * A vendor name for matching: capitals, accents, spaces and punctuation are
 * ignored, in any alphabet, so "Digi-Key" and "DigiKey", "Thor Labs" and
 * "Thorlabs", "Café" and "Cafe", and "O'Reilly" and "o reilly" are each one
 * vendor. "Amazon" and "Amazon.com" are two. A name with no letter or digit
 * at all (such as "-") is matched as typed, ignoring capitals and spaces.
 * '' only for a blank name; such a line counts on its own (`vendorGroups`).
 * Matching more names together only ever asks for more approval, never less.
 */
export function vendorKey(vendor: string): string {
  const key = vendor.normalize('NFKD').replace(COMBINING_MARKS, '').toLowerCase().replace(NOT_LETTER_OR_NUMBER, '');
  return key || vendor.trim().toLowerCase().replace(/\s+/g, ' ');
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

/**
 * Whether any vendor total in the request needs approval (P-005). Used only
 * by the tests, as a plain statement of the rule; the app itself works from
 * `approvalState`.
 */
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

/** Nothing sent, nothing approved: a request that has never been sent for approval. */
export const EMPTY_APPROVAL: ApprovalRecord = { sent: [], approved: [] };

/**
 * The vendor totals that need approval, as recorded when the request is sent
 * for approval, each flagged "bought" (P-017) when:
 * - an earlier round already flagged the same vendor (`previous`, the record
 *   the request holds when it is sent): a flag, once set, stays, even if a
 *   date is changed later; or
 * - no earlier approval covers the vendor total (it was never approved, or it
 *   has risen past the allowance) and one of its lines looks already bought.
 * A vendor total an earlier approval still covers is never newly flagged: it
 * was approved before it was bought.
 */
export function groupsForApproval(lines: readonly BoughtLine[], sentOn: IsoDate, previous: ApprovalRecord = EMPTY_APPROVAL): ApprovalGroup[] {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const flagged = new Set([...previous.sent, ...previous.approved].filter((g) => g.bought).map((g) => g.key));
  return approvalCoverage(vendorGroups(lines), previous.approved).map(({ group, covered }) => ({
    key: group.key,
    vendor: group.vendor,
    cents: group.totalCents,
    bought: flagged.has(group.key) || (!covered && group.lineIds.some((id) => isAlreadyBought(byId.get(id)!, sentOn)))
  }));
}

/**
 * Whether the vendor totals that need approval now are exactly the ones that
 * were sent for approval: the same vendors, at the same amounts, nothing
 * added and nothing taken away. The approver approves what was sent, so a
 * request changed since (for example by an edit made directly in SharePoint,
 * travel D-002) cannot be approved as it stands (P-019).
 */
export function matchesWhatWasSent(lines: readonly GroupLine[], sent: readonly ApprovalGroup[]): boolean {
  const now = groupsNeedingApproval(lines);
  if (now.length !== sent.length) return false;
  const sentCents = new Map(sent.map((s) => [s.key, s.cents]));
  return sentCents.size === sent.length && now.every((g) => sentCents.get(g.key) === g.totalCents);
}

/**
 * The totals the approver approves: each vendor total that needs approval, at
 * its current amount (the request is locked while it awaits approval, and the
 * services check that it still matches what was sent), with the bought flag
 * carried over from when it was sent.
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
