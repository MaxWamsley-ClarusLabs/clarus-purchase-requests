import { ledgerRow, line } from '../testing/builders';
import { LedgerRow } from './ledger';
import { COMMON_COUNT, LAYER_TITLES, accountLayers, buildHistory, classLayers, filterLayers } from './ledgerSuggestions';
import { LEDGER_ACCOUNTS, LEDGER_CLASSES, accountText } from './purchaseRules';

const RD = '6182 R&D Materials & Supplies';
const SHIP = '6184 Shipping/Postage';
const OFFICE = '6180 Office Supplies';
const COMPUTER = '6178 Computer, H/W & S/W Supplies';
const INTERNAL = '5.0 Internal R&D';
const PHASE1 = '1.0 Grants:1.01 NSF Phase 1 SBIR';

function posted(id: string, vendor: string, account: string, className: string, postedOn: string): LedgerRow {
  return ledgerRow({ line: line({ id, vendor }), entry: { posted: true, account, className, postedBy: 'Bea Keeper', postedOn } });
}

const ids = (layers: { id: string }[]) => layers.map((l) => l.id);

describe('with no history (a new site)', () => {
  const empty = buildHistory([]);

  it("shows the line's category first, then Max's usual accounts, then the rest by number", () => {
    const layers = accountLayers({ category: 'office', vendor: 'Anyone' }, empty);
    expect(ids(layers)).toEqual(['category', 'usual', 'rest']);
    expect(layers[0].items).toEqual([OFFICE]);
    expect(layers[1].items).toHaveLength(13); // the usual 14 less the one already shown
    expect(layers[1].items[0]).toBe(RD);
    expect(layers.flatMap((l) => l.items)).toHaveLength(56);
  });

  it("shows a class list in Max's order, with no category layer", () => {
    const layers = classLayers({ vendor: 'Anyone' }, empty);
    expect(ids(layers)).toEqual(['usual']);
    expect(layers[0].items).toEqual(LEDGER_CLASSES.map((c) => c.name));
  });

  it('starts with no category layer for Other', () => {
    expect(ids(accountLayers({ category: 'other', vendor: 'Anyone' }, empty))).toEqual(['usual', 'rest']);
  });
});

describe('with history', () => {
  const rows = [
    posted('1', 'Northside Lab Supply', SHIP, INTERNAL, '2026-11-01 09:00'),
    posted('2', 'Northside Lab Supply', SHIP, INTERNAL, '2026-11-02 09:00'),
    posted('3', 'Northside Lab Supply', RD, PHASE1, '2026-11-03 09:00'),
    posted('4', 'Paper Depot', OFFICE, INTERNAL, '2026-11-04 09:00'),
    posted('5', 'Paper Depot', COMPUTER, INTERNAL, '2026-11-05 09:00'),
    posted('6', 'Other Co', COMPUTER, INTERNAL, '2026-11-06 09:00')
  ];
  const history = buildHistory(rows);

  it("puts the vendor's own past choices after the category, most used first, matching the vendor as the totals do", () => {
    const layers = accountLayers({ category: 'rdMaterials', vendor: '  NORTHSIDE lab supply ' }, history);
    expect(ids(layers)).toEqual(['category', 'vendor', 'common', 'usual', 'rest']);
    expect(layers[0].items).toEqual([RD]);
    expect(layers[1].items).toEqual([SHIP]); // RD was used too, but it already shows in the category layer
  });

  it('shows each item once, at its highest layer', () => {
    const layers = accountLayers({ category: 'office', vendor: 'Paper Depot' }, history);
    const all = layers.flatMap((l) => l.items);
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(56);
    expect(layers[0].items).toEqual([OFFICE]);
    expect(layers[1].items).toEqual([COMPUTER]);
  });

  it('adds what the company posts most as "used most often", top five at most', () => {
    const layers = accountLayers({ category: 'rdMaterials', vendor: 'Nobody' }, history);
    const common = layers.find((l) => l.id === 'common')!;
    expect(common.items.length).toBeLessThanOrEqual(COMMON_COUNT);
    expect(common.items[0]).toBe(COMPUTER); // used three times
    expect(layers.find((l) => l.id === 'vendor')).toBeUndefined();
  });

  it("suggests classes for a vendor, then the most used, then Max's order", () => {
    const layers = classLayers({ vendor: 'Other Co' }, history);
    expect(ids(layers)).toEqual(['vendor', 'common', 'usual']);
    expect(layers[0].items).toEqual([INTERNAL]);
    expect(layers[1].items).toEqual([PHASE1]); // used elsewhere, so it is "used most often" for a vendor that only ever used Internal R&D
    expect(layers.flatMap((l) => l.items)).toHaveLength(7);
    // Northside used both of the company's classes, so both are in its own layer and "used most often" has nothing left to add.
    expect(ids(classLayers({ vendor: 'Northside Lab Supply' }, history))).toEqual(['vendor', 'usual']);
  });

  it("breaks a tie by the more recent posting, then by Max's order", () => {
    const tie = buildHistory([posted('a', 'V', SHIP, INTERNAL, '2026-11-01 09:00'), posted('b', 'V', OFFICE, INTERNAL, '2026-11-02 09:00')]);
    expect(accountLayers({ category: '', vendor: 'V' }, tie)[0].items).toEqual([OFFICE, SHIP]);
  });

  it('ignores lines that are not posted, and accounts or classes that are not in the lists', () => {
    const odd = buildHistory([
      ledgerRow({ line: line({ vendor: 'V' }), entry: { account: SHIP, className: INTERNAL } }),
      posted('x', 'V', '9999 Made up', 'Nonsense', '2026-11-01 09:00')
    ]);
    expect(odd.accounts.size).toBe(0);
    expect(odd.classes.size).toBe(0);
  });

  it('counts only the most recently posted lines', () => {
    const many = [
      posted('old', 'V', SHIP, INTERNAL, '2026-01-01 09:00'),
      posted('new1', 'V', OFFICE, INTERNAL, '2026-11-02 09:00'),
      posted('new2', 'V', OFFICE, INTERNAL, '2026-11-03 09:00')
    ];
    const limited = buildHistory(many, 2);
    expect(limited.size).toBe(2);
    expect(limited.accounts.has(SHIP)).toBe(false);
    expect(limited.accounts.get(OFFICE)?.count).toBe(2);
  });
});

describe('typing to narrow the list', () => {
  const layers = accountLayers({ category: 'office', vendor: 'V' }, buildHistory([]));
  const flat = (typed: string) => filterLayers(layers, typed).flatMap((l) => l.items);

  it('finds an account by number, by word, or by part of a word, in any case', () => {
    expect(flat('6184')).toEqual([SHIP]);
    expect(flat('ship')).toEqual([SHIP]);
    expect(flat('R&D')).toContain(RD);
    expect(flat('SUPPLIES')).toEqual(expect.arrayContaining([RD, OFFICE]));
  });

  it('needs every typed word, in any order', () => {
    expect(flat('supplies office')).toEqual([OFFICE]);
    expect(flat('travel airfare')).toEqual(['6101 Travel:Airfare']);
  });

  it('keeps the layer order and drops layers with no match', () => {
    const narrowed = filterLayers(layers, 'supplies');
    expect(ids(narrowed)[0]).toBe('category');
    expect(narrowed.every((l) => l.items.length > 0)).toBe(true);
    expect(filterLayers(layers, 'zzzz')).toEqual([]);
    expect(filterLayers(layers, '   ')).toHaveLength(layers.length);
  });

  it('has a title for every layer', () => {
    for (const layer of layers) expect(layer.title).toBe(LAYER_TITLES[layer.id]);
  });
});

describe('speed (P-055: the dropdown must never lag)', () => {
  it('counts 5,000 posted lines once and builds and filters a dropdown in milliseconds', () => {
    const accounts = LEDGER_ACCOUNTS.map(accountText);
    const classes = LEDGER_CLASSES.map((c) => c.name);
    const rows: LedgerRow[] = [];
    for (let i = 0; i < 5000; i++) {
      const minute = String(i % 60).padStart(2, '0');
      const day = String((i % 28) + 1).padStart(2, '0');
      rows.push(posted(String(i), `Vendor ${i % 300}`, accounts[i % accounts.length], classes[i % classes.length], `2026-0${(i % 9) + 1}-${day} 10:${minute}`));
    }

    let started = performance.now();
    const history = buildHistory(rows);
    const countMs = performance.now() - started;
    expect(history.size).toBe(500);

    started = performance.now();
    for (let i = 0; i < 1000; i++) {
      const layers = accountLayers({ category: 'rdMaterials', vendor: `Vendor ${i % 300}` }, history);
      filterLayers(layers, 'sup');
      filterLayers(classLayers({ vendor: `Vendor ${i % 300}` }, history), 'grants');
    }
    const perDropdownMs = (performance.now() - started) / 1000;

    // Generous limits for a slow shared machine: the real figures are far lower. A person notices lag above about 100 ms.
    expect(countMs).toBeLessThan(500);
    expect(perDropdownMs).toBeLessThan(5);
  });
});
