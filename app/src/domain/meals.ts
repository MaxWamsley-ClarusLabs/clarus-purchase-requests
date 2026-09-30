// The daily meal limit flag (D-070). Meals are not limited or refused; a day
// is flagged when its meals are over the limit, or on track to be: with fewer
// than three meals entered, the day is estimated as the average meal times
// three (Max's example: one $30 meal estimates $90 for the day).

import { isValidIsoDate } from './dates';
import { DAILY_MEAL_LIMIT_CENTS, rateFor } from './rates';
import { ExpenseLine } from './types';

/** Only "Meals" rows count, however they were paid; business meals with guests cover other people. */
export const MEAL_LIMIT_CATEGORY = 'meals';
const MEALS_PER_DAY = 3;

export interface MealDay {
  date: string;
  count: number;
  totalCents: number;
  /** The actual total with three or more meals; otherwise the three-meal estimate. */
  projectedCents: number;
  limitCents: number;
  /** False when the date is past the rate table and the last known limit was used. */
  limitCurrent: boolean;
  /** The day's first meal row, which carries the warning. */
  firstLine: ExpenseLine;
}

export function mealDays(lines: readonly ExpenseLine[]): MealDay[] {
  const byDate = new Map<string, ExpenseLine[]>();
  for (const line of lines) {
    if (line.category !== MEAL_LIMIT_CATEGORY || !isValidIsoDate(line.date) || line.amountCents === null || line.amountCents <= 0) continue;
    byDate.set(line.date, [...(byDate.get(line.date) ?? []), line]);
  }
  const days: MealDay[] = [];
  for (const [date, meals] of byDate) {
    const limit = rateFor(DAILY_MEAL_LIMIT_CENTS, date);
    if (!limit) continue;
    const totalCents = meals.reduce((n, l) => n + (l.amountCents ?? 0), 0);
    const projectedCents = meals.length >= MEALS_PER_DAY ? totalCents : Math.round((totalCents / meals.length) * MEALS_PER_DAY);
    const firstLine = meals.slice().sort((a, b) => a.rowNumber - b.rowNumber)[0];
    days.push({ date, count: meals.length, totalCents, projectedCents, limitCents: limit.value, limitCurrent: limit.current, firstLine });
  }
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

/** Days whose meals are over the limit, or on track to be. */
export function mealDaysOverLimit(lines: readonly ExpenseLine[]): MealDay[] {
  return mealDays(lines).filter((d) => d.projectedCents > d.limitCents);
}
