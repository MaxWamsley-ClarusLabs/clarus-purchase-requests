import { messages } from './messages';
import { EXTRA_DESCRIPTION, canSetExtra, extraChargeOf, normalizeRowKind, planExtraCharge, receiptHolderFor } from './extraCharges';
import { line as buildLine, file } from '../testing/builders';
import { vendorKey } from './purchaseRules';

const ACME = vendorKey('Acme Lab Supply');
const NORTHWIND = vendorKey('Northwind Office Supply');

// Row 1 and row 2 are Acme (row 2 is the larger), row 3 is Northwind, none has a receipt yet except row 1.
const rows = () => [
  buildLine({
    id: 'a',
    rowNumber: 1,
    vendor: 'Acme Lab Supply',
    category: 'rdMaterials',
    amountCents: 10000,
    date: '2026-10-14',
    files: [file({ fileName: 'acme.pdf' })]
  }),
  buildLine({ id: 'b', rowNumber: 2, vendor: 'acme  lab supply', category: 'computer', amountCents: 25000, date: '2026-10-15', files: [] }),
  buildLine({ id: 'c', rowNumber: 3, vendor: 'Northwind Office Supply', category: 'office', amountCents: 8645, date: '2026-10-14', files: [] })
];

describe('the shipping and tax boxes (P-048)', () => {
  it('knows a stored row kind, and reads anything else as an ordinary row', () => {
    expect(normalizeRowKind('shipping')).toBe('shipping');
    expect(normalizeRowKind('tax')).toBe('tax');
    for (const bad of ['', 'Shipping', 'fee', null, undefined, 3, {}]) expect(normalizeRowKind(bad)).toBe('');
  });

  it('makes a shipping row that copies the vendor, the date and the receipt, in the shipping category', () => {
    const plan = planExtraCharge(rows(), ACME, 'shipping', 1520, '2026-10-20');
    expect(plan).toEqual({
      remove: [],
      create: {
        vendor: 'Acme Lab Supply',
        description: EXTRA_DESCRIPTION.shipping,
        category: 'shipping',
        date: '2026-10-14',
        quantity: 1,
        amountCents: 1520,
        paidBy: 'company',
        itemLink: '',
        sameReceiptAsRow: 1,
        rowKind: 'shipping'
      }
    });
  });

  it("puts tax in the category of the vendor's largest purchase", () => {
    const plan = planExtraCharge(rows(), ACME, 'tax', 880, '2026-10-20');
    expect(plan.create).toMatchObject({ description: 'Sales tax', category: 'computer', rowKind: 'tax', amountCents: 880, sameReceiptAsRow: 1 });
  });

  it('leaves the category empty when no purchase of the vendor has one yet, and uses today when there is no date', () => {
    const lines = [buildLine({ id: 'a', rowNumber: 1, vendor: 'Acme', category: '', date: '', amountCents: 500, files: [] })];
    expect(planExtraCharge(lines, vendorKey('Acme'), 'tax', 40, '2026-10-20')).toEqual({ remove: [], refusal: messages.extraNeedsReceipt });
    const withReceipt = [{ ...lines[0], files: [file()] }];
    expect(planExtraCharge(withReceipt, vendorKey('Acme'), 'tax', 40, '2026-10-20').create).toMatchObject({ category: '', date: '2026-10-20' });
  });

  it('shares the receipt a purchase of the vendor shares, not a receipt of another vendor', () => {
    const lines = [
      buildLine({ id: 'a', rowNumber: 1, vendor: 'Acme', files: [file()] }),
      buildLine({ id: 'b', rowNumber: 2, vendor: 'Beta', files: [], sameReceiptAsRow: 1 }),
      buildLine({ id: 'c', rowNumber: 3, vendor: 'Gamma', files: [] })
    ];
    expect(receiptHolderFor(lines, vendorKey('Acme'))?.id).toBe('a');
    // Beta's own purchase shares row 1's receipt, so its extra row can share that same receipt.
    expect(receiptHolderFor(lines, vendorKey('Beta'))?.id).toBe('a');
    expect(receiptHolderFor(lines, vendorKey('Gamma'))).toBeUndefined();
    expect(canSetExtra(lines, vendorKey('Gamma'), 'shipping')).toBe(false);
    expect(planExtraCharge(lines, vendorKey('Gamma'), 'shipping', 100, '2026-10-20').refusal).toBe(messages.extraNeedsReceipt);
  });

  it('refuses to start a row for a vendor that has no receipt yet, but still lets an existing row be changed or removed', () => {
    expect(canSetExtra(rows(), NORTHWIND, 'shipping')).toBe(false);
    expect(planExtraCharge(rows(), NORTHWIND, 'shipping', 500, '2026-10-20')).toEqual({ remove: [], refusal: messages.extraNeedsReceipt });
    const lines = [...rows(), buildLine({ id: 's', rowNumber: 4, vendor: 'Northwind Office Supply', rowKind: 'shipping', amountCents: 700, files: [] })];
    expect(canSetExtra(lines, NORTHWIND, 'shipping')).toBe(true);
    expect(planExtraCharge(lines, NORTHWIND, 'shipping', 900, '2026-10-20')).toEqual({ remove: [], update: { lineId: 's', changes: { amountCents: 900 } } });
    expect(planExtraCharge(lines, NORTHWIND, 'shipping', null, '2026-10-20')).toEqual({ remove: ['s'] });
  });

  it('changes the row it keeps, removes it when the box is emptied or zero, and tidies up a second one', () => {
    const lines = [
      ...rows(),
      buildLine({ id: 's1', rowNumber: 4, vendor: 'Acme Lab Supply', rowKind: 'shipping', amountCents: 700 }),
      buildLine({ id: 's2', rowNumber: 5, vendor: 'Acme Lab Supply', rowKind: 'shipping', amountCents: 300 })
    ];
    expect(extraChargeOf(lines, ACME, 'shipping')).toEqual({ cents: 1000, lineIds: ['s1', 's2'] });
    expect(extraChargeOf(lines, ACME, 'tax')).toEqual({ cents: null, lineIds: [] });
    expect(planExtraCharge(lines, ACME, 'shipping', 1250, '2026-10-20')).toEqual({ remove: ['s2'], update: { lineId: 's1', changes: { amountCents: 1250 } } });
    expect(planExtraCharge(lines, ACME, 'shipping', 0, '2026-10-20')).toEqual({ remove: ['s1', 's2'] });
    expect(planExtraCharge(lines, ACME, 'shipping', null, '2026-10-20')).toEqual({ remove: ['s1', 's2'] });
  });

  it("keeps shipping and tax apart, and each vendor's apart from the others'", () => {
    const lines = [
      ...rows(),
      buildLine({ id: 's', rowNumber: 4, vendor: 'Acme Lab Supply', rowKind: 'shipping', amountCents: 700 }),
      buildLine({ id: 't', rowNumber: 5, vendor: 'Northwind Office Supply', rowKind: 'tax', amountCents: 55 })
    ];
    expect(extraChargeOf(lines, ACME, 'shipping').cents).toBe(700);
    expect(extraChargeOf(lines, ACME, 'tax').cents).toBeNull();
    expect(extraChargeOf(lines, NORTHWIND, 'tax').cents).toBe(55);
    expect(planExtraCharge(lines, ACME, 'tax', 100, '2026-10-20').create).toBeDefined();
  });

  it('has no box for a row that has no vendor yet', () => {
    expect(extraChargeOf(rows(), '', 'shipping')).toEqual({ cents: null, lineIds: [] });
    expect(canSetExtra(rows(), '', 'shipping')).toBe(false);
  });
});
