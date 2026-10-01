import { vendorKey } from '../domain/purchaseRules';
import { LINE_APPROVAL_DISPLAY } from '../domain/statuses';
import { file, line, quote, request } from '../testing/builders';
import { VENDOR_APPROVAL_LABEL, boughtBeforeNote, changedMessages, quoteSummary, quoteText, rowsText, vendorRows } from './vendorRows';

// The approval record keys a vendor by its matching key (P-016).
const ACME = vendorKey('Acme Lab Supply');
const acme = (overrides = {}) => line({ id: 'a1', rowNumber: 1, vendor: 'Acme Lab Supply', amountCents: 64000, files: [], ...overrides });

describe('the vendor totals (P-015, P-016, P-019)', () => {
  it('adds up a vendor across rows, whatever the capitals and punctuation', () => {
    const rows = vendorRows([acme({ amountCents: 30000 }), acme({ id: 'a2', rowNumber: 2, vendor: 'ACME lab supply.', amountCents: 34000 })], request());
    expect(rows).toHaveLength(1);
    expect(rows[0].group.totalCents).toBe(64000);
    expect(rows[0].rows).toEqual([1, 2]);
    expect(rowsText(rows[0].rows)).toBe('Rows 1, 2');
  });

  it('shows a quote as attached, a reason as the reason, and a missing one only where a quote is needed', () => {
    const [attached] = vendorRows([acme({ files: [quote()] })], request());
    expect(attached.quote).toEqual({ kind: 'attached' });
    expect(quoteText(attached.quote)).toBe('Attached');

    const [reason] = vendorRows([acme({ noQuoteReason: 'Already purchased' })], request());
    expect(reason.quote).toEqual({ kind: 'reason', reason: 'Already purchased' });
    expect(quoteText(reason.quote)).toBe('No quote: Already purchased');

    const [missing] = vendorRows([acme()], request());
    expect(missing.quote).toEqual({ kind: 'missing' });
    expect(quoteText(missing.quote)).toBe('Missing');

    const [small] = vendorRows([acme({ amountCents: 8645 })], request());
    expect(small.quote).toEqual({ kind: 'notNeeded' });
    expect(quoteText(small.quote)).toBe('');
  });

  it('says the same in a sentence, as the Review step writes it after "Quote: "', () => {
    expect(quoteSummary({ kind: 'attached' })).toBe('attached');
    expect(quoteSummary({ kind: 'reason', reason: 'Already purchased' })).toBe('none (reason given: Already purchased)');
    expect(quoteSummary({ kind: 'missing' })).toBe('missing');
    expect(quoteSummary({ kind: 'notNeeded' })).toBe('not required');
  });

  it('does not take a receipt for a quote', () => {
    const [row] = vendorRows([acme({ files: [file()] })], request());
    expect(row.quote.kind).toBe('missing');
  });

  it('finds a quote or a reason on any row of the vendor', () => {
    const rows = vendorRows([acme({ amountCents: 30000 }), acme({ id: 'a2', rowNumber: 2, amountCents: 34000, files: [quote()] })], request());
    expect(rows[0].quote.kind).toBe('attached');
  });

  it('says where each vendor stands on approval', () => {
    const lines = [acme(), line({ id: 'n1', rowNumber: 2, vendor: 'Northwind Office Supply', amountCents: 8645, files: [] })];
    const status = (r: ReturnType<typeof request>) => vendorRows(lines, r).map((v) => v.approval);
    expect(status(request({ status: 'Draft' }))).toEqual(['needed', 'notRequired']);
    expect(status(request({ status: 'Awaiting approval' }))).toEqual(['pending', 'notRequired']);
    const approved = { sent: [], approved: [{ key: ACME, vendor: 'Acme Lab Supply', cents: 64000, bought: false }] };
    expect(status(request({ status: 'Approved', approval: approved }))).toEqual(['approved', 'notRequired']);
    expect(vendorRows(lines, request({ status: 'Approved', approval: approved }))[0].approvedCents).toBe(64000);
    // A rise of more than 10% needs approval again.
    const raised = [acme({ amountCents: 80000 })];
    expect(vendorRows(raised, request({ status: 'Approved', approval: approved }))[0].approval).toBe('changed');
  });

  it('uses the same words as the grid and the CSV', () => {
    expect(VENDOR_APPROVAL_LABEL.notRequired).toBe('Not required');
    expect(VENDOR_APPROVAL_LABEL.notRequired).toBe(LINE_APPROVAL_DISPLAY.notRequired.label);
  });

  it('carries the bought before approval flag', () => {
    const sent = { sent: [{ key: ACME, vendor: 'Acme Lab Supply', cents: 64000, bought: true }], approved: [] };
    expect(vendorRows([acme()], request({ status: 'Awaiting approval', approval: sent }))[0].boughtBefore).toBe(true);
    expect(vendorRows([acme()], request())[0].boughtBefore).toBe(false);
  });

  it('names the vendor totals that will be flagged Bought before approval in the send dialog', () => {
    expect(boughtBeforeNote([])).toBe('');
    expect(boughtBeforeNote([], [])).toBe('');
    expect(boughtBeforeNote(['Northwind Office Supply'])).toBe(
      'Northwind Office Supply looks already bought. It will be flagged Bought before approval. You can still send it.'
    );
    expect(boughtBeforeNote(['Acme Lab Supply', 'Kestrel Instruments', 'Redwood Fabrication'])).toBe(
      'Acme Lab Supply, Kestrel Instruments and Redwood Fabrication look already bought. They will be flagged Bought before approval. You can still send the request.'
    );
    expect(boughtBeforeNote(['  '])).toBe('A purchase with no vendor looks already bought. It will be flagged Bought before approval. You can still send it.');
  });

  it('says a vendor flagged in an earlier round stays flagged, rather than that it looks bought', () => {
    expect(boughtBeforeNote([], ['Kestrel Instruments'])).toBe(
      'Kestrel Instruments was flagged Bought before approval when it was sent before, and stays flagged. You can still send it.'
    );
    expect(boughtBeforeNote(['Acme Lab Supply'], ['Kestrel Instruments', 'Redwood Fabrication'])).toBe(
      'Acme Lab Supply looks already bought. It will be flagged Bought before approval. ' +
        'Kestrel Instruments and Redwood Fabrication were flagged Bought before approval when they were sent before, and stay flagged. You can still send the request.'
    );
  });

  it('words what rose past the allowance, or was never approved', () => {
    const approved = { sent: [], approved: [{ key: ACME, vendor: 'Acme Lab Supply', cents: 64000, bought: false }] };
    const lines = [acme({ amountCents: 80000 }), line({ id: 'k1', rowNumber: 2, vendor: 'Kestrel Instruments', amountCents: 115000, files: [] })];
    const messages = changedMessages(vendorRows(lines, request({ status: 'Approved', approval: approved })));
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain('Acme Lab Supply now totals $800.00, above the $640.00 that was approved');
    expect(messages[1]).toContain('Kestrel Instruments totals $1,150.00 and was not part of the approval');
  });
});
