// An administrator records a purchase they have already made (P-051): no approval step, no employee,
// no certification. The request is treated as approved by the administrator for the checks and the
// package, and is marked as recorded, so the CSV and the email say who recorded it.

import { toLocalDateTime, toIsoDate } from './dates';
import { ApprovalRecord, PurchaseLine, PurchaseRequest } from './types';
import { approvalsSoFar, groupsForApproved, sentRowsOf } from './purchaseRules';
import { approvalGroupsToSend } from './validation';

/** Stands in for the certification sentence on a recorded purchase: no employee certified it. Shown in the submission email. */
export const RECORDED_CERTIFICATION = 'Recorded by the administrator after buying. No employee certification.';

/** The approval note a recorded purchase carries. */
export const RECORDED_NOTE = 'Recorded by the administrator after buying.';

/**
 * Whether this person records their own purchase here: an administrator, on a request of their own that is still
 * theirs to change and that the approver buys (the default), so nothing is reimbursed to an employee.
 */
export function mayRecord(request: Pick<PurchaseRequest, 'ownerEmail' | 'status' | 'buyer'>, user: { email: string; isAdministrator: boolean }): boolean {
  return (
    user.isAdministrator &&
    request.buyer === 'approver' &&
    (request.status === 'Draft' || request.status === 'Returned') &&
    request.ownerEmail.trim().toLowerCase() === user.email.trim().toLowerCase()
  );
}

/**
 * The request as it will stand once recorded: approved by the administrator, every vendor total, for the
 * checks (receipts needed, no quote or link asked) and for the package. Nothing is stored from this.
 */
export function recordedRequestOf(request: PurchaseRequest, lines: readonly PurchaseLine[], who: { name: string; email: string }, now: Date): PurchaseRequest {
  const sent = approvalGroupsToSend({ approval: request.approval, buyer: 'approver' }, lines, toIsoDate(now));
  const approved = groupsForApproved(lines, sent, 'approver');
  const approval: ApprovalRecord = { sent, approved, earlier: approvalsSoFar(request.approval), rows: sentRowsOf(lines) };
  const at = toLocalDateTime(now);
  return {
    ...request,
    buyer: 'approver',
    status: 'Approved',
    approval,
    sentForApprovalOn: at,
    approvedOn: at,
    approvedBy: who.name,
    approvedByEmail: who.email,
    approvalNote: RECORDED_NOTE,
    boughtBeforeApproval: false,
    returnNote: '',
    returnStage: ''
  };
}

const sameEmail = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Whether this person recorded the request (P-051): it carries the recorded note and the administrator is both its
 * owner and the one who approved it. Fixing and marking it purchased again then needs no employee certification.
 */
export function isRecordedBy(request: Pick<PurchaseRequest, 'approvalNote' | 'ownerEmail' | 'approvedByEmail'>, user: { email: string }): boolean {
  return request.approvalNote === RECORDED_NOTE && sameEmail(request.ownerEmail, user.email) && sameEmail(request.approvedByEmail, user.email);
}

/** The stand-in for a certification on a recorded purchase, for the package. */
export function recordedCertification(user: { displayName: string; email: string }): { text: string; email: string; name: string } {
  return { text: RECORDED_CERTIFICATION, email: user.email, name: user.displayName };
}
