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
// Decided by Max: the $500 approval threshold (P-005), the $500 quote rule
// (P-015), the 10% rule (P-019), the Owners as approvers and self-approval
// (P-020), the certification sentence (P-010) and when it is ticked (P-041),
// the categories and their QuickBooks accounts (P-038), the who-paid choices
// (P-003), that the approver buys most purchases and so is the default buyer
// (P-037), the item link (P-039) and what the approver may change when buying
// (P-040). Everything else here is Provisional (Claude, awaiting Max).

import { isValidIsoDate } from './dates';
import { formatDollars } from './money';
import { ApprovalGroup, ApprovalRecord, BuyerId, CategoryId, FileKind, IsoDate, PaidById, PurchaseLine, RequestStatus, SentRow } from './types';

// ---- Thresholds ------------------------------------------------------------

/**
 * For a request the employee buys: a vendor total of this much or more, within
 * one request, needs the approver's approval in the app before the purchase.
 * Under it, no approval is needed, but the request is still submitted with
 * receipts. Decided by Max (P-005). The old form's approval wording is retired
 * and is not used. A request the approver buys always goes to the
 * approver, whatever the amount (P-037, `approvalThresholdCents`).
 */
export const APPROVAL_THRESHOLD_CENTS = 50000;

/**
 * A vendor total of this much or more also needs a quote, or a written
 * no-quote reason, attached to the approval request. Decided by Max
 * (P-015): "$500 or more", for both ways of buying. The old form's quote
 * wording is retired.
 */
export const QUOTE_THRESHOLD_CENTS = 50000;

/**
 * After approval, a vendor total may rise this much above the approved amount
 * (taxes, shipping) before it needs approval again. Decided by Max (P-019,
 * 2026-10-01: keep the 10% rule). 0 means any increase needs approval again.
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

// ---- Who buys (P-037) ----------------------------------------------------

export interface Buyer {
  id: BuyerId;
  label: string;
  help: string;
}

/** About 95% of purchases are bought by the person who approves the request (Max, 2026-10-01), so the approver is the default. */
export const DEFAULT_BUYER: BuyerId = 'approver';

export const BUYER_OPTIONS: readonly Buyer[] = [
  {
    id: 'approver',
    label: 'The approver buys it',
    help: 'You say what to buy. The approver approves, buys it, attaches the receipt and finishes the request. Every request like this goes to the approver, whatever the amount.'
  },
  {
    id: 'self',
    label: 'I will buy it myself',
    help: `You buy it and submit your receipts. A vendor total of ${APPROVAL_THRESHOLD_TEXT} or more needs the approver first. If you pay, Clarus reimburses you.`
  }
];

export function findBuyer(id: string): Buyer | undefined {
  return BUYER_OPTIONS.find((b) => b.id === id);
}

/**
 * The vendor total at which approval is needed. A request the approver buys
 * always goes to the approver, so every vendor total needs approval (P-037);
 * the amount that decides it for a request the employee buys is
 * APPROVAL_THRESHOLD_CENTS (P-005).
 */
export function approvalThresholdCents(buyer: BuyerId): number {
  return buyer === 'approver' ? 0 : APPROVAL_THRESHOLD_CENTS;
}

// ---- Categories and QuickBooks accounts (P-012, P-038) -----------------------

/**
 * The accounts below are from the May 1, 2026 export of Clarus's QuickBooks
 * account list, as Max supplied them on 2026-10-01. Claude did not open the
 * file. Re-export the list and compare it with this file before the app goes
 * live (docs/CHECKPOINT.md). The administrator still decides the account, and
 * the class is a separate field the app does not set (P-025).
 */
export const QUICKBOOKS_MAPPING_STATUS = 'from the May 1, 2026 account list';

export interface Category {
  id: CategoryId;
  /** The exact QuickBooks account name, so the employee's choice is the account. Other is the one exception. */
  label: string;
  /** A short gloss for the Instructions and tooltips. Claude's wording, not policy. */
  covers: string;
  /** The QuickBooks account number; '' when the administrator decides the account. */
  accountNumber: string;
  /** The text in the CSV's account column: the number and the exact name, or what the administrator decides. */
  accountText: string;
  /** The employee describes the category in their own words (the form's "Other: ____", P-024). */
  needsDescription: boolean;
  /**
   * The administrator or approver must confirm this row's category before the
   * request can be marked processed (P-038): the account depends on a
   * decision the app does not make.
   */
  needsReview: boolean;
}

const account = (number: string, name: string) => ({ accountNumber: number, accountText: `${number} ${name}` });

export const CATEGORIES: readonly Category[] = [
  {
    id: 'rdMaterials',
    label: 'R&D Materials & Supplies',
    covers: 'Materials and supplies for research and development work',
    ...account('6182', 'R&D Materials & Supplies'),
    needsDescription: false,
    needsReview: false
  },
  {
    id: 'equipment',
    label: 'Equipment',
    covers: 'Equipment. The administrator decides whether it is expensed or capitalized',
    accountNumber: '6175',
    accountText: '6175 Equipment (administrator decides: expense it, or capitalize it to 1415 Fixed Assets:Equipment)',
    needsDescription: false,
    needsReview: true
  },
  {
    id: 'advertising',
    label: 'Advertising/Marketing/Website',
    covers: 'Advertising, marketing materials, and website or domain costs',
    ...account('6500', 'Advertising/Marketing/Website'),
    needsDescription: false,
    needsReview: false
  },
  {
    id: 'computer',
    label: 'Computer, H/W & S/W Supplies',
    covers: 'One-time computer hardware and software. Recurring software goes under Dues and Subscriptions',
    ...account('6178', 'Computer, H/W & S/W Supplies'),
    needsDescription: false,
    needsReview: false
  },
  {
    id: 'office',
    label: 'Office Supplies',
    covers: 'Everyday office supplies',
    ...account('6180', 'Office Supplies'),
    needsDescription: false,
    needsReview: false
  },
  {
    id: 'training',
    label: 'Training and Education',
    covers: 'Courses, training and educational materials. Conference travel goes through the travel app',
    ...account('6155', 'Training and Education'),
    needsDescription: false,
    needsReview: false
  },
  {
    id: 'shipping',
    label: 'Shipping/Postage',
    covers: 'Shipping and postage',
    ...account('6184', 'Shipping/Postage'),
    needsDescription: false,
    needsReview: false
  },
  {
    id: 'insurance',
    label: 'Business Insurance',
    covers: 'Business insurance premiums',
    ...account('6215', 'Business Insurance'),
    needsDescription: false,
    needsReview: false
  },
  {
    id: 'subscriptions',
    label: 'Dues and Subscriptions',
    covers: 'Recurring subscriptions, including software, and memberships',
    ...account('6150', 'Dues and Subscriptions'),
    needsDescription: false,
    needsReview: false
  },
  {
    id: 'telecom',
    label: 'Telephone/Internet',
    covers: 'Telephone and internet service',
    ...account('6185', 'Telephone/Internet'),
    needsDescription: false,
    needsReview: false
  },
  {
    id: 'repairs',
    label: 'Repairs & maintenance',
    covers: 'Repairs and maintenance',
    ...account('6170', 'Repairs & maintenance'),
    needsDescription: false,
    needsReview: false
  },
  {
    id: 'professional',
    label: 'Professional Services',
    covers: 'Professional services. The administrator picks the specific account in QuickBooks',
    ...account('6050', 'Professional Services'),
    needsDescription: false,
    needsReview: false
  },
  {
    id: 'other',
    label: 'Other',
    covers: 'Anything that fits none of the above. Describe it; the administrator decides the account',
    accountNumber: '',
    accountText: 'Administrator decides',
    needsDescription: true,
    needsReview: true
  }
];

export function findCategory(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

/** Whether the category is one the employee must describe (Other). */
export function categoryNeedsDescription(id: string): boolean {
  return findCategory(id)?.needsDescription ?? false;
}

/** Whether a row in this category must be confirmed by the approver or administrator before the request is processed (P-038). */
export function categoryNeedsReview(id: string): boolean {
  return findCategory(id)?.needsReview ?? false;
}

/** The category as written in the CSV and emails: "Other: Lab safety audit" for Other with a description. */
export function categoryText(id: string, other: string): string {
  const category = findCategory(id);
  if (!category) return '';
  return category.needsDescription && other.trim() ? `${category.label}: ${other.trim()}` : category.label;
}

// ---- The item link (P-039) ---------------------------------------------------

/** A web address is kept in a plain-text column, up to this many characters. Longer is refused, never cut: a cut address opens the wrong page. */
export const ITEM_LINK_MAX_LENGTH = 2000;

/**
 * The address a link may open, or '' when the text is not a web address the
 * app will turn into a link. Only http and https count, with a host that has a
 * dot, so text such as "javascript:..." or "data:..." typed into the list is
 * never made clickable. The text is otherwise shown, never run.
 */
export function safeLink(text: string): string {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > ITEM_LINK_MAX_LENGTH || /\s/.test(trimmed)) return '';
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    if (!url.hostname.includes('.') || url.username || url.password) return '';
    return url.href;
  } catch {
    return '';
  }
}

/** Quick picks for "No web page: say why" (P-039). Free text is still allowed. */
export const NO_LINK_REASONS: readonly string[] = ['Not sold online', 'Ordered from a quote'];

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
 * Characters that show nothing: zero-width spaces and joiners, soft hyphens,
 * variation selectors, the byte-order mark, the word joiner, direction marks,
 * and the Hangul fillers, which Unicode counts as letters.
 */
const SHOWS_NOTHING = new RegExp('\\p{Default_Ignorable_Code_Point}+', 'gu');

/**
 * A vendor name for matching: capitals, accents, spaces, punctuation and
 * characters that show nothing are ignored, in any alphabet, so "Digi-Key" and
 * "DigiKey", "Thor Labs" and "Thorlabs", "Café" and "Cafe", "O'Reilly" and
 * "o reilly", and "Amazon" and "Amazon" with a zero-width space or a Hangul
 * filler typed in are each one vendor. "Amazon" and "Amazon.com" are two. A
 * name with no letter or digit at all (such as "-") is matched as typed,
 * ignoring capitals, spaces and characters that show nothing. '' only for a
 * blank name, or one made only of characters that show nothing; such a line
 * counts on its own (`vendorGroups`), and validation asks for a vendor.
 * Matching more names together only ever asks for more approval, never less.
 */
export function vendorKey(vendor: string): string {
  const key = vendor.normalize('NFKD').replace(SHOWS_NOTHING, '').replace(COMBINING_MARKS, '').toLowerCase().replace(NOT_LETTER_OR_NUMBER, '');
  return key || vendor.replace(SHOWS_NOTHING, '').trim().toLowerCase().replace(/\s+/g, ' ');
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
 * counts as zero, so it cannot bring a vendor total under a threshold. For a
 * request the approver buys, every vendor total needs approval (P-037).
 */
export function vendorGroups(lines: readonly GroupLine[], buyer: BuyerId = 'self'): VendorGroup[] {
  const approvalAt = approvalThresholdCents(buyer);
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
    needsApproval: g.totalCents >= approvalAt,
    needsQuote: g.totalCents >= QUOTE_THRESHOLD_CENTS
  }));
}

/** The vendor totals that need approval. */
export function groupsNeedingApproval(lines: readonly GroupLine[], buyer: BuyerId = 'self'): VendorGroup[] {
  return vendorGroups(lines, buyer).filter((g) => g.needsApproval);
}

/**
 * Whether any vendor total in the request needs approval (P-005). Used only
 * by the tests, as a plain statement of the rule; the app itself works from
 * `approvalState`.
 */
export function requiresApproval(lines: readonly GroupLine[], buyer: BuyerId = 'self'): boolean {
  return groupsNeedingApproval(lines, buyer).length > 0;
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

/** Nothing sent, nothing approved, now or earlier: a request that has never been sent for approval. */
export const EMPTY_APPROVAL: ApprovalRecord = { sent: [], approved: [], earlier: [] };

/**
 * Every vendor total approved so far, in any round: the newest approval of
 * each vendor, which is the one approved now (`approved`) if there is one, and
 * otherwise the newest earlier one (`earlier`). In the order the vendors were
 * first approved. What sending the request for approval again keeps as
 * `earlier`, and what `groupsForApproval` judges "approved before it was
 * bought" against. Never used to tell whether the request is approved now:
 * that is `approved` alone (`approvalState`).
 */
export function approvalsSoFar(record: ApprovalRecord): ApprovalGroup[] {
  const newest = new Map<string, ApprovalGroup>();
  for (const group of [...record.earlier, ...record.approved]) newest.set(group.key, group);
  return Array.from(newest.values());
}

/**
 * The vendor totals that need approval, as recorded when the request is sent
 * for approval, each flagged "bought" (P-017) when:
 * - an earlier round already flagged the same vendor (`previous`, the record
 *   the request holds when it is sent, earlier approvals included): a flag,
 *   once set, stays, even if a date is changed later; or
 * - no approval so far covers the vendor total (it was never approved, or it
 *   has risen past the allowance of its newest approval, `approvalsSoFar`) and
 *   one of its lines looks already bought.
 * A vendor total an approval so far still covers is never newly flagged: it
 * was approved before it was bought, even if a later round was returned.
 * Nothing is ever flagged when the approver buys (P-037): the employee has
 * bought nothing, and the date on a row is when it should be bought.
 */
export function groupsForApproval(
  lines: readonly BoughtLine[],
  sentOn: IsoDate,
  previous: ApprovalRecord = EMPTY_APPROVAL,
  buyer: BuyerId = 'self'
): ApprovalGroup[] {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const flagged = new Set([...previous.sent, ...previous.approved, ...previous.earlier].filter((g) => g.bought).map((g) => g.key));
  return approvalCoverage(vendorGroups(lines, buyer), approvalsSoFar(previous)).map(({ group, covered }) => ({
    key: group.key,
    vendor: group.vendor,
    cents: group.totalCents,
    bought: buyer === 'self' && (flagged.has(group.key) || (!covered && group.lineIds.some((id) => isAlreadyBought(byId.get(id)!, sentOn))))
  }));
}

/**
 * Whether the vendor totals that need approval now are exactly the ones that
 * were sent for approval: the same vendors, at the same amounts, nothing
 * added and nothing taken away. The approver approves what was sent, so a
 * request changed since (for example by an edit made directly in SharePoint,
 * travel D-002) cannot be approved as it stands (P-019).
 */
export function matchesWhatWasSent(lines: readonly GroupLine[], sent: readonly ApprovalGroup[], buyer: BuyerId = 'self'): boolean {
  const now = groupsNeedingApproval(lines, buyer);
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
export function groupsForApproved(lines: readonly GroupLine[], sent: readonly ApprovalGroup[], buyer: BuyerId = 'self'): ApprovalGroup[] {
  return groupsNeedingApproval(lines, buyer).map((g) => ({
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
 * employee has to send the request for approval before submitting. A request
 * the approver buys needs approval whatever it costs, and once approved it
 * stays approved however the approver changes the amounts when buying: the
 * approver who approved it is the one who spends (P-037, P-040).
 */
export function approvalState(status: RequestStatus, groups: readonly VendorGroup[], record: ApprovalRecord, buyer: BuyerId = 'self'): ApprovalState {
  if (buyer === 'approver') {
    if (status === 'Awaiting approval') return 'pending';
    return record.approved.length === 0 ? 'needed' : 'approved';
  }
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
export function lineApprovals(lines: readonly GroupLine[], status: RequestStatus, record: ApprovalRecord, buyer: BuyerId = 'self'): Map<string, LineApproval> {
  const groups = vendorGroups(lines, buyer);
  const state = approvalState(status, groups, record, buyer);
  const result = new Map<string, LineApproval>();
  if (buyer === 'approver') {
    // Every row has the status of the request: nothing is judged vendor by vendor, and nothing is bought before approval (P-037).
    const lineStatus: LineApprovalStatus = state === 'pending' ? 'pending' : state === 'approved' ? 'approved' : 'needed';
    for (const line of lines) result.set(line.id, { status: lineStatus, boughtBefore: false });
    return result;
  }
  const coverage = new Map(approvalCoverage(groups, record.approved).map((c) => [c.group.key, c.covered]));
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

// ---- What the employee sent (P-040) -------------------------------------------

/** The rows as they are when a request the approver buys is sent, kept so the approver's changes can be shown next to them. */
export function sentRowsOf(lines: readonly PurchaseLine[]): SentRow[] {
  return [...lines]
    .sort((a, b) => a.rowNumber - b.rowNumber)
    .map((l) => ({
      rowNumber: l.rowNumber,
      date: l.date,
      vendor: l.vendor,
      description: l.description,
      category: categoryText(l.category, l.categoryOther),
      amountCents: l.amountCents,
      itemLink: l.itemLink,
      noLinkReason: l.noLinkReason
    }));
}

/** Whether the rows now are the rows as they were sent, in every field a row shows (P-040). */
export function sameAsSent(lines: readonly PurchaseLine[], sent: readonly SentRow[]): boolean {
  const now = sentRowsOf(lines);
  return (
    now.length === sent.length &&
    now.every((row, i) => {
      const was = sent[i];
      return (
        row.rowNumber === was.rowNumber &&
        row.date === was.date &&
        row.vendor === was.vendor &&
        row.description === was.description &&
        row.category === was.category &&
        row.amountCents === was.amountCents &&
        row.itemLink === was.itemLink &&
        row.noLinkReason === was.noLinkReason
      );
    })
  );
}
