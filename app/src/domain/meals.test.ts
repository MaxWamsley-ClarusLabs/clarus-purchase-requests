import { mealDays, mealDaysOverLimit } from './meals';
import { messages } from './messages';
import { validateReport } from './validation';
import { line, receipt, report } from '../testing/builders';

const meal = (id: string, rowNumber: number, date: string, cents: number, extra = {}) =>
  line({ id, rowNumber, date, category: 'meals', amountCents: cents, vendor: `Cafe ${id}`, receipts: [receipt({ id, fingerprint: id })], ...extra });

describe('daily meal limit (D-070)', () => {
  it("flags one $30 meal as on track to be over (Max's example: about $90 for three meals)", () => {
    const [day] = mealDaysOverLimit([meal('a', 1, '2026-10-13', 3000)]);
    expect(day).toMatchObject({ date: '2026-10-13', count: 1, totalCents: 3000, projectedCents: 9000, limitCents: 6800, limitCurrent: true });
  });

  it('uses the actual total once a day has three meals', () => {
    const lines = [meal('a', 1, '2026-10-13', 1200), meal('b', 2, '2026-10-13', 1800), meal('c', 3, '2026-10-13', 3000)];
    expect(mealDaysOverLimit(lines)).toEqual([]);
    const over = [...lines, meal('d', 4, '2026-10-13', 1000)];
    expect(mealDaysOverLimit(over)[0]).toMatchObject({ count: 4, totalCents: 7000, projectedCents: 7000 });
  });

  it('does not flag a day within the limit, and counts only Meals rows, however paid', () => {
    expect(mealDaysOverLimit([meal('a', 1, '2026-10-13', 2000), meal('b', 2, '2026-10-13', 2400)])).toEqual([]);
    const lines = [
      meal('a', 1, '2026-10-13', 4000, { paymentType: 'companyCard' }),
      line({ id: 'g', rowNumber: 2, date: '2026-10-13', category: 'businessMeal', amountCents: 20000 })
    ];
    expect(mealDays(lines)).toHaveLength(1);
    expect(mealDays(lines)[0].totalCents).toBe(4000);
  });

  it('warns on the first meal row of the day, and never blocks', () => {
    expect(validateReport(report(), [meal('a', 2, '2026-10-13', 1500), meal('b', 1, '2026-10-13', 1000)], [], '2026-10-20')).toEqual([]);
    const over = validateReport(report(), [meal('a', 2, '2026-10-13', 5000), meal('b', 1, '2026-10-13', 1000)], [], '2026-10-20');
    expect(over).toEqual([
      {
        severity: 'warning',
        scope: 'row',
        field: 'amount',
        lineId: 'b',
        rowNumber: 1,
        message: messages.mealsProjectedOver('2026-10-13', '$60.00', 2, '$90.00', '$68.00')
      }
    ]);
  });

  it('says when the limit for a date is past the rate table', () => {
    const [issue] = validateReport(report({ tripStart: '2027-10-10', tripEnd: '2027-10-12' }), [meal('a', 1, '2027-10-11', 9000)], [], '2027-10-20');
    expect(issue.message).toBe(`${messages.mealsProjectedOver('2027-10-11', '$90.00', 1, '$270.00', '$68.00')} ${messages.rateNotCurrent}`);
  });
});
