import {
  APPROVAL_THRESHOLD_CENTS,
  APPROVAL_THRESHOLD_TEXT,
  CATEGORIES,
  CERTIFICATION,
  EMPTY_APPROVAL,
  NO_QUOTE_REASONS,
  NO_RECEIPT_REASONS,
  OVERRUN_TOLERANCE_PERCENT,
  PAID_BY_OPTIONS,
  PROJECT_QUICK_PICKS,
  QUICKBOOKS_MAPPING_STATUS,
  QUOTE_THRESHOLD_CENTS,
  QUOTE_THRESHOLD_TEXT,
  allowedCents,
  anyBoughtBefore,
  approvalCoverage,
  approvalState,
  approvalsSoFar,
  categoryNeedsDescription,
  categoryText,
  findCategory,
  findPaidBy,
  groupsForApproval,
  groupsForApproved,
  groupsNeedingApproval,
  isAlreadyBought,
  isSelfApproved,
  lineApprovals,
  matchesWhatWasSent,
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
    expect(QUOTE_THRESHOLD_TEXT).toBe('$500');
  });

  it('offers the canned no-quote and no-receipt reasons, which are policy (P-015, P-017)', () => {
    expect(NO_QUOTE_REASONS).toEqual(['Already purchased']);
    expect(NO_RECEIPT_REASONS).toEqual(['Receipt lost', 'No receipt given']);
  });

  it('asks for a description of the category for Other only (P-024)', () => {
    expect(CATEGORIES.filter((c) => c.needsDescription).map((c) => c.id)).toEqual(['other']);
    expect(categoryNeedsDescription('other')).toBe(true);
    expect(categoryNeedsDescription('office')).toBe(false);
    expect(categoryNeedsDescription('')).toBe(false);
    expect(categoryNeedsDescription('snacks')).toBe(false);
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
      if (c.needsDescription) expect(c.suggestedAccount).toBe('');
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
    expect(vendorKey(" Joe's  Diner, Inc. ")).toBe('joesdinerinc');
    expect(vendorKey('AMAZON.')).toBe(vendorKey('amazon'));
    expect(vendorKey('City Cab Co.')).toBe(vendorKey('CITY CAB CO'));
    expect(vendorKey('Digi-Key')).toBe(vendorKey('DigiKey'));
    expect(vendorKey('Thor Labs')).toBe(vendorKey('Thorlabs'));
    expect(vendorKey("O'Reilly")).toBe('oreilly');
    expect(vendorKey('OReilly')).toBe('oreilly');
    expect(vendorKey('o reilly')).toBe('oreilly');
    expect(vendorKey('O’Reilly')).toBe('oreilly');
    expect(vendorKey('Amazon.com')).toBe('amazoncom');
    expect(vendorKey('Amazon.com')).toBe(vendorKey('AMAZON COM'));
    // Different names stay different vendors.
    expect(vendorKey('Amazon')).not.toBe(vendorKey('Amazon.com'));
    expect(vendorKey('Amazon')).not.toBe(vendorKey('Amazon Web Services'));
  });

  it('ignores accents and width, in any alphabet', () => {
    expect(vendorKey('Café')).toBe(vendorKey('Cafe'));
    expect(vendorKey('CAFÉ ZÜRICH')).toBe('cafezurich');
    expect(vendorKey('Ｄｉｇｉ－Ｋｅｙ')).toBe('digikey');
    // Names in other alphabets are kept, not thrown away.
    expect(vendorKey('株式会社テスト')).toBe('株式会社テスト');
    expect(vendorKey('Acme 株式会社')).not.toBe(vendorKey('Acme 有限会社'));
    expect(vendorKey('Ελληνική Εταιρεία')).toBe(vendorKey('ελληνικη εταιρεια'));
  });

  it('matches a name with no letter or digit as typed, and gives nothing only for a blank name', () => {
    expect(vendorKey('-')).toBe('-');
    expect(vendorKey(' - ')).toBe('-');
    expect(vendorKey('-')).not.toBe(vendorKey('--'));
    expect(vendorKey('🙂  🙂')).toBe('🙂 🙂');
    expect(vendorKey('')).toBe('');
    expect(vendorKey('   ')).toBe('');
  });

  it('ignores the Hangul fillers, which count as letters but show nothing, so "Amazon" with one added is still Amazon', () => {
    for (const filler of ['ㅤ', 'ᅟ', 'ᅠ', 'ﾠ']) {
      expect([filler, vendorKey(`Amazon${filler}`)]).toEqual([filler, 'amazon']);
      expect([filler, vendorKey(`Ama${filler}zon`)]).toEqual([filler, 'amazon']);
    }
    // So two $300.00 purchases at the two spellings are one vendor total of $600.00, which needs approval.
    expect(vendorGroups([l('a', 'Amazon', 30000), l('b', 'Amazonㅤ', 30000)]).map((g) => [g.totalCents, g.needsApproval])).toEqual([[60000, true]]);
  });

  it('ignores the other characters that show nothing, in any name, including one with no letter or digit', () => {
    const invisible: Record<string, string> = {
      'zero-width space': '​',
      'zero-width non-joiner': '‌',
      'zero-width joiner': '‍',
      'soft hyphen': '­',
      'variation selector': '️',
      'variation selector from the supplement': '󠄀',
      'byte-order mark': '﻿',
      'word joiner': '⁠',
      'left-to-right mark': '‎',
      'Mongolian vowel separator': '᠎'
    };
    for (const [name, ch] of Object.entries(invisible)) {
      expect([name, vendorKey(`Digi${ch}-Key${ch}`)]).toEqual([name, 'digikey']);
      // A name with no letter or digit is matched as typed, but without them: "-" and "-" with one are one vendor.
      expect([name, vendorKey(`-${ch}`)]).toEqual([name, '-']);
      expect([name, vendorKey(`${ch}-`)]).toEqual([name, '-']);
    }
  });

  it('reads a name made only of characters that show nothing as blank, so the line counts on its own', () => {
    expect(vendorKey('​')).toBe('');
    expect(vendorKey('ㅤㅤ')).toBe('');
    expect(vendorKey(' ­⁠ ')).toBe('');
    expect(vendorGroups([l('a', '​', 60000)]).map((g) => g.key)).toEqual(['line:a']);
  });

  it('adds up two lines of one vendor in another alphabet, and keeps different names apart', () => {
    const same = vendorGroups([l('a', '株式会社テスト', 30000), l('b', '株式会社テスト', 30000)]);
    expect(same.map((g) => [g.totalCents, g.lineIds, g.needsApproval])).toEqual([[60000, ['a', 'b'], true]]);
    const apart = vendorGroups([l('a', 'Acme 株式会社', 30000), l('b', 'Acme 有限会社', 30000)]);
    expect(apart.map((g) => g.needsApproval)).toEqual([false, false]);
    // A vendor with no letter or digit still adds up with itself, and is not a line on its own.
    expect(vendorGroups([l('a', '-', 30000), l('b', ' - ', 30000)]).map((g) => [g.key, g.totalCents])).toEqual([['-', 60000]]);
  });

  it('adds up respellings of one vendor, so $300 and $300 at "Digi-Key" and "DigiKey" need approval and a quote', () => {
    const lines = [l('a', 'Digi-Key', 30000), l('b', 'DigiKey', 30000)];
    expect(groupsNeedingApproval(lines).map((g) => [g.vendor, g.totalCents, g.needsQuote])).toEqual([['Digi-Key', 60000, true]]);
    const gaps = quoteGaps(lines.map((x) => ({ ...x, noQuoteReason: '', files: [] })));
    expect(gaps.map((g) => [g.firstLineId, g.group.totalCents])).toEqual([['a', 60000]]);
    expect(approvalState('Draft', vendorGroups(lines), EMPTY_APPROVAL)).toBe('needed');
  });

  it('does not let a respelling get round the 10% allowance (P-019)', () => {
    // $1,000.00 approved for "Thor Labs"; a "Thorlabs" line of $499.00 makes the one vendor total $1,499.00.
    const approved: ApprovalRecord = { sent: [], approved: [{ key: vendorKey('Thor Labs'), vendor: 'Thor Labs', cents: 100000, bought: false }], earlier: [] };
    const lines = [l('a', 'Thor Labs', 100000), l('b', 'Thorlabs', 49900)];
    const groups = vendorGroups(lines);
    expect(groups.map((g) => [g.vendor, g.totalCents])).toEqual([['Thor Labs', 149900]]);
    expect(approvalCoverage(groups, approved.approved)).toMatchObject([{ approvedCents: 100000, covered: false }]);
    expect(approvalState('Approved', groups, approved)).toBe('changed');
    expect(mustSendForApproval(approvalState('Approved', groups, approved))).toBe(true);
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
    const groups = vendorGroups([l('a', '', 60000), l('b', '  ', 60000), l('c', 'Acme', null)]);
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

  it('keeps a flag from an earlier round, even after the date is moved to the future', () => {
    const first = groupsForApproval([{ ...l('a', 'Acme', 60000), date: '2026-10-01', hasReceipt: false }], '2026-10-12');
    expect(first[0].bought).toBe(true);
    // Returned at the approval step: what was sent stays on record, nothing is approved.
    const returned: ApprovalRecord = { sent: first, approved: [], earlier: [] };
    const again = groupsForApproval([{ ...l('a', 'Acme', 60000), date: '2026-12-01', hasReceipt: false }], '2026-10-14', returned);
    expect(again).toEqual([{ key: 'acme', vendor: 'Acme', cents: 60000, bought: true }]);
    // The flag stays after an approval too.
    const afterApproval: ApprovalRecord = { sent: [], approved: [{ ...first[0], cents: 60000 }], earlier: [] };
    expect(groupsForApproval([{ ...l('a', 'Acme', 90000), date: '2026-12-01', hasReceipt: false }], '2026-10-20', afterApproval)[0].bought).toBe(true);
    // And when it is kept only with an earlier approval, for example after a round that did not send this vendor.
    const keptEarlier: ApprovalRecord = { sent: [], approved: [], earlier: [{ ...first[0], cents: 60000 }] };
    expect(groupsForApproval([{ ...l('a', 'Acme', 60000), date: '2026-12-01', hasReceipt: false }], '2026-10-20', keptEarlier)[0].bought).toBe(true);
  });

  it('remembers an approval from an earlier round once a later round is sent and returned, so it is not flagged when sent again', () => {
    // Round 1 approved Acme at $600.00. Round 2, Acme and a new vendor Beta, was sent and returned at the approval step:
    // nothing is approved now, and round 1's approval is kept as an earlier one.
    const acme = { key: 'acme', vendor: 'Acme', cents: 60000, bought: false };
    const returned: ApprovalRecord = { sent: [acme, { key: 'beta', vendor: 'Beta', cents: 55000, bought: false }], approved: [], earlier: [acme] };
    // Acme was bought after its approval (its receipt is attached); Beta is not bought yet.
    const roundThree = [
      { ...l('a', 'Acme', 60000), date: '2026-10-15', hasReceipt: true },
      { ...l('b', 'Beta', 55000), date: '2026-10-25', hasReceipt: false }
    ];
    expect(groupsForApproval(roundThree, '2026-10-20', returned)).toEqual([
      { key: 'acme', vendor: 'Acme', cents: 60000, bought: false },
      { key: 'beta', vendor: 'Beta', cents: 55000, bought: false }
    ]);
    // Without the earlier approval, Acme would look bought before approval.
    expect(groupsForApproval(roundThree, '2026-10-20', { ...returned, earlier: [] })[0].bought).toBe(true);
    // A vendor total that was never approved and is already bought is still flagged.
    const betaBought = [roundThree[0], { ...roundThree[1], hasReceipt: true }];
    expect(groupsForApproval(betaBought, '2026-10-20', returned).map((g) => [g.vendor, g.bought])).toEqual([
      ['Acme', false],
      ['Beta', true]
    ]);
    // So is one that has risen past the allowance of its earlier approval.
    expect(groupsForApproval([{ ...roundThree[0], amountCents: 66001 }], '2026-10-20', returned)[0].bought).toBe(true);
  });

  it('judges a vendor total against its newest approval: the one approved now before an earlier one', () => {
    const record: ApprovalRecord = {
      sent: [],
      approved: [{ key: 'acme', vendor: 'Acme', cents: 100000, bought: false }],
      earlier: [{ key: 'acme', vendor: 'Acme', cents: 60000, bought: false }]
    };
    // $1,050.00 is within 10% of the $1,000.00 approved now, though far above the $600.00 approved earlier.
    const bought = [{ ...l('a', 'Acme', 105000), date: '2026-10-15', hasReceipt: true }];
    expect(groupsForApproval(bought, '2026-10-20', record)[0].bought).toBe(false);
  });

  it('keeps the newest approval of each vendor from every round so far', () => {
    const acme600 = { key: 'acme', vendor: 'Acme', cents: 60000, bought: false };
    const acme900 = { ...acme600, cents: 90000 };
    const beta = { key: 'beta', vendor: 'Beta', cents: 55000, bought: true };
    const cedar = { key: 'cedar', vendor: 'Cedar', cents: 70000, bought: false };
    expect(approvalsSoFar(EMPTY_APPROVAL)).toEqual([]);
    expect(approvalsSoFar({ sent: [], approved: [], earlier: [acme600, beta] })).toEqual([acme600, beta]);
    // The one approved now replaces an earlier one of the same vendor; what was only sent is not an approval.
    expect(approvalsSoFar({ sent: [cedar], approved: [acme900], earlier: [acme600, beta] })).toEqual([acme900, beta]);
    expect(approvalsSoFar({ sent: [], approved: [cedar], earlier: [] })).toEqual([cedar]);
  });

  it('flags only the vendor total that rose past what was approved, not one an earlier approval still covers', () => {
    // Round 1 approved Acme at $1,000.00 and Borealis at $800.00, with quotes; both were bought afterwards.
    const approved: ApprovalRecord = {
      sent: [
        { key: 'acme', vendor: 'Acme', cents: 100000, bought: false },
        { key: 'borealis', vendor: 'Borealis', cents: 80000, bought: false }
      ],
      approved: [
        { key: 'acme', vendor: 'Acme', cents: 100000, bought: false },
        { key: 'borealis', vendor: 'Borealis', cents: 80000, bought: false }
      ],
      earlier: []
    };
    const bought = [
      { ...l('a', 'Acme', 115000), date: '2026-10-15', hasReceipt: true },
      { ...l('b', 'Borealis', 80000), date: '2026-10-15', hasReceipt: true }
    ];
    // Acme is now $1,150.00, more than 10% above $1,000.00, so it is sent again, and it was bought before that approval.
    expect(groupsForApproval(bought, '2026-10-20', approved)).toEqual([
      { key: 'acme', vendor: 'Acme', cents: 115000, bought: true },
      { key: 'borealis', vendor: 'Borealis', cents: 80000, bought: false }
    ]);
    // Within the allowance, a receipt does not flag it either.
    expect(groupsForApproval([{ ...bought[0], amountCents: 110000 }], '2026-10-20', approved)[0].bought).toBe(false);
    // A vendor total that was never approved is flagged as before.
    expect(groupsForApproval([{ ...l('c', 'Cedar', 60000), date: '2026-10-21', hasReceipt: true }], '2026-10-20', approved)[0].bought).toBe(true);
  });

  it('judges the first round against nothing approved, and a later one against the record passed', () => {
    expect(EMPTY_APPROVAL).toEqual({ sent: [], approved: [], earlier: [] });
    // With nothing approved, the Acme purchase dated before the day it is sent is flagged.
    const nothing: ApprovalRecord = { sent: [], approved: [], earlier: [] };
    expect(groupsForApproval(lines, '2026-10-12', nothing).map((g) => [g.vendor, g.bought])).toEqual([
      ['Acme', true],
      ['Borealis', false]
    ]);
    // The same lines judged against an approval of Acme at that amount are not: it was approved before it was bought.
    const acmeApproved: ApprovalRecord = { sent: [], approved: [{ key: 'acme', vendor: 'Acme', cents: 60000, bought: false }], earlier: [] };
    expect(groupsForApproval(lines, '2026-10-12', acmeApproved).map((g) => [g.vendor, g.bought])).toEqual([
      ['Acme', false],
      ['Borealis', false]
    ]);
  });
});

describe('the approver approves what was sent (P-019)', () => {
  const sent = [
    { key: 'acme', vendor: 'Acme', cents: 100000, bought: false },
    { key: 'borealis', vendor: 'Borealis', cents: 60000, bought: true }
  ];
  const lines = [l('a', 'Acme', 70000), l('b', 'Acme', 30000), l('c', 'Borealis', 60000), l('d', 'Cedar', 1000)];

  it('matches when the vendor totals that need approval are the ones sent, at the same amounts', () => {
    expect(matchesWhatWasSent(lines, sent)).toBe(true);
    // The same vendor spelt another way is the same vendor.
    expect(matchesWhatWasSent([l('a', 'ACME.', 100000), l('c', 'Borealis', 60000)], sent)).toBe(true);
    // A small vendor total that needs no approval does not matter.
    expect(matchesWhatWasSent([...lines, l('e', 'Dune', 49999)], sent)).toBe(true);
    expect(matchesWhatWasSent([l('d', 'Cedar', 1000)], [])).toBe(true);
  });

  it('does not match an amount changed, a vendor total added or one taken away', () => {
    expect(matchesWhatWasSent([l('a', 'Acme', 70001), l('b', 'Acme', 30000), l('c', 'Borealis', 60000)], sent)).toBe(false);
    expect(matchesWhatWasSent([...lines, l('e', 'Dune', 50000)], sent)).toBe(false);
    expect(matchesWhatWasSent([l('a', 'Acme', 100000), l('c', 'Borealis', 49999)], sent)).toBe(false);
    expect(matchesWhatWasSent([l('a', 'Acme Inc', 100000), l('c', 'Borealis', 60000)], sent)).toBe(false);
    expect(matchesWhatWasSent(lines, [])).toBe(false);
  });

  it('does not match a record that lists a vendor twice', () => {
    expect(matchesWhatWasSent([l('a', 'Acme', 100000)], [sent[0], sent[0]])).toBe(false);
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
    approved: approvedCents === null ? [] : [{ key: 'acme', vendor: 'Acme', cents: approvedCents, bought: false }],
    earlier: []
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

  it('is needed after a return at the approval step, whatever earlier rounds approved: an earlier approval is not an approval now', () => {
    const returned: ApprovalRecord = { ...record(null), earlier: [{ key: 'acme', vendor: 'Acme', cents: 100000, bought: false }] };
    expect(approvalState('Returned', big, returned)).toBe('needed');
    expect(mustSendForApproval(approvalState('Returned', big, returned))).toBe(true);
    expect(lineApprovals([l('a', 'Acme', 100000)], 'Returned', returned).get('a')).toEqual({ status: 'needed', boughtBefore: false });
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
      ],
      earlier: []
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
