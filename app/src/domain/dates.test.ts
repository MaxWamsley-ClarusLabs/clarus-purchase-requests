import { isValidIsoDate, toLocalDateTime } from './dates';

describe('isValidIsoDate', () => {
  it('accepts real dates only', () => {
    expect(isValidIsoDate('2026-10-12')).toBe(true);
    expect(isValidIsoDate('2028-02-29')).toBe(true);
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('10/12/2026')).toBe(false);
    expect(isValidIsoDate('')).toBe(false);
  });
});

describe('toLocalDateTime', () => {
  it('formats as YYYY-MM-DD HH:MM', () => {
    expect(toLocalDateTime(new Date(2026, 9, 20, 9, 5))).toBe('2026-10-20 09:05');
  });
});
