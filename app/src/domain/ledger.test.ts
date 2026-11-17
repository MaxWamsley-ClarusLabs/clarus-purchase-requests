import { ledgerRow, line } from '../testing/builders';
import {
  LEDGER_NOTE_MAX,
  changedSincePosted,
  effectiveAccount,
  entryChangeProblem,
  filterLedger,
  focusCounts,
  inLedger,
  isKnownAccount,
  isKnownClass,
  ledgerPaidBy,
  needsAdministrator,
  postProblem,
  sortLedger,
  sortLedgerBy
} from './ledger';
import { CATEGORIES, CLASS_REQUIRED, LEDGER_ACCOUNTS, LEDGER_CLASSES, accountText, defaultLedgerAccount, findLedgerAccount } from './purchaseRules';

const ACCOUNT = '6182 R&D Materials & Supplies';
const CLASS = '5.0 Internal R&D';

describe('the account and class lists (P-053 to P-055)', () => {
  it('has the 56 accounts and 7 classes Max chose, with no duplicates', () => {
    expect(LEDGER_ACCOUNTS).toHaveLength(56);
    expect(new Set(LEDGER_ACCOUNTS.map((a) => a.number)).size).toBe(56);
    expect(LEDGER_CLASSES).toHaveLength(7);
    expect(new Set(LEDGER_CLASSES.map((c) => c.name)).size).toBe(7);
  });

  it("puts the accounts in Max's order: his 14 first, then the rest by number", () => {
    const numbers = LEDGER_ACCOUNTS.map((a) => a.number);
    expect(numbers.slice(0, 14)).toEqual(['6182', '6178', '6180', '6184', '6150', '6500', '6175', '1415', '6215', '6050', '6155', '6170', '6185', '5050']);
    const rest = numbers.slice(14).map(Number);
    expect([...rest].sort((a, b) => a - b)).toEqual(rest);
  });

  it("puts the classes in Max's order and shows a grant class with its parent", () => {
    expect(LEDGER_CLASSES.map((c) => c.name)).toEqual([
      '5.0 Internal R&D',
      '1.0 Grants:1.01 NSF Phase 1 SBIR',
      '1.0 Grants:1.03 NSF Phase 2 SBIR',
      '1.0 Grants:1.02 X Competition',
      '8.0 Indirect Expenses',
      '2.0 Commercial',
      '9.0 Unallowable Expenses'
    ]);
  });

  it('leaves out the numberless QuickBooks accounts, the parent grant class and Other Income', () => {
    const names = LEDGER_ACCOUNTS.map((a) => a.name);
    for (const left of ['Insurance', 'Office expenses', 'Purchases', 'Uncategorized Expense', 'Vehicle expenses', 'Reconciliation Discrepancies'])
      expect(names).not.toContain(left);
    expect(LEDGER_CLASSES.map((c) => c.name)).not.toContain('1.0 Grants');
    expect(LEDGER_CLASSES.map((c) => c.name)).not.toContain('3.0 Other Income');
  });

  it('has every category account in the list, with the same number and name (checked against the 2026-11-15 export)', () => {
    for (const category of CATEGORIES.filter((c) => c.accountNumber !== '')) {
      const found = findLedgerAccount(category.accountNumber);
      expect(found !== undefined && category.accountText.startsWith(accountText(found))).toBe(true);
    }
  });

  it('starts a line with its category account, and with none for Other', () => {
    expect(defaultLedgerAccount('rdMaterials')).toBe(ACCOUNT);
    expect(defaultLedgerAccount('equipment')).toBe('6175 Equipment');
    expect(defaultLedgerAccount('other')).toBe('');
    expect(defaultLedgerAccount('')).toBe('');
  });
});

describe('posting a line (P-056)', () => {
  it('needs an account and a class from the lists', () => {
    expect(CLASS_REQUIRED).toBe(true);
    expect(postProblem(ledgerRow({ entry: { account: ACCOUNT } }))).toContain('choose a class');
    expect(postProblem(ledgerRow({ line: line({ category: 'other' }), entry: { className: CLASS } }))).toContain('choose an account');
    expect(postProblem(ledgerRow({ entry: { account: ACCOUNT, className: CLASS } }))).toBe('');
  });

  it('counts the category account when none is chosen', () => {
    const row = ledgerRow({ entry: { className: CLASS } });
    expect(effectiveAccount(row)).toBe(ACCOUNT);
    expect(postProblem(row)).toBe('');
  });

  it('refuses an account or class that is not in the lists, such as one typed into SharePoint', () => {
    expect(postProblem(ledgerRow({ entry: { account: '9999 Made up', className: CLASS } }))).toContain('not in the account list');
    expect(postProblem(ledgerRow({ entry: { account: ACCOUNT, className: 'Nonsense' } }))).toContain('not in the class list');
    expect(isKnownAccount(ACCOUNT)).toBe(true);
    expect(isKnownAccount('6182')).toBe(false);
    expect(isKnownClass(CLASS)).toBe(true);
  });

  it('has nothing to check on a line that is already posted', () => {
    expect(postProblem(ledgerRow({ entry: { posted: true } }))).toBe('');
  });
});

describe("changing a line's account or class", () => {
  it('is refused while the line is Posted, until it is set back', () => {
    expect(entryChangeProblem(ledgerRow({ entry: { posted: true } }), { account: ACCOUNT })).toContain('Set it back to Not posted');
    expect(entryChangeProblem(ledgerRow(), { account: ACCOUNT })).toBe('');
  });

  it('accepts only items from the lists, and clearing', () => {
    expect(entryChangeProblem(ledgerRow(), { account: 'Hand typed' })).toContain('from the list');
    expect(entryChangeProblem(ledgerRow(), { className: 'Hand typed' })).toContain('from the list');
    expect(entryChangeProblem(ledgerRow(), { account: '', className: '' })).toBe('');
  });
});

describe('which lines are in the Ledger', () => {
  it('are those of requests that are bought and packaged', () => {
    expect(['Draft', 'Awaiting approval', 'Approved', 'Returned'].some((s) => inLedger(s as never))).toBe(false);
    expect(inLedger('Submitted')).toBe(true);
    expect(inLedger('Processed')).toBe(true);
  });

  it('says the company paid for everything the approver bought', () => {
    expect(ledgerPaidBy(ledgerRow({ buyer: 'approver', line: line({ paidBy: 'employee' }) }))).toEqual({ label: 'Company', reimbursable: false });
    expect(ledgerPaidBy(ledgerRow({ buyer: 'self', line: line({ paidBy: 'employee' }) }))?.reimbursable).toBe(true);
  });
});

describe('filtering and sorting', () => {
  const rows = [
    ledgerRow({ requestNumber: 'PR-0001', line: line({ id: 'a', rowNumber: 2, vendor: 'Northside Lab Supply' }) }),
    ledgerRow({
      requestNumber: 'PR-0001',
      line: line({ id: 'b', rowNumber: 1, vendor: 'Brightline Hosting', category: 'subscriptions' }),
      entry: { posted: true, account: '6150 Dues and Subscriptions', className: CLASS }
    }),
    ledgerRow({ requestNumber: 'PR-0002', line: line({ id: 'c', rowNumber: 1, vendor: 'Granite Equipment Co' }) })
  ];

  it('filters by posted state', () => {
    expect(filterLedger(rows, 'notPosted', '').map((r) => r.line.id)).toEqual(['a', 'c']);
    expect(filterLedger(rows, 'posted', '').map((r) => r.line.id)).toEqual(['b']);
    expect(filterLedger(rows, 'all', '')).toHaveLength(3);
  });

  it('searches every word across request, vendor, description, account and class', () => {
    expect(filterLedger(rows, 'all', 'brightline').map((r) => r.line.id)).toEqual(['b']);
    expect(filterLedger(rows, 'all', 'pr-0002 granite').map((r) => r.line.id)).toEqual(['c']);
    expect(filterLedger(rows, 'all', 'subscriptions internal').map((r) => r.line.id)).toEqual(['b']);
    expect(filterLedger(rows, 'all', 'nothing like this')).toHaveLength(0);
  });

  it('lists newest requests first and rows in order', () => {
    expect(sortLedger(rows).map((r) => r.line.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('notes (P-060)', () => {
  it('can be written on a Posted line, which is otherwise locked', () => {
    const posted = ledgerRow({ entry: { posted: true } });
    expect(entryChangeProblem(posted, { note: 'Split with the next row' })).toBe('');
    expect(entryChangeProblem(posted, { account: ACCOUNT })).toContain('Set it back to Not posted');
    expect(entryChangeProblem(posted, { note: 'x', className: CLASS })).toContain('Set it back to Not posted');
  });

  it('are refused when longer than a one-line column holds', () => {
    expect(entryChangeProblem(ledgerRow(), { note: 'x'.repeat(LEDGER_NOTE_MAX) })).toBe('');
    expect(entryChangeProblem(ledgerRow(), { note: 'x'.repeat(LEDGER_NOTE_MAX + 1) })).toContain('at most 255');
  });

  it('are found by the search', () => {
    const rows = [ledgerRow({ line: line({ id: 'a' }), entry: { note: 'vendor credit pending' } }), ledgerRow({ line: line({ id: 'b' }) })];
    expect(filterLedger(rows, 'all', 'credit pending').map((r) => r.line.id)).toEqual(['a']);
  });
});

describe('a posted line that changed since it was posted (P-060)', () => {
  const posted = (now: number | null, was: number | null) => ledgerRow({ line: line({ amountCents: now }), entry: { posted: true, postedAmountCents: was } });

  it('shows what it was and what it is now', () => {
    expect(changedSincePosted(posted(12500, 10000))).toEqual({ wasCents: 10000, nowCents: 12500 });
    expect(changedSincePosted(posted(null, 10000))).toEqual({ wasCents: 10000, nowCents: null });
  });

  it('says nothing when the amount is the same, when no amount was recorded, or when the line is not posted', () => {
    expect(changedSincePosted(posted(10000, 10000))).toBeNull();
    expect(changedSincePosted(posted(10000, null))).toBeNull();
    expect(changedSincePosted(ledgerRow({ line: line({ amountCents: 5 }), entry: { posted: false, postedAmountCents: 10000 } }))).toBeNull();
  });
});

describe('looking inside a tab (P-060)', () => {
  const rows = [
    ledgerRow({ line: line({ id: 'needs-class', vendor: 'B Co' }), entry: { account: ACCOUNT } }),
    ledgerRow({ line: line({ id: 'needs-account', category: 'other', vendor: 'A Co' }), entry: { className: CLASS } }),
    ledgerRow({
      line: line({ id: 'equipment', category: 'equipment', categoryConfirmedBy: '', vendor: 'C Co', amountCents: 90000 }),
      entry: { className: CLASS }
    }),
    ledgerRow({ line: line({ id: 'confirmed', category: 'equipment', categoryConfirmedBy: 'Max Wamsley', vendor: 'D Co' }), entry: { className: CLASS } }),
    ledgerRow({ line: line({ id: 'changed', amountCents: 200 }), entry: { posted: true, postedAmountCents: 100, className: CLASS, account: ACCOUNT } })
  ];
  const ids = (focus: Parameters<typeof filterLedger>[3]) => filterLedger(rows, 'all', '', focus).map((r) => r.line.id);

  it('finds the lines that still need a class, or an account', () => {
    expect(ids('needsClass')).toEqual(['needs-class']);
    expect(ids('needsAccount')).toEqual(['needs-account']);
  });

  it('finds the lines that changed since posting, and those the administrator still has to decide', () => {
    expect(ids('changed')).toEqual(['changed']);
    expect(ids('review')).toEqual(['needs-account', 'equipment']);
    expect(needsAdministrator(rows[3])).toBe(false);
  });

  it('counts each look for the labels, inside the tab and search', () => {
    const counts = focusCounts(rows, 'notPosted', '');
    expect(counts).toEqual({ any: 4, needsClass: 1, needsAccount: 1, changed: 0, review: 2 });
    expect(focusCounts(rows, 'posted', '').changed).toBe(1);
  });
});

describe('sorting (P-060)', () => {
  const rows = [
    ledgerRow({ requestNumber: 'PR-0002', line: line({ id: 'x', rowNumber: 1, vendor: 'zeta', date: '2026-10-01', amountCents: 100 }) }),
    ledgerRow({ requestNumber: 'PR-0002', line: line({ id: 'y', rowNumber: 2, vendor: 'Alpha', date: '2026-10-09', amountCents: 900 }) }),
    ledgerRow({ requestNumber: 'PR-0001', line: line({ id: 'z', rowNumber: 1, vendor: 'alpha', date: '2026-09-15', amountCents: 500 }) })
  ];
  const ids = (sort: Parameters<typeof sortLedgerBy>[1]) => sortLedgerBy(rows, sort).map((r) => r.line.id);

  it('puts requests newest first by default, and the other orders by vendor, date and amount', () => {
    expect(ids('request')).toEqual(['x', 'y', 'z']);
    expect(ids('vendor')).toEqual(['y', 'z', 'x']); // alpha ties in any letter case, then the default order
    expect(ids('date')).toEqual(['z', 'x', 'y']);
    expect(ids('amount')).toEqual(['y', 'z', 'x']);
  });

  it('gives the same order for the same lines, and leaves the input alone', () => {
    const before = rows.map((r) => r.line.id);
    expect(ids('vendor')).toEqual(ids('vendor'));
    expect(rows.map((r) => r.line.id)).toEqual(before);
    expect(sortLedger(rows).map((r) => r.line.id)).toEqual(['x', 'y', 'z']);
  });
});
