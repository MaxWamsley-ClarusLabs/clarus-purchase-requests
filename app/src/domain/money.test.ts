import { MAX_AMOUNT_CENTS, centsToPlain, formatCents, formatDollars, parseAmountToCents } from './money';

describe('parseAmountToCents', () => {
  it('reads plain, currency and thousands formats', () => {
    expect(parseAmountToCents('452.3')).toBe(45230);
    expect(parseAmountToCents('$1,234.56')).toBe(123456);
    expect(parseAmountToCents('$ 1,234.56')).toBe(123456);
    expect(parseAmountToCents('1,234')).toBe(123400);
    expect(parseAmountToCents('1,234,567.80')).toBe(123456780);
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

  it('accepts a comma only between groups of three digits, so a decimal comma is refused, not read as a larger amount', () => {
    expect(parseAmountToCents('12,50')).toBeNull();
    expect(parseAmountToCents('500,00')).toBeNull();
    expect(parseAmountToCents('1,23')).toBeNull();
    expect(parseAmountToCents('1,2,3.00')).toBeNull();
    expect(parseAmountToCents('1234,567')).toBeNull();
    expect(parseAmountToCents(',123')).toBeNull();
    expect(parseAmountToCents('1,234,')).toBeNull();
    expect(parseAmountToCents('1,234.567')).toBeNull();
  });

  it('refuses an amount over $10,000,000.00, a check that it was typed as meant', () => {
    expect(MAX_AMOUNT_CENTS).toBe(1000000000);
    expect(parseAmountToCents('10,000,000.00')).toBe(MAX_AMOUNT_CENTS);
    expect(parseAmountToCents('10000000.01')).toBeNull();
    expect(parseAmountToCents('4111111111111111')).toBeNull();
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

describe('formatDollars', () => {
  it('drops the cents from whole-dollar amounts, for prose', () => {
    expect(formatDollars(50000)).toBe('$500');
    expect(formatDollars(123400)).toBe('$1,234');
    expect(formatDollars(50050)).toBe('$500.50');
  });
});
