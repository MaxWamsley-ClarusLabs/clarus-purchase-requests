// The validation rules for v1 (D-031, D-040, D-050). Blocking issues stop a
// submission; warnings are shown and passed to the administrator.

import { daysBetween, isValidIsoDate } from './dates';
import { mealDaysOverLimit } from './meals';
import { activeTrips } from './mileage';
import { formatCents } from './money';
import { MILEAGE_CENTS_PER_MILE, rateFor } from './rates';
import { LineRef, findDuplicates } from './duplicates';
import { messages } from './messages';
import { hasReceipt, receiptSourceRow } from './receipts';
import { suggestedFieldsText } from './suggestions';
import { CategoryId, ExpenseLine, TravelReport } from './types';

export type Severity = 'blocking' | 'warning';

/**
 * Categories whose costs happen during the trip. Only these get the "date
 * outside the trip" warning: airfare and registration are usually paid weeks
 * ahead (D-017), so warning on them would only teach people to ignore warnings.
 * Confirmed by Max (D-031a).
 */
export const DATE_CHECK_CATEGORIES: readonly CategoryId[] = ['lodging', 'meals', 'businessMeal', 'transportation'];

/** Reports are due within this many days after the trip ends (policy P3, D-065). */
export const REPORT_DUE_DAYS = 30;

export type ReportField = 'tripName' | 'destination' | 'businessPurpose' | 'tripPurpose' | 'tripStart' | 'tripEnd' | 'rows';
/** 'suggested' is a row's unconfirmed suggestions (D-078), not one cell. */
export type LineField = 'date' | 'vendor' | 'category' | 'amount' | 'paymentType' | 'description' | 'receipt' | 'suggested';
export type MileageField = 'date' | 'from' | 'to' | 'miles';

export interface Issue {
  severity: Severity;
  scope: 'report' | 'row' | 'mileage';
  field: ReportField | LineField | MileageField;
  lineId?: string;
  rowNumber?: number;
  /** For mileage issues: the drive's ID and its label, such as M1 (D-071). */
  tripId?: string;
  tripLabel?: string;
  message: string;
}

/** "Row 3: ", "Mileage M1: " or nothing, to put before an issue's message. */
export function issuePrefix(issue: Issue): string {
  if (issue.rowNumber) return `Row ${issue.rowNumber}: `;
  if (issue.tripLabel) return `Mileage ${issue.tripLabel}: `;
  return '';
}

type ReportFields = Pick<
  TravelReport,
  'tripName' | 'destination' | 'businessPurpose' | 'tripPurpose' | 'tripStart' | 'tripEnd' | 'reportNumber' | 'hasMileage' | 'mileageTrips'
>;

/**
 * Checks a report. `asOf` is the submission date: today for a report being
 * prepared, the date it was submitted for one already sent.
 */
export function validateReport(report: ReportFields, lines: readonly ExpenseLine[], otherLines: readonly LineRef[], asOf: string): Issue[] {
  const issues: Issue[] = [];
  const add = (field: ReportField, message: string) => issues.push({ severity: 'blocking', scope: 'report', field, message });

  if (!report.tripName.trim()) add('tripName', messages.tripNameRequired);
  if (!report.destination.trim()) add('destination', messages.destinationRequired);
  if (!report.businessPurpose.trim()) add('businessPurpose', messages.businessPurposeRequired);
  if (!report.tripPurpose) add('tripPurpose', messages.tripPurposeRequired);
  const startOk = isValidIsoDate(report.tripStart);
  const endOk = isValidIsoDate(report.tripEnd);
  if (!startOk) add('tripStart', messages.tripStartRequired);
  if (!endOk) add('tripEnd', messages.tripEndRequired);
  if (startOk && endOk && report.tripEnd < report.tripStart) add('tripEnd', messages.tripEndBeforeStart);
  const trips = activeTrips(report);
  if (lines.length === 0 && trips.length === 0) add('rows', messages.noRows);
  if (report.hasMileage && trips.length === 0 && lines.length > 0) add('rows', messages.mileageNone);
  if (endOk && isValidIsoDate(asOf)) {
    const late = daysBetween(report.tripEnd, asOf);
    if (late > REPORT_DUE_DAYS) issues.push({ severity: 'warning', scope: 'report', field: 'tripEnd', message: messages.lateSubmission(late) });
  }

  for (const line of lines) {
    const row = (severity: Severity, field: LineField, message: string) =>
      issues.push({ severity, scope: 'row', field, lineId: line.id, rowNumber: line.rowNumber, message });

    if (!isValidIsoDate(line.date)) row('blocking', 'date', messages.dateRequired);
    if (!line.vendor.trim()) row('blocking', 'vendor', messages.vendorRequired);
    if (!line.category) row('blocking', 'category', messages.categoryRequired);
    if (line.amountCents === null || line.amountCents <= 0) row('blocking', 'amount', messages.amountRequired);
    if (!line.paymentType) row('blocking', 'paymentType', messages.paymentTypeRequired);
    if (line.category === 'otherTravel' && !line.description.trim()) row('blocking', 'description', messages.descriptionRequiredForOther);
    if (line.suggested.length > 0) row('blocking', 'suggested', messages.suggestionsNotConfirmed(suggestedFieldsText(line.suggested)));

    if (line.sameReceiptAsRow !== null && !receiptSourceRow(line, lines)) {
      row('blocking', 'receipt', messages.sameReceiptBroken(line.sameReceiptAsRow));
    } else if (!hasReceipt(line, lines) && !line.noReceiptReason.trim()) {
      row('blocking', 'receipt', messages.receiptOrReason);
    }

    if (
      startOk &&
      endOk &&
      isValidIsoDate(line.date) &&
      line.category !== '' &&
      DATE_CHECK_CATEGORIES.includes(line.category) &&
      (line.date < report.tripStart || line.date > report.tripEnd)
    ) {
      row('warning', 'date', messages.dateOutsideTrip);
    }
  }

  // The daily meal limit (D-070): a warning on the day's first meal row.
  for (const day of mealDaysOverLimit(lines)) {
    const total = formatCents(day.totalCents);
    const limit = formatCents(day.limitCents);
    let message =
      day.count >= 3
        ? messages.mealsOverLimit(day.date, total, limit)
        : messages.mealsProjectedOver(day.date, total, day.count, formatCents(day.projectedCents), limit);
    if (!day.limitCurrent) message += ` ${messages.rateNotCurrent}`;
    issues.push({ severity: 'warning', scope: 'row', field: 'amount', lineId: day.firstLine.id, rowNumber: day.firstLine.rowNumber, message });
  }

  // Mileage drives (D-071).
  trips.forEach((trip, index) => {
    const add = (severity: Severity, field: MileageField, message: string) =>
      issues.push({ severity, scope: 'mileage', field, tripId: trip.id, tripLabel: `M${index + 1}`, message });
    const dateOk = isValidIsoDate(trip.date);
    if (!dateOk) add('blocking', 'date', messages.dateRequired);
    if (!trip.from.trim()) add('blocking', 'from', messages.mileageFromRequired);
    if (!trip.to.trim()) add('blocking', 'to', messages.mileageToRequired);
    if (trip.miles === null || trip.miles <= 0) add('blocking', 'miles', messages.mileageMilesRequired);
    if (dateOk) {
      const rate = rateFor(MILEAGE_CENTS_PER_MILE, trip.date);
      if (!rate) add('blocking', 'date', messages.mileageNoRate(trip.date));
      else if (!rate.current) add('warning', 'date', messages.rateNotCurrent);
      if (startOk && endOk && (trip.date < report.tripStart || trip.date > report.tripEnd)) add('warning', 'date', messages.dateOutsideTrip);
    }
  });

  for (const match of findDuplicates(report.reportNumber, lines, otherLines)) {
    const line = lines.find((l) => l.id === match.lineId);
    if (!line) continue;
    const sameReport = match.other.reportNumber === report.reportNumber;
    const otherRow = match.other.line.rowNumber;
    const message =
      match.kind === 'file'
        ? sameReport
          ? messages.duplicateFileInReport(otherRow)
          : messages.duplicateFileElsewhere(match.other.reportNumber, otherRow)
        : sameReport
          ? messages.duplicateEntryInReport(otherRow)
          : messages.duplicateEntryElsewhere(match.other.reportNumber, otherRow);
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
