// The notification email's subject and summary (D-046). The flow adds the
// heading and links, escapes the summary and sends it (D-067).

import { findTripPurpose } from '../domain/lists';
import { formatCents } from '../domain/money';
import { Issue } from '../domain/validation';
import { hasReceipt } from '../domain/receipts';
import { activeTrips } from '../domain/mileage';
import { issuePrefix } from '../domain/validation';
import { Totals } from '../domain/totals';
import { ExpenseLine, TravelReport } from '../domain/types';

export function emailSubject(submitterName: string, tripName: string, reportNo: string, submissionNumber: number): string {
  return submissionNumber > 1
    ? `Travel report resubmitted: ${submitterName}, ${tripName} (${reportNo}, R${submissionNumber})`
    : `Travel report submitted: ${submitterName}, ${tripName} (${reportNo})`;
}

export interface EmailSummaryInput {
  report: TravelReport;
  lines: readonly ExpenseLine[];
  totals: Totals;
  submitterName: string;
  /** What the employee certified at Submit (D-064). */
  certification: { email: string; text: string; submittedOn: string };
  receiptCount: number;
  warnings: readonly Issue[];
  previousFolderName: string;
}

/**
 * The email summary, as plain text (D-067). The flow escapes it and turns line
 * breaks into HTML line breaks before sending, so nothing stored in the list,
 * which employees can edit directly (D-002), is ever sent as HTML.
 */
export function buildEmailSummary(input: EmailSummaryInput): string {
  const { report, lines, totals } = input;
  const purpose = findTripPurpose(report.tripPurpose);
  const noReceipt = lines.filter((l) => !hasReceipt(l, lines));
  const out: string[] = [];
  out.push(`Submitted by: ${input.submitterName} (${input.certification.email})`);
  out.push(`Trip: ${report.tripName} (${report.destination}), ${report.tripStart} to ${report.tripEnd}`);
  out.push(`Business purpose: ${report.businessPurpose}`);
  if (purpose) out.push(`Trip was for: ${purpose.label}${purpose.suggestedClass ? ` (suggested class ${purpose.suggestedClass})` : ' (no class suggested)'}`);
  out.push('');
  out.push(`To reimburse: ${formatCents(totals.reimburseCents)}`);
  out.push(`Company-paid: ${formatCents(totals.companyCents)}`);
  out.push(`Trip total: ${formatCents(totals.tripCents)}`);
  out.push('');
  out.push(`Expenses: ${lines.length}. Receipt files: ${input.receiptCount}.`);
  const trips = activeTrips(report);
  if (trips.length > 0) {
    const miles = Math.round(trips.reduce((n, t) => n + (t.miles ?? 0), 0) * 10) / 10;
    out.push(`Mileage: ${trips.length === 1 ? '1 drive' : `${trips.length} drives`}, ${miles} miles, included in To reimburse.`);
  }
  if (noReceipt.length > 0) {
    out.push('', 'Rows without a receipt:');
    for (const l of noReceipt) out.push(`- Row ${l.rowNumber}: ${l.noReceiptReason}`);
  }
  if (input.warnings.length > 0) {
    out.push('', 'Warnings the employee submitted with:');
    for (const w of input.warnings) out.push(`- ${issuePrefix(w)}${w.message}`);
  }
  out.push('', `Certified by ${input.submitterName} at submission, ${input.certification.submittedOn}:`, `"${input.certification.text}"`);
  if (input.previousFolderName) out.push('', `This replaces the earlier folder: ${input.previousFolderName}`);
  return out.join('\n');
}
