// What the administrator pages need to know about requests and submissions.
// A submission is either an approval request (the flow emails the approvers) or
// a processing package (the flow creates the request folder), P-018.

import { PACKAGE_ATTENTION_MINUTES } from '../../../domain/statuses';
import { PurchaseRequest, Submission, SubmissionType } from '../../../domain/types';

/** Newest first: the highest submission number, and for the same number the highest ID. */
function newerFirst(a: Submission, b: Submission): number {
  return b.submissionNumber - a.submissionNumber || b.id - a.id;
}

/** The newest submission of one type in a list (for one request), or undefined. */
export function latestSubmission(submissions: readonly Submission[], type: SubmissionType): Submission | undefined {
  return submissions.filter((s) => s.type === type).sort(newerFirst)[0];
}

function newestByRequest(submissions: readonly Submission[], type: SubmissionType): Map<number, Submission> {
  const map = new Map<number, Submission>();
  for (const s of submissions) {
    if (s.type !== type) continue;
    const current = map.get(s.requestId);
    if (!current || newerFirst(s, current) < 0) map.set(s.requestId, s);
  }
  return map;
}

/** The newest processing package of each request. */
export function latestByRequest(submissions: readonly Submission[]): Map<number, Submission> {
  return newestByRequest(submissions, 'package');
}

/** The newest approval request of each request. */
export function latestApprovalByRequest(submissions: readonly Submission[]): Map<number, Submission> {
  return newestByRequest(submissions, 'approval');
}

/**
 * A submission that failed, or has not been completed within the expected time
 * (strategy section 7, P-030): its folder was not created, or its approval
 * email was not sent.
 */
export function needsAttention(s: Submission, now: Date = new Date()): boolean {
  if (s.packageStatus === 'Failed') return true;
  if (s.packageStatus === 'Packaged') return false;
  const submitted = new Date(s.submittedOn.replace(' ', 'T'));
  return now.getTime() - submitted.getTime() > PACKAGE_ATTENTION_MINUTES * 60 * 1000;
}

/**
 * The submissions to show under Needs attention: the newest package of each
 * request that is still waiting to be processed, and the newest approval
 * request of each request that is still waiting for approval. A stuck one
 * stops mattering once its request has moved on (approved, returned or
 * processed), so it is not listed after that.
 */
export function stuckSubmissions(requests: readonly PurchaseRequest[], submissions: readonly Submission[], now: Date = new Date()): Submission[] {
  const statusOf = new Map(requests.map((r) => [r.id, r.status]));
  const stuck: Submission[] = [];
  for (const s of latestByRequest(submissions).values()) if (statusOf.get(s.requestId) === 'Submitted' && needsAttention(s, now)) stuck.push(s);
  for (const s of latestApprovalByRequest(submissions).values()) if (statusOf.get(s.requestId) === 'Awaiting approval' && needsAttention(s, now)) stuck.push(s);
  return stuck.sort((a, b) => b.submittedOn.localeCompare(a.submittedOn) || b.id - a.id);
}

export function requestsToProcess(requests: readonly PurchaseRequest[]): PurchaseRequest[] {
  return requests.filter((r) => r.status === 'Submitted');
}

export function requestsAwaitingApproval(requests: readonly PurchaseRequest[]): PurchaseRequest[] {
  return requests.filter((r) => r.status === 'Awaiting approval');
}
