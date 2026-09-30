// The expense CSV in each report folder (D-045, D-048, D-050, D-051).
// UTF-8 with a byte-order mark, commas, CRLF line endings, one header row,
// YYYY-MM-DD dates and plain two-decimal amounts.

import { findCategory, findPaymentType, findTripPurpose } from '../domain/lists';
import { centsToPlain } from '../domain/money';
import { receiptNamesForRow } from '../domain/naming';
import { MILEAGE, activeTrips, mileageAmountCents, rateText } from '../domain/mileage';
import { MILEAGE_CENTS_PER_MILE, rateFor } from '../domain/rates';
import { Issue } from '../domain/validation';
import { ExpenseLine, TravelReport } from '../domain/types';

// Expense columns come first so the useful part is visible when the file is
// opened in Excel; the trip columns repeat on every row after them (D-048).
export const CSV_COLUMNS = [
  'Report',
  'Row',
  'Date',
  'Vendor',
  'Category',
  'Amount',
  'Payment type',
  'Reimbursable',
  'Suggested QuickBooks account',
  'Suggested payment account',
  'Suggested class',
  'Description',
  'Receipt files',
  'No-receipt reason',
  'Warnings',
  'Submission',
  'Submitted by',
  'Submitted on',
  'Trip name',
  'Destination',
  'Trip start',
  'Trip end',
  'Business purpose',
  'Trip purpose',
  'Certified by'
] as const;

/**
 * Quotes a value when needed. Text that a spreadsheet could read as a formula
 * (starting with = + - @ or a control character) gets a leading apostrophe, so
 * opening the file in Excel never runs anything.
 */
export function csvCell(value: string): string {
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export interface CsvInput {
  report: TravelReport;
  lines: readonly ExpenseLine[];
  submissionNumber: number;
  submitterName: string;
  /** The account that certified the report at Submit (D-064). */
  submitterEmail: string;
  submittedOn: string;
  /** Warnings shown to the employee at submission; blocking issues cannot exist here. */
  warnings: readonly Issue[];
}

export function buildExpensesCsv(input: CsvInput): string {
  const { report, lines } = input;
  const purpose = findTripPurpose(report.tripPurpose);
  const rows: string[][] = [CSV_COLUMNS.slice()];
  for (const line of lines) {
    const category = findCategory(line.category);
    const payment = findPaymentType(line.paymentType);
    // Report-level warnings (such as a late submission) repeat on every row,
    // like the trip columns (D-048).
    const lineWarnings = input.warnings.filter((w) => w.lineId === line.id || w.scope === 'report').map((w) => w.message);
    const values: Record<(typeof CSV_COLUMNS)[number], string> = {
      Report: report.reportNumber,
      Row: String(line.rowNumber),
      Date: line.date,
      Vendor: line.vendor,
      Category: category ? category.label : '',
      Amount: line.amountCents === null ? '' : centsToPlain(line.amountCents),
      'Payment type': payment ? payment.label : '',
      Reimbursable: payment ? (payment.reimbursable ? 'Yes' : 'No') : '',
      'Suggested QuickBooks account': category ? category.suggestedAccount : '',
      'Suggested payment account': payment ? payment.suggestedPaymentAccount : '',
      'Suggested class': purpose ? purpose.suggestedClass : '',
      Description: line.description,
      'Receipt files': receiptNamesForRow(line, lines).join('; '),
      'No-receipt reason': line.noReceiptReason,
      Warnings: lineWarnings.join('; '),
      Submission: String(input.submissionNumber),
      'Submitted by': input.submitterName,
      'Submitted on': input.submittedOn,
      'Trip name': report.tripName,
      Destination: report.destination,
      'Trip start': report.tripStart,
      'Trip end': report.tripEnd,
      'Business purpose': report.businessPurpose,
      'Trip purpose': purpose ? purpose.label : '',
      'Certified by': `${input.submitterName} (${input.submitterEmail})`
    };
    rows.push(CSV_COLUMNS.map((c) => values[c]));
  }
  // Mileage drives follow the receipt rows, numbered M1, M2 (D-071).
  activeTrips(report).forEach((trip, index) => {
    const label = `M${index + 1}`;
    const cents = mileageAmountCents(trip);
    const rate = trip.date ? rateFor(MILEAGE_CENTS_PER_MILE, trip.date) : undefined;
    const tripWarnings = input.warnings.filter((w) => w.tripId === trip.id || w.scope === 'report').map((w) => w.message);
    const values: Record<(typeof CSV_COLUMNS)[number], string> = {
      Report: report.reportNumber,
      Row: label,
      Date: trip.date,
      Vendor: MILEAGE.label,
      Category: MILEAGE.label,
      Amount: cents === null ? '' : centsToPlain(cents),
      'Payment type': MILEAGE.paymentLabel,
      Reimbursable: 'Yes',
      'Suggested QuickBooks account': MILEAGE.suggestedAccount,
      'Suggested payment account': '',
      'Suggested class': purpose ? purpose.suggestedClass : '',
      Description: `From ${trip.from} to ${trip.to}: ${trip.miles ?? ''} miles${rate ? ` at ${rateText(rate.value)}` : ''}`,
      'Receipt files': '',
      'No-receipt reason': MILEAGE.noReceiptReason,
      Warnings: tripWarnings.join('; '),
      Submission: String(input.submissionNumber),
      'Submitted by': input.submitterName,
      'Submitted on': input.submittedOn,
      'Trip name': report.tripName,
      Destination: report.destination,
      'Trip start': report.tripStart,
      'Trip end': report.tripEnd,
      'Business purpose': report.businessPurpose,
      'Trip purpose': purpose ? purpose.label : '',
      'Certified by': `${input.submitterName} (${input.submitterEmail})`
    };
    rows.push(CSV_COLUMNS.map((c) => values[c]));
  });
  return '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
