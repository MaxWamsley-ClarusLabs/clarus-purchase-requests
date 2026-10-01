// Pasting from a spreadsheet into the purchases grid (travel D-033). Pure
// functions: the grid only applies what is worked out here, so what a paste
// does can be tested without a browser.

import { isValidIsoDate } from '../domain/dates';
import { centsToPlain, parseAmountToCents } from '../domain/money';
import { CATEGORIES, PAID_BY_OPTIONS } from '../domain/purchaseRules';
import { TEXT_MAX_LENGTH } from '../domain/types';
import { LineChanges } from '../data/PurchaseDataService';

/** The grid's columns that take a typed or chosen value, in grid order. Pasted columns fill these from left to right. */
export type PasteColumn = 'date' | 'vendor' | 'description' | 'category' | 'amount' | 'paidBy';
export const PASTE_COLUMNS: readonly PasteColumn[] = ['date', 'vendor', 'description', 'category', 'amount', 'paidBy'];
/** When the approver buys, nobody is asked who paid, so the grid has no such column (P-037). */
export const PASTE_COLUMNS_APPROVER_BUYS: readonly PasteColumn[] = PASTE_COLUMNS.filter((c) => c !== 'paidBy');

/** Why a pasted cell that held something was not used. */
export type PasteProblem = 'date' | 'category' | 'amount' | 'paidBy' | 'outside';

// ---- Reading the copied text ----------------------------------------------

/**
 * Reads text copied from a spreadsheet such as Excel or Google Sheets: rows
 * end with a line break and cells are separated by tabs. A cell that holds a
 * tab, a line break or a quote is copied in quotes, with each quote inside
 * doubled; it stays one cell. A cell that only starts with a quote, without
 * being a proper quoted cell, is kept as it is. One line break at the very end
 * (Excel adds one) is not another row. Empty cells stay empty.
 */
export function parseClipboardTable(text: string): string[][] {
  const body = text.replace(/\r\n?/g, '\n').replace(/\n$/, '');
  if (body === '') return [];
  const rows: string[][] = [];
  let row: string[] = [];
  let at = 0;
  for (;;) {
    const quoted = body[at] === '"' ? readQuoted(body, at) : null;
    const end = quoted ? quoted.end : nextBreak(body, at);
    row.push(quoted ? quoted.value : body.slice(at, end));
    if (end >= body.length) break;
    if (body[end] === '\n') {
      rows.push(row);
      row = [];
    }
    at = end + 1;
  }
  rows.push(row);
  return rows;
}

/** Where the cell starting at `from` ends: the next tab or line break, or the end. */
function nextBreak(body: string, from: number): number {
  for (let i = from; i < body.length; i++) if (body[i] === '\t' || body[i] === '\n') return i;
  return body.length;
}

/** A cell in quotes starting at `start`: its text and where it ends, or null if the quotes are not a proper pair followed by a tab, a line break or the end. */
function readQuoted(body: string, start: number): { value: string; end: number } | null {
  let value = '';
  for (let i = start + 1; i < body.length; i++) {
    if (body[i] !== '"') {
      value += body[i];
    } else if (body[i + 1] === '"') {
      value += '"';
      i++;
    } else {
      const after = body[i + 1];
      return after === undefined || after === '\t' || after === '\n' ? { value, end: i + 1 } : null;
    }
  }
  return null;
}

// ---- Turning a pasted cell into a value -----------------------------------

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** 1 to 12 for a month name or its first three letters ("Oct", "oct.", "October", "Sept"), or null. */
function monthNumber(name: string): number | null {
  const word = name.toLowerCase().replace(/\.$/, '');
  if (word === 'sept') return 9;
  const index = MONTHS.findIndex((m) => m === word || (word.length === 3 && m.startsWith(word)));
  return index < 0 ? null : index + 1;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * A pasted date as YYYY-MM-DD, or null if it is not one. Accepted: 2026-10-14
 * and 2026/10/14; 10/14/2026 and 1/5/2026 (month first, as in the US); "Oct
 * 14, 2026" and "14 Oct 2026" (or the month in full). The year must have four
 * digits, and the date must be a real date the app accepts (`isValidIsoDate`).
 */
export function parsePastedDate(text: string): string | null {
  const value = text.trim().replace(/\s+/g, ' ');
  let year: string;
  let month: number | null;
  let day: number;
  let m: RegExpMatchArray | null;
  if ((m = value.match(/^(\d{4})([-/])(\d{1,2})\2(\d{1,2})$/))) {
    [year, month, day] = [m[1], Number(m[3]), Number(m[4])];
  } else if ((m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    [year, month, day] = [m[3], Number(m[1]), Number(m[2])];
  } else if ((m = value.match(/^([A-Za-z]{3,9}\.?) (\d{1,2}),? (\d{4})$/))) {
    [year, month, day] = [m[3], monthNumber(m[1]), Number(m[2])];
  } else if ((m = value.match(/^(\d{1,2})[ -]([A-Za-z]{3,9}\.?)[ -](\d{4})$/))) {
    [year, month, day] = [m[3], monthNumber(m[2]), Number(m[1])];
  } else return null;
  if (month === null) return null;
  const iso = `${year}-${pad(month)}-${pad(day)}`;
  return isValidIsoDate(iso) ? iso : null;
}

/** One-line text: line breaks and tabs inside a pasted cell become spaces. */
const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();
const sameWords = (a: string, b: string): boolean => oneLine(a).toLowerCase() === oneLine(b).toLowerCase();

/** What one pasted cell does to its row. */
export interface CellPaste {
  /** The change to make; null when the cell changes nothing (it was empty, or could not be used). */
  changes: LineChanges | null;
  /** For the amount column: the text the cell shows, an amount written the app's way, or the pasted text when it is not an amount. */
  amountText?: string;
  /** Why a cell that held something was not used. An amount that is not an amount empties the amount, as typing it would. */
  problem?: PasteProblem;
  /** The text was longer than a box holds and was cut to TEXT_MAX_LENGTH characters. */
  cut?: boolean;
}

/** Turns the text of one pasted cell into a change for the column it lands in. */
export function pasteCell(column: PasteColumn, text: string): CellPaste {
  const value = oneLine(text);
  if (value === '') return { changes: null };
  switch (column) {
    case 'date': {
      const date = parsePastedDate(value);
      return date ? { changes: { date } } : { changes: null, problem: 'date' };
    }
    case 'amount': {
      const cents = parseAmountToCents(value);
      return cents === null
        ? { changes: { amountCents: null }, amountText: value, problem: 'amount' }
        : { changes: { amountCents: cents }, amountText: centsToPlain(cents) };
    }
    case 'category': {
      const exact = CATEGORIES.find((c) => sameWords(c.label, value) || c.id === value);
      if (exact) return { changes: { category: exact.id } };
      // "Other: Lab furniture", as the CSV and the emails write a category that has a description.
      const described = CATEGORIES.find((c) => c.needsDescription && value.toLowerCase().startsWith(`${c.label.toLowerCase()}:`));
      if (described) {
        const description = value.slice(described.label.length + 1).trim();
        return { changes: { category: described.id, categoryOther: description.slice(0, TEXT_MAX_LENGTH) }, cut: description.length > TEXT_MAX_LENGTH };
      }
      return { changes: null, problem: 'category' };
    }
    case 'paidBy': {
      const paidBy = PAID_BY_OPTIONS.find((p) => [p.label, p.shortLabel, p.id].some((v) => sameWords(v, value)));
      return paidBy ? { changes: { paidBy: paidBy.id } } : { changes: null, problem: 'paidBy' };
    }
    case 'vendor':
    case 'description': {
      const kept = value.slice(0, TEXT_MAX_LENGTH);
      return { changes: column === 'vendor' ? { vendor: kept } : { description: kept }, cut: value.length > TEXT_MAX_LENGTH };
    }
  }
}

// ---- A whole paste ----------------------------------------------------------

/** What pasting a table does to the grid. */
export interface PastePlan {
  /** Changes for each row that changes, in grid order. */
  rows: { lineId: string; changes: LineChanges; amountText?: string }[];
  /** Pasted rows that held something but had no grid row left to go into. */
  rowsLeftOver: number;
  /** Cells that held something but were not used, by reason. */
  skipped: Partial<Record<PasteProblem, number>>;
  /** Text cut to TEXT_MAX_LENGTH characters. */
  cut: number;
}

const filled = (cell: string): boolean => cell.trim() !== '';

/**
 * Lays a pasted table over the grid: its first cell goes into the cell pasted
 * into (row `startRow` of `lineIds`, column `startColumn` of PASTE_COLUMNS),
 * and the rest fill the cells below and to the right.
 */
export function planPaste(
  table: readonly (readonly string[])[],
  lineIds: readonly string[],
  startRow: number,
  startColumn: number,
  columns: readonly PasteColumn[] = PASTE_COLUMNS
): PastePlan {
  const plan: PastePlan = { rows: [], rowsLeftOver: 0, skipped: {}, cut: 0 };
  const skip = (problem: PasteProblem) => (plan.skipped[problem] = (plan.skipped[problem] ?? 0) + 1);
  table.forEach((cells, r) => {
    const lineId = lineIds[startRow + r];
    if (lineId === undefined) {
      if (cells.some(filled)) plan.rowsLeftOver += 1;
      return;
    }
    let changes: LineChanges = {};
    let amountText: string | undefined;
    cells.forEach((cell, c) => {
      const column = columns[startColumn + c];
      if (!column) {
        if (filled(cell)) skip('outside');
        return;
      }
      const result = pasteCell(column, cell);
      if (result.problem) skip(result.problem);
      if (result.cut) plan.cut += 1;
      if (result.amountText !== undefined) amountText = result.amountText;
      if (result.changes) changes = { ...changes, ...result.changes };
    });
    if (Object.keys(changes).length > 0) plan.rows.push(amountText === undefined ? { lineId, changes } : { lineId, changes, amountText });
  });
  return plan;
}

/** Why a cell was not pasted. An amount that is not a number is not skipped: it empties the amount, and is counted on its own. */
const REASONS = {
  date: 'dates must look like 2026-10-14, 10/14/2026 or Oct 14, 2026',
  category: 'categories must match a category name',
  paidBy: `who paid must be ${PAID_BY_OPTIONS.map((p) => p.label).join(' or ')}`,
  outside: 'cells to the right of Who paid do not fit'
} satisfies Record<Exclude<PasteProblem, 'amount'>, string>;
const ORDER: readonly Exclude<PasteProblem, 'amount'>[] = ['date', 'category', 'paidBy', 'outside'];

const count = (n: number, one: string, many: string): string => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/** The warning to show after a paste, or '' when everything pasted went in as it was. */
export function pasteWarning(plan: PastePlan, columns: readonly PasteColumn[] = PASTE_COLUMNS): string {
  const parts: string[] = [];
  if (plan.rowsLeftOver > 0) {
    const n = plan.rowsLeftOver;
    parts.push(
      `${count(n, 'row was', 'rows were')} not pasted: there ${n === 1 ? 'is no row' : 'are no rows'} for ${n === 1 ? 'it' : 'them'} below. ` +
        `Add ${count(n, 'row', 'rows')} first (Add purchase without a file), then paste ${n === 1 ? 'it' : 'them'} again.`
    );
  }
  const problems = ORDER.filter((p) => (plan.skipped[p] ?? 0) > 0);
  const skipped = problems.reduce((sum, p) => sum + (plan.skipped[p] ?? 0), 0);
  // The last column the grid has to paste into: when the approver buys, that is Amount (the item link is typed or pasted into its own box).
  const lastColumn = columns[columns.length - 1] === 'paidBy' ? 'Who paid' : 'Amount';
  const reason = (p: Exclude<PasteProblem, 'amount'>) => (p === 'outside' ? `cells to the right of ${lastColumn} do not fit` : REASONS[p]);
  if (skipped > 0) parts.push(`${count(skipped, 'cell was', 'cells were')} not pasted: ${problems.map(reason).join('; ')}.`);
  const amounts = plan.skipped.amount ?? 0;
  if (amounts > 0)
    parts.push(`${count(amounts, 'amount was not a number and was', 'amounts were not numbers and were')} left empty: amounts must be numbers like 45.10.`);
  if (plan.cut > 0) parts.push(`${count(plan.cut, 'cell was', 'cells were')} cut to ${TEXT_MAX_LENGTH} characters, the most a box holds.`);
  return parts.join(' ');
}
