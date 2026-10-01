import { parseClipboardTable, parsePastedDate, pasteCell, pasteWarning, planPaste } from './pasteParse';

describe('reading text copied from a spreadsheet', () => {
  it('splits rows at line breaks and cells at tabs, and ignores the line break Excel adds at the end', () => {
    expect(parseClipboardTable('2026-10-14\tAcme\r\n2026-10-15\tNorthwind\r\n')).toEqual([
      ['2026-10-14', 'Acme'],
      ['2026-10-15', 'Northwind']
    ]);
    expect(parseClipboardTable('one cell\n')).toEqual([['one cell']]);
    expect(parseClipboardTable('')).toEqual([]);
    expect(parseClipboardTable('\r\n')).toEqual([]);
  });

  it('keeps empty cells, including at the start and end of a row', () => {
    expect(parseClipboardTable('\tAcme\t\n\t\t')).toEqual([
      ['', 'Acme', ''],
      ['', '', '']
    ]);
  });

  it('keeps a quoted cell as one cell, even with a tab or a line break inside', () => {
    expect(parseClipboardTable('"Tips\tand tubes"\tAcme')).toEqual([['Tips\tand tubes', 'Acme']]);
    expect(parseClipboardTable('"Line one\r\nline two"\t12.50\r\nNext\t3')).toEqual([
      ['Line one\nline two', '12.50'],
      ['Next', '3']
    ]);
  });

  it('reads doubled quotes inside a quoted cell as one quote', () => {
    expect(parseClipboardTable('"5"" bolts, ""stainless"""\tx')).toEqual([['5" bolts, "stainless"', 'x']]);
  });

  it('keeps a quote that is not a proper quoted cell as it is', () => {
    expect(parseClipboardTable('5" bolts\tx')).toEqual([['5" bolts', 'x']]);
    expect(parseClipboardTable('"Best" kit\tx')).toEqual([['"Best" kit', 'x']]);
    expect(parseClipboardTable('"never closed\tx')).toEqual([['"never closed', 'x']]);
  });
});

describe('pasted dates', () => {
  it.each([
    ['2026-10-14', '2026-10-14'],
    ['2026/10/14', '2026-10-14'],
    ['2026-1-5', '2026-01-05'],
    ['10/14/2026', '2026-10-14'],
    ['1/5/2026', '2026-01-05'],
    ['Oct 14, 2026', '2026-10-14'],
    ['oct. 14 2026', '2026-10-14'],
    ['October 14, 2026', '2026-10-14'],
    ['Sept 3, 2026', '2026-09-03'],
    ['14 Oct 2026', '2026-10-14'],
    ['14-Oct-2026', '2026-10-14'],
    ['  14 October 2026 ', '2026-10-14']
  ])('reads %s as %s', (text, iso) => {
    expect(parsePastedDate(text)).toBe(iso);
  });

  it.each([
    ['a two-digit year', '10/14/26'],
    ['a year before 2000', '1999-12-31'],
    ['a year after 2099', '2100-01-01'],
    ['a six-digit year', '202610-10-14'],
    ['a day first, as in Europe', '14/10/2026'],
    ['a date that does not exist', '2026-02-30'],
    ['mixed separators', '2026-10/14'],
    ['a month name that is not one', 'Okt 14, 2026'],
    ['words', 'last Tuesday'],
    ['a number', '46309']
  ])('refuses %s (%s)', (_what, text) => {
    expect(parsePastedDate(text)).toBeNull();
  });
});

describe('one pasted cell', () => {
  it('changes nothing for an empty cell', () => {
    expect(pasteCell('vendor', '   ')).toEqual({ changes: null });
    expect(pasteCell('amount', '')).toEqual({ changes: null });
  });

  it('writes an amount the app way, and empties the amount for one that is not an amount', () => {
    expect(pasteCell('amount', '$1,234.5')).toEqual({ changes: { amountCents: 123450 }, amountText: '1234.50' });
    expect(pasteCell('amount', '12,50')).toEqual({ changes: { amountCents: null }, amountText: '12,50', problem: 'amount' });
  });

  it('matches a category by its name, whatever the capitals and spaces, and reads "Other: description"', () => {
    expect(pasteCell('category', 'office  supplies')).toEqual({ changes: { category: 'office' } });
    expect(pasteCell('category', 'Computer, H/W & S/W Supplies')).toEqual({ changes: { category: 'computer' } });
    expect(pasteCell('category', 'Other: Lab furniture')).toEqual({ changes: { category: 'other', categoryOther: 'Lab furniture' }, cut: false });
    expect(pasteCell('category', 'Stationery')).toEqual({ changes: null, problem: 'category' });
  });

  it('matches who paid by its name', () => {
    expect(pasteCell('paidBy', 'employee')).toEqual({ changes: { paidBy: 'employee' } });
    expect(pasteCell('paidBy', 'Me')).toEqual({ changes: null, problem: 'paidBy' });
  });

  it('puts text on one line and cuts it at the longest text a box holds', () => {
    expect(pasteCell('description', ' Tips\nand\ttubes ')).toEqual({ changes: { description: 'Tips and tubes' }, cut: false });
    const long = pasteCell('vendor', 'x'.repeat(300));
    expect(long.changes).toEqual({ vendor: 'x'.repeat(255) });
    expect(long.cut).toBe(true);
  });

  it('does not use a date it cannot read', () => {
    expect(pasteCell('date', '10/14/2026')).toEqual({ changes: { date: '2026-10-14' } });
    expect(pasteCell('date', '0026-10-14')).toEqual({ changes: null, problem: 'date' });
  });
});

describe('a whole paste', () => {
  const ids = ['a', 'b', 'c'];

  it('fills the cells below and to the right of the cell pasted into', () => {
    const plan = planPaste(
      [
        ['Acme Lab Supply', 'Tips', 'Office Supplies'],
        ['Northwind', 'Labels', 'Shipping/Postage']
      ],
      ids,
      1,
      1
    );
    expect(plan.rows).toEqual([
      { lineId: 'b', changes: { vendor: 'Acme Lab Supply', description: 'Tips', category: 'office' } },
      { lineId: 'c', changes: { vendor: 'Northwind', description: 'Labels', category: 'shipping' } }
    ]);
    expect(pasteWarning(plan)).toBe('');
  });

  it('counts the rows that do not fit, and ignores empty ones', () => {
    const table = [['1'], ['2'], ['3'], ['4'], [''], ['5']];
    const plan = planPaste(table, ids, 1, 4);
    expect(plan.rows.map((r) => r.lineId)).toEqual(['b', 'c']);
    expect(plan.rowsLeftOver).toBe(3);
    expect(pasteWarning(plan)).toBe(
      '3 rows were not pasted: there are no rows for them below. Add 3 rows first (Add purchase without a file), then paste them again.'
    );
    expect(pasteWarning(planPaste([['1'], ['2'], ['3'], ['4']], ids, 0, 4))).toContain('1 row was not pasted: there is no row for it below. Add 1 row first');
  });

  it('says how many cells were not pasted and why, once', () => {
    const plan = planPaste(
      [
        ['14/10/2026', 'Acme', 'Tips', 'Stationery', '12,50', 'Company', 'extra'],
        ['2026-10-15', 'Northwind', 'Labels', 'Office Supplies', '3', 'Employee', '']
      ],
      ids,
      0,
      0
    );
    expect(plan.skipped).toEqual({ date: 1, category: 1, amount: 1, outside: 1 });
    expect(plan.rows[0]).toEqual({ lineId: 'a', changes: { vendor: 'Acme', description: 'Tips', amountCents: null, paidBy: 'company' }, amountText: '12,50' });
    expect(plan.rows[1].amountText).toBe('3.00');
    expect(pasteWarning(plan)).toBe(
      '4 cells were not pasted: dates must look like 2026-10-14, 10/14/2026 or Oct 14, 2026; categories must match a category name; amounts must be numbers like 45.10; cells to the right of Who paid do not fit.'
    );
  });

  it('counts text that was cut', () => {
    const plan = planPaste([['x'.repeat(256), 'y']], ids, 0, 1);
    expect(plan.cut).toBe(1);
    expect(pasteWarning(plan)).toBe('1 cell was cut to 255 characters, the most a box holds.');
  });
});
