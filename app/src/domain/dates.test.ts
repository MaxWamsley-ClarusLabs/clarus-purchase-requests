import { FIRST_YEAR, LAST_YEAR, dateRange, dateRangeText, isValidIsoDate, toLocalDateTime } from './dates';

describe('isValidIsoDate', () => {
  it('accepts real dates only', () => {
    expect(isValidIsoDate('2026-10-12')).toBe(true);
    expect(isValidIsoDate('2028-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('10/12/2026')).toBe(false);
    expect(isValidIsoDate('')).toBe(false);
  });

  it('accepts the years 2000 to 2099 only, so a date typed into the wrong part of a date box is caught', () => {
    expect([FIRST_YEAR, LAST_YEAR]).toEqual([2000, 2099]);
    expect(isValidIsoDate('2000-01-01')).toBe(true);
    expect(isValidIsoDate('2099-12-31')).toBe(true);
    // 101426 typed into a date box can be stored as year 0026 or 1014.
    expect(isValidIsoDate('0026-10-14')).toBe(false);
    expect(isValidIsoDate('1014-02-06')).toBe(false);
    expect(isValidIsoDate('1999-12-31')).toBe(false);
    expect(isValidIsoDate('2100-01-01')).toBe(false);
  });

  it('leaves dates outside those years out of the purchase dates', () => {
    expect(dateRangeText(['0026-10-14', '2026-10-14'])).toBe('2026-10-14');
  });
});

describe('toLocalDateTime', () => {
  it('formats as YYYY-MM-DD HH:MM', () => {
    expect(toLocalDateTime(new Date(2026, 9, 20, 9, 5))).toBe('2026-10-20 09:05');
  });
});

describe('dateRange', () => {
  it('finds the earliest and latest valid dates, ignoring blanks and invalid text', () => {
    expect(dateRange(['2026-10-14', '', '2026-10-12', 'soon', '2026-10-13'])).toEqual({ first: '2026-10-12', last: '2026-10-14' });
    expect(dateRange([])).toEqual({ first: '', last: '' });
  });
  it('writes the purchase dates as one date or a range', () => {
    expect(dateRangeText(['2026-10-12', '2026-10-14'])).toBe('2026-10-12 to 2026-10-14');
    expect(dateRangeText(['2026-10-12', '2026-10-12'])).toBe('2026-10-12');
    expect(dateRangeText([''])).toBe('');
  });
});
