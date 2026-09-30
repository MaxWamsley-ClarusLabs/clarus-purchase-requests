import { centsToPlain, formatCents, parseAmountToCents } from './money';

describe('parseAmountToCents', () => {
  it('reads plain, currency and thousands formats', () => {
    expect(parseAmountToCents('452.3')).toBe(45230);
    expect(parseAmountToCents('$1,234.56')).toBe(123456);
    expect(parseAmountToCents(' 12 ')).toBe(1200);
    expect(parseAmountToCents('.5')).toBe(50);
    expect(parseAmountToCents('0')).toBe(0);
  });
  it('rejects negatives, text and more than two decimals', () => {
    expect(parseAmountToCents('-5')).toBeNull();
    expect(parseAmountToCents('abc')).toBeNull();
    expect(parseAmountToCents('1.234')).toBeNull();
    expect(parseAmountToCents('')).toBeNull();
  });
});

describe('formatting', () => {
  it('formats for display and for files', () => {
    expect(formatCents(123456)).toBe('$1,234.56');
    expect(formatCents(5)).toBe('$0.05');
    expect(centsToPlain(123456)).toBe('1234.56');
    expect(centsToPlain(5)).toBe('0.05');
  });
});
