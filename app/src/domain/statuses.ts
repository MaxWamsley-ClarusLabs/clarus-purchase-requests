// Request, package and approval statuses and how each is shown (travel D-033).

import { ApprovalState, LineApprovalStatus } from './purchaseRules';
import { PackageStatus, RequestStatus, Submission, SubmissionType } from './types';

export type BadgeTone = 'lavender' | 'purple' | 'amber' | 'green' | 'red';

export const REQUEST_STATUS_DISPLAY: Record<RequestStatus, { label: string; tone: BadgeTone; help: string }> = {
  Draft: { label: 'Draft', tone: 'lavender', help: 'Being prepared. Saved automatically.' },
  'Awaiting approval': { label: 'Awaiting approval', tone: 'amber', help: 'Sent to the approver. Read-only until it is approved or returned.' },
  Approved: { label: 'Approved', tone: 'green', help: 'Approved. Buy, attach your receipts and submit.' },
  Submitted: { label: 'Submitted', tone: 'purple', help: 'Sent for processing. Read-only until processed or returned.' },
  Returned: { label: 'Returned', tone: 'amber', help: 'Sent back with a note. Correct it and send or submit it again.' },
  Processed: { label: 'Processed', tone: 'green', help: 'Filed and entered. Closed.' }
};

export const REQUEST_STATUSES = Object.keys(REQUEST_STATUS_DISPLAY) as RequestStatus[];

const PACKAGE_TONE: Record<PackageStatus, BadgeTone> = { Uploading: 'lavender', Ready: 'lavender', Processing: 'purple', Packaged: 'green', Failed: 'red' };

const PACKAGE_LABEL: Record<PackageStatus, string> = {
  Uploading: 'Uploading',
  Ready: 'Waiting for packaging',
  Processing: 'Packaging',
  Packaged: 'Packaged',
  Failed: 'Packaging failed'
};

/** An approval request only emails the approvers, so its statuses read differently (P-018). */
const APPROVAL_LABEL: Record<PackageStatus, string> = {
  Uploading: 'Uploading',
  Ready: 'Waiting to email the approver',
  Processing: 'Emailing the approver',
  Packaged: 'Approver emailed',
  Failed: 'Approval email failed'
};

/** The badge for a submission: a processing package, or an approval request. */
export function submissionStatusDisplay(type: SubmissionType, status: PackageStatus): { label: string; tone: BadgeTone } {
  return { label: (type === 'approval' ? APPROVAL_LABEL : PACKAGE_LABEL)[status], tone: PACKAGE_TONE[status] };
}

export const APPROVAL_STATE_DISPLAY: Record<ApprovalState, { label: string; tone: BadgeTone; help: string }> = {
  notRequired: { label: 'No approval needed', tone: 'lavender', help: 'Every vendor total is under the approval threshold.' },
  needed: { label: 'Approval needed', tone: 'amber', help: 'Send the request for approval before you buy.' },
  pending: { label: 'Awaiting approval', tone: 'amber', help: 'Waiting for the approver.' },
  approved: { label: 'Approved', tone: 'green', help: 'Approved.' },
  changed: { label: 'Changed since approval', tone: 'amber', help: 'A vendor total is above what was approved. Send the request for approval again.' }
};

export const LINE_APPROVAL_DISPLAY: Record<LineApprovalStatus, { label: string; tone: BadgeTone }> = {
  notRequired: { label: 'Not required', tone: 'lavender' },
  needed: { label: 'Approval needed', tone: 'amber' },
  pending: { label: 'Awaiting approval', tone: 'amber' },
  approved: { label: 'Approved', tone: 'green' },
  changed: { label: 'Changed since approval', tone: 'amber' }
};

/** Requests an employee may edit (P-027). */
export function isEditable(status: RequestStatus): boolean {
  return status === 'Draft' || status === 'Returned' || status === 'Approved';
}

/** The statuses in which an approver or administrator can confirm or change categories (P-012, P-024). */
export const CONFIRMABLE_STATUSES: readonly RequestStatus[] = ['Awaiting approval', 'Approved', 'Submitted'];

export function canConfirmCategories(status: RequestStatus): boolean {
  return CONFIRMABLE_STATUSES.includes(status);
}

/** Minutes after which a submission that is not Packaged needs attention (travel strategy section 7, P-030). */
export const PACKAGE_ATTENTION_MINUTES = 30;

/**
 * A submission that failed, or that the flow has not finished within
 * PACKAGE_ATTENTION_MINUTES of its last change (P-030): its folder was not
 * created, or its approval email was not sent. The time is the local
 * "YYYY-MM-DD HH:MM" of the last change (`lastChanged`), or of when it was
 * made (`submittedOn`) if that is not known, so a retry starts the time again
 * and a second Retry is not offered the moment after the first.
 */
export function submissionNeedsAttention(s: Pick<Submission, 'packageStatus' | 'submittedOn' | 'lastChanged'>, now: Date): boolean {
  if (s.packageStatus === 'Failed') return true;
  if (s.packageStatus === 'Packaged') return false;
  const since = new Date((s.lastChanged || s.submittedOn).replace(' ', 'T'));
  return now.getTime() - since.getTime() > PACKAGE_ATTENTION_MINUTES * 60 * 1000;
}

/** The request status a submission of each type is for: an approval request while the request awaits approval, a package while it is submitted. */
export const STATUS_FOR_SUBMISSION: Record<SubmissionType, RequestStatus> = { approval: 'Awaiting approval', package: 'Submitted' };
