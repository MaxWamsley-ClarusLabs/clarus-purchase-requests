// Everything the app prepares at Submit (strategy section 4): the folder name,
// the CSV, the receipt copies to attach, the email text and the frozen copy of
// the trip details and totals.

import { blockingIssues, validateReport, Issue } from '../domain/validation';
import { LineRef } from '../domain/duplicates';
import { findTripPurpose } from '../domain/lists';
import { csvFileName, folderName, packageReceipts, PackageReceipt } from '../domain/naming';
import { hasReceipt } from '../domain/receipts';
import { computeTotals } from '../domain/totals';
import { activeTrips } from '../domain/mileage';
import { toIsoDate, toLocalDateTime } from '../domain/dates';
import { messages } from '../domain/messages';
import { ExpenseLine, Submission, TravelReport } from '../domain/types';
import { buildExpensesCsv } from './csv';
import { buildEmailSummary, emailSubject } from './email';

export interface PreparedSubmission {
  submission: Omit<Submission, 'id' | 'packageStatus' | 'folderLink' | 'packagedAt' | 'errorMessage'>;
  csvName: string;
  csvContent: string;
  receiptCopies: PackageReceipt[];
  warnings: Issue[];
}

/** What the employee confirmed at Submit (D-064). */
export interface Certification {
  /** The sentence shown with the tick box; must be the current wording. */
  text: string;
  /** The signed-in account that ticked it. */
  email: string;
}

export class SubmissionBlockedError extends Error {
  constructor(public readonly issues: Issue[]) {
    super(`The report has ${issues.length} problem(s) to fix before it can be submitted.`);
  }
}

export function prepareSubmission(
  report: TravelReport,
  lines: readonly ExpenseLine[],
  otherLines: readonly LineRef[],
  now: Date,
  previousFolderName: string,
  certification: Certification
): PreparedSubmission {
  if (certification.text !== messages.certification || !certification.email) throw new Error(messages.certificationRequired);
  const issues = validateReport(report, lines, otherLines, toIsoDate(now));
  const blocking = blockingIssues(issues);
  if (blocking.length > 0) throw new SubmissionBlockedError(blocking);
  const warnings = issues.filter((i) => i.severity === 'warning');

  const submissionNumber = report.submissionCount + 1;
  const submittedOn = toLocalDateTime(now);
  const totals = computeTotals(lines, activeTrips(report));
  const receiptCopies = packageReceipts(lines);
  const purpose = findTripPurpose(report.tripPurpose);
  const name = folderName({
    tripStart: report.tripStart,
    ownerName: report.ownerName,
    tripName: report.tripName,
    reportNumber: report.reportNumber,
    submissionNumber
  });
  const csvName = csvFileName(report.reportNumber, submissionNumber);
  const csvContent = buildExpensesCsv({
    report,
    lines,
    submissionNumber,
    submitterName: report.ownerName,
    submitterEmail: certification.email,
    submittedOn,
    warnings
  });

  return {
    csvName,
    csvContent,
    receiptCopies,
    warnings,
    submission: {
      reportId: report.id,
      reportNumber: report.reportNumber,
      submissionNumber,
      folderName: name,
      previousFolderName,
      submitterName: report.ownerName,
      submitterEmail: certification.email,
      submittedOn,
      certificationText: certification.text,
      tripName: report.tripName,
      destination: report.destination,
      tripStart: report.tripStart,
      tripEnd: report.tripEnd,
      tripPurpose: purpose ? purpose.label : '',
      suggestedClass: purpose ? purpose.suggestedClass : '',
      totalReimburseCents: totals.reimburseCents,
      totalCompanyCents: totals.companyCents,
      totalTripCents: totals.tripCents,
      receiptCount: receiptCopies.length,
      rowsWithoutReceipt: lines.filter((l) => !hasReceipt(l, lines)).length,
      emailSubject: emailSubject(report.ownerName, report.tripName, report.reportNumber, submissionNumber),
      emailSummary: buildEmailSummary({
        report,
        lines,
        totals,
        submitterName: report.ownerName,
        certification: { email: certification.email, text: certification.text, submittedOn },
        receiptCount: receiptCopies.length,
        warnings,
        previousFolderName
      }),
      packageFileNames: [...receiptCopies.map((r) => r.packageName), csvName]
    }
  };
}
