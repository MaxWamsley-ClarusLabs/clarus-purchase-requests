// GSA rates the app uses (D-072), kept here as dated tables. Claude updates them
// when GSA publishes new rates: meals each October (federal fiscal year),
// mileage each January and whenever GSA changes it mid-year. Max then uploads
// the new app package. A date after the last period uses the last known rate
// and gets a warning, so an out-of-date table is noticed.

import { IsoDate } from './types';

export interface RatePeriod {
  from: IsoDate;
  to: IsoDate;
  value: number;
  source: string;
}

/**
 * Daily meal limit in cents: GSA's standard per diem for meals and incidentals
 * in the lower 48 states (D-070). The same every day of a trip; the first and
 * last day are not reduced.
 */
export const DAILY_MEAL_LIMIT_CENTS: readonly RatePeriod[] = [
  {
    from: '2024-10-01',
    to: '2027-09-30',
    value: 6800,
    source: 'GSA standard CONUS M&IE $68, FY2025 to FY2027 (Federal Register FY2027 notice, 2026-09-10). Unverified: search snippets, 2026-09-24'
  }
];

/** Mileage in cents per mile for a personal car: GSA's POV rate (D-071). */
export const MILEAGE_CENTS_PER_MILE: readonly RatePeriod[] = [
  {
    from: '2026-01-01',
    to: '2026-06-30',
    value: 72.5,
    source: 'GSA POV rate CY2026 (Federal Register, 2026-01-02). Unverified: search snippets, 2026-09-24'
  },
  {
    from: '2026-07-01',
    to: '2026-12-31',
    value: 76,
    source: 'GSA POV rate, midyear increase from 2026-07-01 (Federal Register, 2026-08-11). Unverified: search snippets, 2026-09-24'
  }
];

export interface RateLookup {
  value: number;
  /** False when the date is after the last period and the last known rate was used. */
  current: boolean;
}

/** The rate for a date, or undefined before the first period. */
export function rateFor(table: readonly RatePeriod[], date: IsoDate): RateLookup | undefined {
  const period = table.find((p) => date >= p.from && date <= p.to);
  if (period) return { value: period.value, current: true };
  const last = table[table.length - 1];
  if (last && date > last.to) return { value: last.value, current: false };
  return undefined;
}

/** The last date a table covers. */
export function coveredThrough(table: readonly RatePeriod[]): IsoDate {
  return table[table.length - 1].to;
}

/** The rate tables with names, for the administrator's Set-up page. */
export const RATE_TABLES = [
  { name: 'Daily meal limit', table: DAILY_MEAL_LIMIT_CENTS, unit: 'cents a day' },
  { name: 'Mileage', table: MILEAGE_CENTS_PER_MILE, unit: 'cents a mile' }
] as const;

/** Tables that end before a date: their rates need updating (D-072). */
export function outdatedRateTables(today: IsoDate): string[] {
  return RATE_TABLES.filter((t) => today > coveredThrough(t.table)).map((t) => t.name);
}
