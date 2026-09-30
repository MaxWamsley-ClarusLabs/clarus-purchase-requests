import { activeTrips, mileageAmountCents, parseMiles } from './mileage';
import { messages } from './messages';
import { computeTotals } from './totals';
import { coveredThrough, DAILY_MEAL_LIMIT_CENTS, MILEAGE_CENTS_PER_MILE, outdatedRateTables, rateFor } from './rates';
import { MileageTrip } from './types';
import { blockingIssues, issuePrefix, validateReport } from './validation';
import { line, report } from '../testing/builders';

const trip = (overrides: Partial<MileageTrip> = {}): MileageTrip => ({ id: 't1', date: '2026-10-12', from: 'Office', to: 'Airport', miles: 42, ...overrides });

describe('GSA rate tables (D-072)', () => {
  it('finds the rate for a date, and the last known rate after the table ends', () => {
    expect(rateFor(MILEAGE_CENTS_PER_MILE, '2026-03-01')).toEqual({ value: 72.5, current: true });
    expect(rateFor(MILEAGE_CENTS_PER_MILE, '2026-07-01')).toEqual({ value: 76, current: true });
    expect(rateFor(MILEAGE_CENTS_PER_MILE, '2027-01-05')).toEqual({ value: 76, current: false });
    expect(rateFor(MILEAGE_CENTS_PER_MILE, '2025-12-31')).toBeUndefined();
    expect(rateFor(DAILY_MEAL_LIMIT_CENTS, '2026-10-01')).toEqual({ value: 6800, current: true });
  });

  it('has periods in order, without gaps or overlaps', () => {
    for (const table of [MILEAGE_CENTS_PER_MILE, DAILY_MEAL_LIMIT_CENTS]) {
      for (let i = 1; i < table.length; i++) {
        const previousEnd = new Date(`${table[i - 1].to}T00:00:00Z`);
        previousEnd.setUTCDate(previousEnd.getUTCDate() + 1);
        expect(table[i].from).toBe(previousEnd.toISOString().slice(0, 10));
      }
    }
    expect(coveredThrough(MILEAGE_CENTS_PER_MILE)).toBe('2026-12-31');
  });

  it('says which tables have run out, so the administrator is told', () => {
    expect(outdatedRateTables('2026-12-31')).toEqual([]);
    expect(outdatedRateTables('2027-01-01')).toEqual(['Mileage']);
    expect(outdatedRateTables('2027-10-01')).toEqual(['Daily meal limit', 'Mileage']);
  });
});

describe('mileage (D-071)', () => {
  it('reads miles as typed', () => {
    expect(parseMiles('42')).toBe(42);
    expect(parseMiles(' 12.5 ')).toBe(12.5);
    expect(parseMiles('1,204')).toBe(1204);
    expect(parseMiles('0')).toBeNull();
    expect(parseMiles('12.55')).toBeNull();
    expect(parseMiles('ten')).toBeNull();
  });

  it('pays miles at the GSA rate for the date, rounded to the cent', () => {
    expect(mileageAmountCents(trip({ date: '2026-03-01', miles: 42 }))).toBe(3045);
    expect(mileageAmountCents(trip({ date: '2026-10-12', miles: 12.3 }))).toBe(935);
    expect(mileageAmountCents(trip({ miles: null }))).toBeNull();
    expect(mileageAmountCents(trip({ date: '2025-06-01' }))).toBeNull();
  });

  it('counts drives only while "I drove my own car" is on, all to reimburse', () => {
    const off = report({ hasMileage: false, mileageTrips: [trip()] });
    expect(activeTrips(off)).toEqual([]);
    const on = report({ hasMileage: true, mileageTrips: [trip()] });
    expect(computeTotals([line({ amountCents: 10000, paymentType: 'companyCard' })], activeTrips(on))).toEqual({
      reimburseCents: 3192,
      companyCents: 10000,
      tripCents: 13192
    });
  });

  it('checks each drive, and allows a report with drives only', () => {
    const ok = report({ hasMileage: true, mileageTrips: [trip()] });
    expect(validateReport(ok, [], [], '2026-10-20')).toEqual([]);
    const bad = report({ hasMileage: true, mileageTrips: [trip({ from: '', to: ' ', miles: null })] });
    const issues = validateReport(bad, [], [], '2026-10-20');
    expect(blockingIssues(issues).map((i) => [i.field, i.tripLabel])).toEqual([
      ['from', 'M1'],
      ['to', 'M1'],
      ['miles', 'M1']
    ]);
    expect(issuePrefix(issues[0])).toBe('Mileage M1: ');
  });

  it('asks for drives when the switch is on but none are entered', () => {
    const issues = validateReport(report({ hasMileage: true, mileageTrips: [] }), [line()], [], '2026-10-20');
    expect(blockingIssues(issues).map((i) => i.message)).toEqual([messages.mileageNone]);
  });

  it('blocks a date with no rate, and warns about a date past the table or outside the trip', () => {
    const early = validateReport(report({ hasMileage: true, mileageTrips: [trip({ date: '2025-11-02' })] }), [], [], '2026-10-20');
    expect(blockingIssues(early).map((i) => i.message)).toEqual([messages.mileageNoRate('2025-11-02')]);
    const late = validateReport(
      report({ tripStart: '2027-01-04', tripEnd: '2027-01-06', hasMileage: true, mileageTrips: [trip({ date: '2027-01-08' })] }),
      [],
      [],
      '2027-01-10'
    );
    expect(late.map((i) => [i.severity, i.message])).toEqual([
      ['warning', messages.rateNotCurrent],
      ['warning', messages.dateOutsideTrip]
    ]);
  });
});
