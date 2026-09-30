// What the administrator pages need to know about submissions.

import { PACKAGE_ATTENTION_MINUTES } from '../../../domain/statuses';
import { Submission, TravelReport } from '../../../domain/types';

/** The newest submission of each report. */
export function latestByReport(submissions: readonly Submission[]): Map<number, Submission> {
  const map = new Map<number, Submission>();
  for (const s of submissions) {
    const current = map.get(s.reportId);
    if (!current || s.submissionNumber > current.submissionNumber) map.set(s.reportId, s);
  }
  return map;
}

/** A package that failed, or has not been created within the expected time (strategy section 7). */
export function needsAttention(s: Submission, now: Date = new Date()): boolean {
  if (s.packageStatus === 'Failed') return true;
  if (s.packageStatus === 'Packaged') return false;
  const submitted = new Date(s.submittedOn.replace(' ', 'T'));
  return now.getTime() - submitted.getTime() > PACKAGE_ATTENTION_MINUTES * 60 * 1000;
}

export function reportsToProcess(reports: readonly TravelReport[]): TravelReport[] {
  return reports.filter((r) => r.status === 'Submitted');
}
