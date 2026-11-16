// The layered suggestions for the Ledger's account and class dropdowns (P-055). Max's wish: the dropdown opens with
// the likeliest choices on top, typing narrows it, and it must never be slow.
//
// The layers, top to bottom. An item shows once, at the highest layer it qualifies for:
//   1. From this request    the line's own category account (accounts only)
//   2. Used for this vendor   what the bookkeepers posted last time for the same vendor
//   3. Used most often        what the company has posted most
//   4. Usual for Clarus       Max's fixed order (purchaseRules.ts); a new site starts here
//   5. All other accounts     the rest of the list, by number (accounts only)
//
// The history is the most recently posted lines only (LEDGER_HISTORY_LIMIT), counted once when the page opens.
// Choosing an item never fills anything in by itself: a suggestion only decides the order.

import { LedgerRow } from './ledger';
import { LEDGER_ACCOUNTS, LEDGER_CLASSES, LEDGER_HISTORY_LIMIT, accountText, defaultLedgerAccount, vendorKey } from './purchaseRules';

export type LayerId = 'category' | 'vendor' | 'common' | 'usual' | 'rest';

export interface Layer {
  id: LayerId;
  title: string;
  /** The exact QuickBooks text of each item, in the order shown. */
  items: string[];
}

export const LAYER_TITLES: Record<LayerId, string> = {
  category: 'From this request',
  vendor: 'Used for this vendor before',
  common: 'Used most often',
  usual: 'Usual for Clarus',
  rest: 'All other accounts'
};

/** How many "used most often" items are shown. */
export const COMMON_COUNT = 5;

/** How many accounts are Max's "usual for Clarus" group before the rest by number (P-055). */
export const USUAL_ACCOUNT_COUNT = 14;

interface Counts {
  count: number;
  /** The latest time it was posted ("YYYY-MM-DD HH:MM"), to order equal counts. */
  last: string;
}

/** What the bookkeepers posted recently: counts overall and by vendor, for accounts and for classes. */
export interface LedgerHistory {
  accounts: Map<string, Counts>;
  classes: Map<string, Counts>;
  vendorAccounts: Map<string, Map<string, Counts>>;
  vendorClasses: Map<string, Map<string, Counts>>;
  /** How many posted lines were counted. */
  size: number;
}

function bump(map: Map<string, Counts>, key: string, at: string): void {
  const found = map.get(key);
  if (found) {
    found.count += 1;
    if (at > found.last) found.last = at;
  } else {
    map.set(key, { count: 1, last: at });
  }
}

function bumpVendor(map: Map<string, Map<string, Counts>>, vendor: string, key: string, at: string): void {
  let inner = map.get(vendor);
  if (!inner) {
    inner = new Map();
    map.set(vendor, inner);
  }
  bump(inner, key, at);
}

/**
 * Counts the most recently posted lines, once. A line whose account or class is not in the lists (it was edited
 * outside the app) is not counted for that item.
 */
export function buildHistory(rows: readonly LedgerRow[], limit: number = LEDGER_HISTORY_LIMIT): LedgerHistory {
  const posted = rows.filter((r) => r.entry.posted).sort((a, b) => b.entry.postedOn.localeCompare(a.entry.postedOn));
  const recent = posted.slice(0, Math.max(0, limit));
  const history: LedgerHistory = { accounts: new Map(), classes: new Map(), vendorAccounts: new Map(), vendorClasses: new Map(), size: recent.length };
  const accountOk = new Set(LEDGER_ACCOUNTS.map(accountText));
  const classOk = new Set(LEDGER_CLASSES.map((c) => c.name));
  for (const row of recent) {
    const at = row.entry.postedOn;
    const vendor = vendorKey(row.line.vendor);
    const account = row.entry.account;
    if (accountOk.has(account)) {
      bump(history.accounts, account, at);
      if (vendor !== '') bumpVendor(history.vendorAccounts, vendor, account, at);
    }
    const className = row.entry.className;
    if (classOk.has(className)) {
      bump(history.classes, className, at);
      if (vendor !== '') bumpVendor(history.vendorClasses, vendor, className, at);
    }
  }
  return history;
}

/** Items of a counts map, most used first, then most recent, then the fixed order. */
function ranked(counts: Map<string, Counts> | undefined, fixedOrder: readonly string[]): string[] {
  if (!counts) return [];
  const position = new Map(fixedOrder.map((text, i) => [text, i]));
  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].last.localeCompare(a[1].last) || (position.get(a[0]) ?? 0) - (position.get(b[0]) ?? 0))
    .map(([text]) => text);
}

/** Builds the layers: each item once, at its highest layer; empty layers are left out. */
function stack(candidates: readonly { id: LayerId; items: readonly string[] }[]): Layer[] {
  const shown = new Set<string>();
  const layers: Layer[] = [];
  for (const candidate of candidates) {
    const items = candidate.items.filter((item) => {
      if (shown.has(item)) return false;
      shown.add(item);
      return true;
    });
    if (items.length > 0) layers.push({ id: candidate.id, title: LAYER_TITLES[candidate.id], items });
  }
  return layers;
}

const ACCOUNT_ORDER = LEDGER_ACCOUNTS.map(accountText);
const CLASS_ORDER = LEDGER_CLASSES.map((c) => c.name);

/** The account dropdown's layers for a line: its category, its vendor, what is used most, then Max's order. */
export function accountLayers(line: { category: string; vendor: string }, history: LedgerHistory): Layer[] {
  const vendor = vendorKey(line.vendor);
  const category = defaultLedgerAccount(line.category);
  return stack([
    { id: 'category', items: category ? [category] : [] },
    { id: 'vendor', items: vendor ? ranked(history.vendorAccounts.get(vendor), ACCOUNT_ORDER) : [] },
    { id: 'common', items: ranked(history.accounts, ACCOUNT_ORDER).slice(0, COMMON_COUNT) },
    { id: 'usual', items: ACCOUNT_ORDER.slice(0, USUAL_ACCOUNT_COUNT) },
    { id: 'rest', items: ACCOUNT_ORDER.slice(USUAL_ACCOUNT_COUNT) }
  ]);
}

/** The class dropdown's layers for a line: its vendor, what is used most, then Max's order. All seven classes are "usual". */
export function classLayers(line: { vendor: string }, history: LedgerHistory): Layer[] {
  const vendor = vendorKey(line.vendor);
  return stack([
    { id: 'vendor', items: vendor ? ranked(history.vendorClasses.get(vendor), CLASS_ORDER) : [] },
    { id: 'common', items: ranked(history.classes, CLASS_ORDER).slice(0, COMMON_COUNT) },
    { id: 'usual', items: CLASS_ORDER }
  ]);
}

/**
 * Narrows layers to the items that match what was typed. Every typed word must appear somewhere in the item's number
 * or name, in any case ("ship" and "6184" both find "6184 Shipping/Postage"). Order and layers are kept; a layer with
 * no match is dropped.
 */
export function filterLayers(layers: readonly Layer[], typed: string): Layer[] {
  const words = typed
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w !== '');
  if (words.length === 0) return [...layers];
  return layers
    .map((layer) => ({ ...layer, items: layer.items.filter((item) => words.every((w) => item.toLowerCase().includes(w))) }))
    .filter((layer) => layer.items.length > 0);
}
