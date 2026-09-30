import {
  APPROVAL_THRESHOLD_CENTS,
  APPROVAL_THRESHOLD_TEXT,
  CATEGORIES,
  CERTIFICATION,
  EMPTY_APPROVAL,
  OVERRUN_TOLERANCE_PERCENT,
  PAID_BY_OPTIONS,
  PROJECT_QUICK_PICKS,
  QUICKBOOKS_MAPPING_STATUS,
  QUOTE_THRESHOLD_CENTS,
  allowedCents,
  anyBoughtBefore,
  approvalCoverage,
  approvalState,
  categoryText,
  findCategory,
  findPaidBy,
  groupsForApproval,
  groupsForApproved,
  groupsNeedingApproval,
  isAlreadyBought,
  isSelfApproved,
  lineApprovals,
  mustSendForApproval,
  quoteGaps,
  requiresApproval,
  vendorGroups,
  vendorKey
} from './purchaseRules';
import { ApprovalRecord } from './types';

// Plain lines for the threshold rules: only vendor and amount matter.
const l = (id: string, vendor: string, amountCents: number | null) => ({ id, vendor, amountCents });

describe('the policy numbers and wording (P-004, P-005, P-010, P-012)', () => {
  it('approval is needed at $500 or more, and so is the quote rule', () => {
    expect(APPROVAL_THRESHOLD_CENTS).toBe(50000);
    expect(QUOTE_THRESHOLD_CENTS).toBe(50000);
    expect(APPROVAL_THRESHOLD_TEXT).toBe('$500');
  });

  it("the certification is the F2 form's sentence, exactly", () => {
    expect(CERTIFICATION).toBe(
      'I certify that the listed purchases are for official Clarus Labs business purposes, are not personal expenses, have not been reimbursed elsewhere, and that the information provided is accurate to the best of my knowledge.'
    );
  });

  it('has the eight categories from the form, in order', () => {
    expect(CATEGORIES.map((c) => c.label)).toEqual([
      'R&D Materials & Supplies / Equipment',
      'Advertising/Marketing/Website',
      'Computer, H/W & S/W Supplies',
      'Office Supplies',
      'Training and Education',
      'Shipping/Postage',
      'Business Insurance',
      'Other'
    ]);
    expect(new Set(CATEGORIES.map((c) => c.id)).size).toBe(8);
  });

  it('suggests an account name for every category except Other, and marks the mapping unverified (P-025)', () => {
    expect(QUICKBOOKS_MAPPING_STATUS).toBe('Unverified, to confirm with Max');
    for (const c of CATEGORIES) {
      if (c.id === 'other') expect(c.suggestedAccount).toBe('');
      else expect(c.suggestedAccount.length).toBeGreaterThan(0);
      // No invented account numbers.
      expect(c.suggestedAccount).not.toMatch(/\d/);
    }
  });

  it('offers the NSF SBIR Phase 1 award as a quick pick only', () => {
    expect(PROJECT_QUICK_PICKS).toEqual(['NSF SBIR Phase 1 (Award # 2528301)']);
  });

  it('has two ways to have paid; only the employee is reimbursed (P-011)', () => {
    expect(PAID_BY_OPTIONS.map((p) => [p.id, p.label, p.reimbursable])).toEqual([
      ['company', 'Company', false],
      ['employee', 'Employee', true]
    ]);
    expect(findPaidBy('employee')?.reimbursable).toBe(true);
    expect(findPaidBy('x')).toBeUndefined();
  });

  it('finds categories and writes Other with its description', () => {
    expect(findCategory('office')?.label).toBe('Office Supplies');
    expect(findCategory('nope')).toBeUndefined();
    expect(categoryText('office', 'ignored')).toBe('Office Supplies');
    expect(categoryText('other', ' Lab safety audit ')).toBe('Other: Lab safety audit');
    expect(categoryText('other', '')).toBe('Other');
    expect(categoryText('', '')).toBe('');
  });
});

describe('how vendor totals are counted (P-016)', () => {
  it('matches vendors ignoring capitals, spaces and punctuation', () => {
    expect(vendorKey(" Joe's  Diner, Inc. ")).toBe('joes diner inc');
    expect(vendorKey('AMAZON.')).toBe(vendorKey('amazon'));
    expect(vendorKey('City Cab Co.')).toBe(vendorKey('CITY CAB CO'));
    expect(vendorKey('Amazon')).not.toBe(vendorKey('Amazon Web Services'));
  });

  it('adds up the same vendor across lines, so a purchase cannot be split to avoid approval', () => {
    const groups = vendorGroups([l('a', 'Acme Lab Supply', 20000), l('b', 'acme lab supply.', 20000), l('c', 'ACME LAB SUPPLY', 20000)]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ totalCents: 60000, lineIds: ['a', 'b', 'c'], needsApproval: true, needsQuote: true, vendor: 'Acme Lab Supply' });
  });

  it('counts each vendor on its own: two vendors at $300 need no approval', () => {
    const groups = vendorGroups([l('a', 'Acme', 30000), l('b', 'Borealis', 30000)]);
    expect(groups.map((g) => g.needsApproval)).toEqual([false, false]);
    expect(requiresApproval([l('a', 'Acme', 30000), l('b', 'Borealis', 30000)])).toBe(false);
  });

  it('needs approval at exactly $500.00 and not at $499.99', () => {
    expect(vendorGroups([l('a', 'Acme', 50000)])[0].needsApproval).toBe(true);
    expect(vendorGroups([l('a', 'Acme', 49999)])[0].needsApproval).toBe(false);
    expect(vendorGroups([l('a', 'Acme', 49999), l('b', 'Acme', 1)])[0].needsApproval).toBe(true);
  });

  it('counts a line with no vendor yet on its own, and lines with no amount as nothing', () => {
    const groups = vendorGroups([l('a', '', 60000), l('b', '', 60000), l('c', 'Acme', null)]);
    expect(groups.map((g) => [g.key, g.totalCents, g.needsApproval])).toEqual([
      ['line:a', 60000, true],
      ['line:b', 60000, true],
      ['acme', 0, false]
    ]);
  });

  it('counts a negative amount as zero, so it cannot bring a vendor total under the threshold', () => {
    expect(vendorGroups([l('a', 'Acme', 60000), l('b', 'Acme', -30000)])[0].totalCents).toBe(60000);
  });

  it('lists only the vendor totals that need approval', () => {
    const lines = [l('a', 'Acme', 70000), l('b', 'Borealis', 1000)];
    expect(groupsNeedingApproval(lines).map((g) => g.vendor)).toEqual(['Acme']);
    expect(requiresApproval(lines)).toBe(true);
    expect(requiresApproval([])).toBe(false);
  });
});

describe('the quote rule (P-015)', () => {
  const q = (id: string, vendor: string, amountCents: number, extra: { kinds?: ('receipt' | 'quote')[]; reason?: string } = {}) => ({
    id,
    vendor,
    amountCents,
    noQuoteReason: extra.reason ?? '',
    files: (extra.kinds ?? []).map((kind) => ({ kind }))
  });

  it('needs a quote or a reason once a vendor total reaches $500', () => {
    const gaps = quoteGaps([q('a', 'Acme', 40000), q('b', 'Acme', 10000), q('c', 'Borealis', 10000)]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ firstLineId: 'a', group: { vendor: 'Acme', totalCents: 50000 } });
  });

  it('is met by a quote file or a written reason on any line of the vendor', () => {
    expect(quoteGaps([q('a', 'Acme', 60000, { kinds: ['quote'] })])).toEqual([]);
    expect(quoteGaps([q('a', 'Acme', 30000), q('b', 'Acme', 30000, { reason: 'Sole supplier' })])).toEqual([]);
    expect(quoteGaps([q('a', 'Acme', 30000), q('b', 'Acme', 30000, { kinds: ['quote'] })])).toEqual([]);
  });

  it('is not met by a receipt, or by a blank reason', () => {
    expect(quoteGaps([q('a', 'Acme', 60000, { kinds: ['receipt'] })])).toHaveLength(1);
    expect(quoteGaps([q('a', 'Acme', 60000, { reason: '   ' })])).toHaveLength(1);
  });
});

describe('bought before approval (P-017)', () => {
  it('a purchase dated before the day it is sent looks already bought; the same day or later does not', () => {
    expect(isAlreadyBought({ date: '2026-10-11', hasReceipt: false }, '2026-10-12')).toBe(true);
    expect(isAlreadyBought({ date: '2026-10-12', hasReceipt: false }, '2026-10-12')).toBe(false);
    expect(isAlreadyBought({ date: '2026-10-20', hasReceipt: false }, '2026-10-12')).toBe(false);
  });

  it('a receipt already attached means it was bought, whatever the date; a missing or invalid date does not', () => {
    expect(isAlreadyBought({ date: '2026-10-20', hasReceipt: true }, '2026-10-12')).toBe(true);
    expect(isAlreadyBought({ date: '', hasReceipt: false }, '2026-10-12')).toBe(false);
    expect(isAlreadyBought({ date: 'soon', hasReceipt: false }, '2026-10-12')).toBe(false);
  });

  const lines = [
    { ...l('a', 'Acme', 60000), date: '2026-10-01', hasReceipt: false },
    { ...l('b', 'Borealis', 70000), date: '2026-10-20', hasReceipt: false },
    { ...l('c', 'Cedar', 1000), date: '2026-09-01', hasReceipt: true }
  ];

  it('flags each vendor total that needs approval and was bought, and ignores small ones', () => {
    const groups = groupsForApproval(lines, '2026-10-12');
    expect(groups).toEqual([
      { key: 'acme', vendor: 'Acme', cents: 60000, bought: true },
      { key: 'borealis', vendor: 'Borealis', cents: 70000, bought: false }
    ]);
    expect(anyBoughtBefore(groups)).toBe(true);
    expect(anyBoughtBefore([groups[1]])).toBe(false);
  });

  it('the approved record keeps the flag and takes the current amounts', () => {
    const sent = groupsForApproval(lines, '2026-10-12');
    const approved = groupsForApproved([l('a', 'Acme', 61000), l('b', 'Borealis', 70000)], sent);
    expect(approved).toEqual([
      { key: 'acme', vendor: 'Acme', cents: 61000, bought: true },
      { key: 'borealis', vendor: 'Borealis', cents: 70000, bought: false }
    ]);
  });
});

describe('approval covers what the approver saw (P-019)', () => {
  it('allows 10% above the approved amount', () => {
    expect(OVERRUN_TOLERANCE_PERCENT).toBe(10);
    expect(allowedCents(100000)).toBe(110000);
    expect(allowedCents(50000)).toBe(55000);
    expect(allowedCents(50001)).toBe(55001);
  });

  const approved = [{ key: 'acme', vendor: 'Acme', cents: 100000, bought: false }];

  it('is covered up to the allowance, and not beyond it', () => {
    expect(approvalCoverage(vendorGroups([l('a', 'Acme', 110000)]), approved)).toMatchObject([{ approvedCents: 100000, covered: true }]);
    expect(approvalCoverage(vendorGroups([l('a', 'Acme', 110001)]), approved)).toMatchObject([{ approvedCents: 100000, covered: false }]);
  });

  it('is never needed again for a lower amount, or for a vendor that has fallen under the threshold', () => {
    expect(approvalCoverage(vendorGroups([l('a', 'Acme', 60000)]), approved)).toMatchObject([{ covered: true }]);
    expect(approvalCoverage(vendorGroups([l('a', 'Acme', 40000)]), approved)).toEqual([]);
  });

  it('a new vendor total of $500 or more was not approved', () => {
    const coverage = approvalCoverage(vendorGroups([l('a', 'Acme', 100000), l('b', 'Borealis', 50000)]), approved);
    expect(coverage.map((c) => [c.group.vendor, c.covered, c.approvedCents])).toEqual([
      ['Acme', true, 100000],
      ['Borealis', false, null]
    ]);
  });

  it('a renamed vendor is a new vendor and needs approval again', () => {
    expect(approvalCoverage(vendorGroups([l('a', 'Acme Inc', 100000)]), approved)).toMatchObject([{ covered: false, approvedCents: null }]);
  });
});

describe('approval state', () => {
  const record = (approvedCents: number | null): ApprovalRecord => ({
    sent: [{ key: 'acme', vendor: 'Acme', cents: 100000, bought: false }],
    approved: approvedCents === null ? [] : [{ key: 'acme', vendor: 'Acme', cents: approvedCents, bought: false }]
  });
  const big = vendorGroups([l('a', 'Acme', 100000)]);
  const small = vendorGroups([l('a', 'Acme', 10000)]);

  it('is not required when every vendor total is under the threshold, even after an approval', () => {
    expect(approvalState('Draft', small, EMPTY_APPROVAL)).toBe('notRequired');
    expect(approvalState('Approved', small, record(100000))).toBe('notRequired');
  });

  it('is needed before it has been sent, and after a return clears the approval', () => {
    expect(approvalState('Draft', big, EMPTY_APPROVAL)).toBe('needed');
    expect(approvalState('Returned', big, record(null))).toBe('needed');
  });

  it('is pending while the request awaits approval', () => {
    expect(approvalState('Awaiting approval', big, record(null))).toBe('pending');
  });

  it('is approved while the approved amount covers the request, through submission and processing', () => {
    for (const status of ['Approved', 'Submitted', 'Processed', 'Returned'] as const) {
      expect(approvalState(status, big, record(100000))).toBe('approved');
    }
  });

  it('has changed when a vendor total rises past the allowance', () => {
    const risen = vendorGroups([l('a', 'Acme', 120000)]);
    expect(approvalState('Approved', risen, record(100000))).toBe('changed');
  });

  it('an Approved status with no approval recorded is not approved', () => {
    expect(approvalState('Approved', big, EMPTY_APPROVAL)).toBe('needed');
  });

  it('needed and changed are the states where the employee must send the request for approval', () => {
    expect(mustSendForApproval('needed')).toBe(true);
    expect(mustSendForApproval('changed')).toBe(true);
    for (const state of ['notRequired', 'pending', 'approved'] as const) expect(mustSendForApproval(state)).toBe(false);
  });
});

describe('the approval status of each line, which the app works out (P-003)', () => {
  const lines = [l('a', 'Acme', 80000), l('b', 'Acme', 40000), l('c', 'Borealis', 10000), l('d', 'Cedar', 60000)];

  it('gives a line the status of its vendor total', () => {
    const map = lineApprovals(lines, 'Draft', EMPTY_APPROVAL);
    expect([...map.entries()].map(([id, v]) => [id, v.status])).toEqual([
      ['a', 'needed'],
      ['b', 'needed'],
      ['c', 'notRequired'],
      ['d', 'needed']
    ]);
  });

  it('shows Awaiting approval while it is with the approver', () => {
    expect(lineApprovals(lines, 'Awaiting approval', EMPTY_APPROVAL).get('a')?.status).toBe('pending');
    expect(lineApprovals(lines, 'Awaiting approval', EMPTY_APPROVAL).get('c')?.status).toBe('notRequired');
  });

  it('shows Approved, Changed since approval and the bought-before flag from the record', () => {
    const record: ApprovalRecord = {
      sent: [
        { key: 'acme', vendor: 'Acme', cents: 120000, bought: true },
        { key: 'cedar', vendor: 'Cedar', cents: 60000, bought: false }
      ],
      approved: [
        { key: 'acme', vendor: 'Acme', cents: 120000, bought: true },
        { key: 'cedar', vendor: 'Cedar', cents: 40000, bought: false }
      ]
    };
    const map = lineApprovals(lines, 'Approved', record);
    expect(map.get('a')).toEqual({ status: 'approved', boughtBefore: true });
    expect(map.get('b')).toEqual({ status: 'approved', boughtBefore: true });
    expect(map.get('c')).toEqual({ status: 'notRequired', boughtBefore: false });
    // Cedar was approved at $400.00 and is now $600.00: more than 10% above.
    expect(map.get('d')).toEqual({ status: 'changed', boughtBefore: false });
  });
});

describe('self-approval (P-020)', () => {
  it('is when the approver and the requester are the same account', () => {
    expect(isSelfApproved('max@example.com', 'Max@Example.com')).toBe(true);
    expect(isSelfApproved('jane@example.com', 'max@example.com')).toBe(false);
    expect(isSelfApproved('', '')).toBe(false);
  });
});
