// The validation rules (travel D-031, adapted for purchases). Blocking issues
// stop a send or a submission; warnings are shown and passed to the
// administrator. What is checked depends on the stage the request is at
// (P-006): while approval is still to come, the next action is "Send for
// approval", so the quote rule is checked and receipts are not; once no
// approval is outstanding, the next action is "Submit", so receipts are
// checked. Policy numbers and the approval rules live in purchaseRules.ts.

import { isValidIsoDate } from './dates';
import { LineRef, findDuplicates } from './duplicates';
import { messages } from './messages';
import { formatCents } from './money';
import { hasReceipt, receiptSourceRow } from './receipts';
import {
  ApprovalState,
  approvalState,
  categoryNeedsDescription,
  groupsForApproval,
  isAlreadyBought,
  mustSendForApproval,
  quoteGaps,
  vendorGroups,
  vendorKey
} from './purchaseRules';
import { suggestedFieldsText } from './suggestions';
import { ApprovalGroup, IsoDate, PurchaseLine, PurchaseRequest } from './types';

export type Severity = 'blocking' | 'warning';

/** The next action a request is being checked for. */
export type ValidationStage = 'approval' | 'submit';

export type RequestField = 'businessPurpose' | 'department' | 'rows';
/** 'suggested' is a row's unconfirmed suggestions (travel D-078), not one cell. */
export type LineField = 'date' | 'vendor' | 'description' | 'category' | 'categoryOther' | 'amount' | 'paidBy' | 'quote' | 'receipt' | 'suggested';

export interface Issue {
  severity: Severity;
  scope: 'request' | 'row';
  field: RequestField | LineField;
  lineId?: string;
  rowNumber?: number;
  message: string;
}

/** "Row 3: " or nothing, to put before an issue's message. */
export function issuePrefix(issue: Issue): string {
  return issue.rowNumber ? `Row ${issue.rowNumber}: ` : '';
}

type RequestFields = Pick<PurchaseRequest, 'businessPurpose' | 'department' | 'requestNumber' | 'status' | 'approval'>;

/** Where the request stands on approval, from its lines and its approval record. */
export function approvalStateOf(request: Pick<PurchaseRequest, 'status' | 'approval'>, lines: readonly PurchaseLine[]): ApprovalState {
  return approvalState(request.status, vendorGroups(lines), request.approval);
}

/** Which action to check a request for: send it for approval, or submit it. */
export function validationStage(request: Pick<PurchaseRequest, 'status' | 'approval'>, lines: readonly PurchaseLine[]): ValidationStage {
  const state = approvalStateOf(request, lines);
  return mustSendForApproval(state) || state === 'pending' ? 'approval' : 'submit';
}

/**
 * The vendor totals that sending the request for approval on `sentOn` would
 * record, each flagged when it counts as bought before approval (P-017),
 * judged against the approval record the request holds now. What the send
 * dialog lists and what the data services record are both this.
 */
export function approvalGroupsToSend(request: Pick<PurchaseRequest, 'approval'>, lines: readonly PurchaseLine[], sentOn: IsoDate): ApprovalGroup[] {
  return groupsForApproval(
    lines.map((l) => ({ id: l.id, vendor: l.vendor, amountCents: l.amountCents, date: l.date, hasReceipt: hasReceipt(l, lines) })),
    sentOn,
    request.approval
  );
}

/**
 * Whether the vendor total with this matching key looks bought on `today`:
 * one of its rows is dated before it, or has a receipt (its own, or another
 * row's). A vendor total can be flagged bought before approval without this,
 * when an earlier round flagged it (P-017); the wording then differs.
 */
export function looksBoughtNow(lines: readonly PurchaseLine[], key: string, today: IsoDate): boolean {
  const group = vendorGroups(lines).find((g) => g.key === key);
  if (!group) return false;
  return lines.filter((l) => group.lineIds.includes(l.id)).some((l) => isAlreadyBought({ date: l.date, hasReceipt: hasReceipt(l, lines) }, today));
}

/**
 * Checks a request. `today` is the day it is being checked, which is also the
 * day it would be sent for approval (the bought-before-approval test, P-017).
 */
export function validateRequest(request: RequestFields, lines: readonly PurchaseLine[], otherLines: readonly LineRef[], today: IsoDate): Issue[] {
  const issues: Issue[] = [];
  const add = (field: RequestField, message: string) => issues.push({ severity: 'blocking', scope: 'request', field, message });
  const ordered = [...lines].sort((a, b) => a.rowNumber - b.rowNumber);
  const stage = validationStage(request, ordered);

  if (!request.businessPurpose.trim()) add('businessPurpose', messages.businessPurposeRequired);
  if (!request.department.trim()) add('department', messages.departmentRequired);
  if (ordered.length === 0) add('rows', messages.noRows);

  for (const line of ordered) {
    const row = (severity: Severity, field: LineField, message: string) =>
      issues.push({ severity, scope: 'row', field, lineId: line.id, rowNumber: line.rowNumber, message });

    if (!line.date.trim()) row('blocking', 'date', messages.dateRequired);
    else if (!isValidIsoDate(line.date)) row('blocking', 'date', messages.dateInvalid);
    // A name made only of characters that show nothing is no name (P-016): such a row would count on its own.
    if (vendorKey(line.vendor) === '') row('blocking', 'vendor', messages.vendorRequired);
    if (!line.description.trim()) row('blocking', 'description', messages.descriptionRequired);
    if (!line.category) row('blocking', 'category', messages.categoryRequired);
    else if (categoryNeedsDescription(line.category) && !line.categoryOther.trim()) row('blocking', 'categoryOther', messages.categoryOtherRequired);
    if (line.amountCents === null) row('blocking', 'amount', messages.amountRequired);
    else if (line.amountCents <= 0) row('blocking', 'amount', messages.amountNotPositive);
    if (!line.paidBy) row('blocking', 'paidBy', messages.paidByRequired);
    if (line.suggested.length > 0) row('blocking', 'suggested', messages.suggestionsNotConfirmed(suggestedFieldsText(line.suggested)));

    if (line.sameReceiptAsRow !== null && !receiptSourceRow(line, ordered)) {
      row('blocking', 'receipt', messages.sameReceiptBroken(line.sameReceiptAsRow));
    } else if (stage === 'submit' && !hasReceipt(line, ordered) && !line.noReceiptReason.trim()) {
      row('blocking', 'receipt', messages.receiptOrReason);
    }
  }

  if (stage === 'approval') {
    // The quote rule is for the approval request (P-015): checked before it is sent.
    for (const gap of quoteGaps(ordered)) {
      const first = ordered.find((l) => l.id === gap.firstLineId)!;
      issues.push({
        severity: 'blocking',
        scope: 'row',
        field: 'quote',
        lineId: first.id,
        rowNumber: first.rowNumber,
        message: messages.quoteOrReason(gap.group.vendor, formatCents(gap.group.totalCents))
      });
    }
    // A purchase that looks already made can still be sent, flagged (P-017). So can one an earlier round flagged,
    // which stays flagged even if nothing in it looks bought now.
    const groups = vendorGroups(ordered);
    const flagged = approvalGroupsToSend(request, ordered, today).filter((g) => g.bought);
    for (const group of flagged) {
      const first = ordered.find((l) => l.id === groups.find((g) => g.key === group.key)?.lineIds[0]);
      if (!first) continue;
      const total = formatCents(group.cents);
      issues.push({
        severity: 'warning',
        scope: 'row',
        field: 'date',
        lineId: first.id,
        rowNumber: first.rowNumber,
        message: looksBoughtNow(ordered, group.key, today)
          ? messages.boughtBeforeWarning(group.vendor, total)
          : messages.boughtBeforeEarlierWarning(group.vendor, total)
      });
    }
  }

  for (const match of findDuplicates(request.requestNumber, ordered, otherLines)) {
    const line = ordered.find((l) => l.id === match.lineId);
    if (!line) continue;
    const sameRequest = match.other.requestNumber === request.requestNumber;
    const otherRow = match.other.line.rowNumber;
    const message =
      match.kind === 'file'
        ? sameRequest
          ? messages.duplicateFileInRequest(otherRow)
          : messages.duplicateFileElsewhere(match.other.requestNumber, otherRow)
        : sameRequest
          ? messages.duplicateEntryInRequest(otherRow)
          : messages.duplicateEntryElsewhere(match.other.requestNumber, otherRow);
    issues.push({
      severity: 'warning',
      scope: 'row',
      field: match.kind === 'file' ? 'receipt' : 'amount',
      lineId: line.id,
      rowNumber: line.rowNumber,
      message
    });
  }

  return issues;
}

export function blockingIssues(issues: readonly Issue[]): Issue[] {
  return issues.filter((i) => i.severity === 'blocking');
}

export function issuesForLine(issues: readonly Issue[], lineId: string): Issue[] {
  return issues.filter((i) => i.lineId === lineId);
}

export function issueForCell(issues: readonly Issue[], lineId: string, field: LineField): Issue | undefined {
  const matches = issues.filter((i) => i.lineId === lineId && i.field === field);
  return matches.find((i) => i.severity === 'blocking') ?? matches[0];
}
