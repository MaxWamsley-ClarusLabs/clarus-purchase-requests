// Mileage in the employee's own car (D-071): drives entered on the Expenses
// step when "I drove my own car" is on, paid at the GSA rate for each date.
// Drives are numbered M1, M2 and so on, apart from the receipt rows.

import { MILEAGE_CENTS_PER_MILE, rateFor } from './rates';
import { MileageTrip, TravelReport } from './types';

/** How mileage rows appear in the CSV (D-071). */
export const MILEAGE = {
  label: 'Mileage',
  suggestedAccount: '6104 Transportation',
  paymentLabel: 'Personal vehicle (reimburse me)',
  noReceiptReason: 'Mileage: no receipt needed'
} as const;

/** The drives that count: none while the switch is off. */
export function activeTrips(report: Pick<TravelReport, 'hasMileage' | 'mileageTrips'>): MileageTrip[] {
  return report.hasMileage ? report.mileageTrips : [];
}

export function tripLabel(index: number): string {
  return `M${index + 1}`;
}

/** Whole cents for a drive, or null until it has a date with a rate and its miles. */
export function mileageAmountCents(trip: MileageTrip): number | null {
  if (trip.miles === null || trip.miles <= 0 || !trip.date) return null;
  const rate = rateFor(MILEAGE_CENTS_PER_MILE, trip.date);
  return rate ? Math.round(trip.miles * rate.value) : null;
}

/** Reads miles as typed ("42", "12.5", "1,204"); null if it is not a positive number. */
export function parseMiles(text: string): number | null {
  const cleaned = text.trim().replace(/,/g, '');
  if (!/^\d+(\.\d)?$/.test(cleaned)) return null;
  const miles = Number(cleaned);
  return miles > 0 ? miles : null;
}

/** "76 cents a mile" or "72.5 cents a mile". */
export function rateText(centsPerMile: number): string {
  return `${centsPerMile} cents a mile`;
}
