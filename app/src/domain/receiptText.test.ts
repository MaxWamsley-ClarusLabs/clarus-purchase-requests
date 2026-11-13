import { findAmounts, findDates, findTotal, findVendor, fixDigits, guessReceiptFields } from './receiptText';

// Receipt text as the reader returns it. All vendors are made up.
describe('receipt text guesser (D-074)', () => {
  it('reads dates in ISO, US numeric and month-name forms, and rejects impossible ones', () => {
    expect(findDates('Date: 2026-09-17')).toEqual(['2026-09-17']);
    expect(findDates('09/18/26 16:05')).toEqual(['2026-09-18']);
    expect(findDates('Sep 16, 2026 7:42 AM')).toEqual(['2026-09-16']);
    expect(findDates('19-SEP-2026')).toEqual(['2026-09-19']);
    expect(findDates('2026-00-17 and 02/30/2026')).toEqual([]);
  });

  it('repairs O and l read inside numbers', () => {
    expect(fixDigits('2O26-O9-l7')).toBe('2026-09-17');
    expect(fixDigits('TOTAL Olive')).toBe('TOTAL Olive');
  });

  it('reads money amounts, with or without a dollar sign', () => {
    expect(findAmounts('Total $1,234.50')).toEqual([{ cents: 123450, dollar: true }]);
    expect(findAmounts('Latte 5.95')).toEqual([{ cents: 595, dollar: false }]);
    expect(findAmounts('Tax 8.50%')).toEqual([]);
  });

  it('takes the total from the last Total line, never the subtotal', () => {
    expect(findTotal(['Subtotal 13.20', 'Tax 1.12', 'TOTAL 14.32'])).toBe(1432);
    expect(findTotal(['Room 537.00', 'Total 612.24', 'Harbor Grill 42.10', 'Grand total $654.34'])).toBe(65434);
    expect(findTotal(['Subtotal 58.42', 'AMOUNT DUE', '58.42'])).toBe(5842);
  });

  it('reads "$1485" on a total line as $14.85 when the decimal point was lost', () => {
    expect(findTotal(['TOTAL $1485'])).toBe(1485);
  });

  it('falls back to the largest amount when no line is labelled as a total', () => {
    expect(findTotal(['Parking 4 days 72.00', 'Fee 3.00'])).toBe(7200);
    expect(findTotal(['No amounts here'])).toBeNull();
  });

  it('takes the vendor from the first name-like line at the top', () => {
    expect(findVendor(['WELCOME TO PINE STREET COFFEE', '418 Pine Street'])).toBe('Pine Street Coffee');
    expect(findVendor(['Receipt', 'www.example.com', 'Metro Parking', 'Date 2026-09-17'])).toBe('Metro Parking');
    expect(findVendor(['NORTHEAST SCIENCE', 'CONFERENCE', 'Registration'])).toBe('Northeast Science Conference');
    expect(findVendor(['city Cab Co.'])).toBe('City Cab Co');
    expect(findVendor(['12/14', '$4.00'])).toBe('');
  });

  it('guesses all three fields from a whole receipt, preferring a date on a line that says Date', () => {
    const text = ['BLUE DOOR BISTRO', 'Table 12   Server: Sam', 'Order 2026-09-01', 'Date: 09/15/2026', 'Dinner for 3 118.40', 'Tip 21.60', 'Total $140.00'];
    expect(guessReceiptFields(text)).toEqual({ vendor: 'Blue Door Bistro', date: '2026-09-15', amountCents: 14000 });
  });

  it('leaves everything empty for unreadable text', () => {
    expect(guessReceiptFields(['~~ ,. ::', ''])).toEqual({ vendor: '', date: '', amountCents: null });
  });
});
