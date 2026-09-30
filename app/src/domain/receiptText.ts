// Guesses a receipt's date, total and vendor from its text (D-074). The text
// comes from the receipt reader in app/src/reading, one line per printed line,
// top to bottom. Anything not found is left empty rather than guessed wildly.
// First written and measured in docs/research/receipt-reading/parse.mjs.

import { IsoDate } from './types';

export interface ReceiptGuess {
  date: IsoDate;
  /** Whole cents, or null when no total was found. */
  amountCents: number | null;
  vendor: string;
}

export const EMPTY_GUESS: ReceiptGuess = { date: '', amountCents: null, vendor: '' };

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function validDate(y: number, m: number, d: number): IsoDate {
  if (y < 2000 || y > 2099 || m < 1 || m > 12 || d < 1 || d > 31) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return '';
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Every match of a global pattern. Each call site passes a new pattern literal. */
function allMatches(pattern: RegExp, text: string): RegExpExecArray[] {
  const out: RegExpExecArray[] = [];
  pattern.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    out.push(m);
    if (m[0] === '') pattern.lastIndex += 1;
  }
  return out;
}

const isDigit = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '9';

/** Readers often see 0 as O and 1 as l or I inside numbers. */
export function fixDigits(text: string): string {
  const zeros = text.split('');
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== 'O' && text[i] !== 'o') continue;
    const prev = text[i - 1];
    const next = text[i + 1];
    if ((isDigit(prev) && next !== undefined && /[\d\s/.-]/.test(next)) || (prev !== undefined && /[\d/.-]/.test(prev) && isDigit(next))) zeros[i] = '0';
  }
  const s = zeros.join('');
  const ones = s.split('');
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== 'l' && s[i] !== 'I' && s[i] !== '|') continue;
    const prev = s[i - 1];
    const next = s[i + 1];
    const sep = (c: string | undefined) => c !== undefined && /[/.-]/.test(c);
    if ((isDigit(prev) && isDigit(next)) || (sep(prev) && isDigit(next)) || (isDigit(prev) && sep(next))) ones[i] = '1';
  }
  return ones.join('');
}

/** Dates in the text, in the order they appear, as YYYY-MM-DD. US order (month first) for numeric dates. */
export function findDates(text: string): IsoDate[] {
  const t = fixDigits(text);
  const found: { index: number; iso: IsoDate }[] = [];
  const push = (index: number, iso: IsoDate) => {
    if (iso) found.push({ index, iso });
  };
  for (const m of allMatches(/\b(20\d\d)[-/.](\d{1,2})[-/.](\d{1,2})\b/g, t)) push(m.index, validDate(+m[1], +m[2], +m[3]));
  for (const m of allMatches(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/g, t)) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    push(m.index, validDate(y, +m[1], +m[2]));
  }
  for (const m of allMatches(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})\b/gi, t))
    push(m.index, validDate(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2]));
  for (const m of allMatches(/\b(\d{1,2})[\s-]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?[\s-]*(\d{4})\b/gi, t))
    push(m.index, validDate(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]));
  return found.sort((a, b) => a.index - b.index).map((f) => f.iso);
}

interface Amount {
  cents: number;
  /** Printed with a dollar sign or USD. */
  dollar: boolean;
}

/** Money amounts on one line, such as "$12.50", "1,234.00" or "12,50". */
export function findAmounts(line: string): Amount[] {
  const t = fixDigits(line);
  const out: Amount[] = [];
  for (const m of allMatches(/(\$|USD)?\s*(\d{1,3}(?:,\d{3})+|\d+)\s?[.,]\s?(\d{2})(?![\d%])/g, t)) {
    const before = t.slice(Math.max(0, m.index - 1), m.index);
    if (/[\d.]/.test(before)) continue; // part of a longer number
    const cents = Number(m[2].replace(/,/g, '')) * 100 + Number(m[3]);
    if (cents > 0 && cents < 10000000) out.push({ cents, dollar: !!m[1] });
  }
  return out;
}

const TOTAL = /(grand\s*total|total\s*due|amount\s*due|balance\s*due|total\s*usd|amount\s*paid|total\s*charged|\btotal\b)/i;
const NOT_TOTAL = /(sub\s*-?\s*total|total\s*(tax|savings|discount|items?)|tax\s*total|items?\s*total)/i;

/** The receipt's total in cents: from the last line labelled Total, Amount due or similar, never Subtotal. */
export function findTotal(lines: readonly string[]): number | null {
  const amounts = lines.map(findAmounts);
  let best: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!TOTAL.test(line) || NOT_TOTAL.test(line)) continue;
    let candidates = amounts[i];
    // Tilted photos can push the amount onto the line just above or below the label.
    if (candidates.length === 0) candidates = [...(amounts[i + 1] ?? []), ...(amounts[i - 1] ?? [])];
    // A total printed as "$1485" where the decimal point was not read: the last two digits are cents.
    if (candidates.length === 0) {
      const m = fixDigits(line).match(/\$\s?(\d{3,6})(?![\d.,])/);
      if (m) candidates = [{ cents: Number(m[1]), dollar: true }];
    }
    if (candidates.length === 0) continue;
    const pick = candidates.find((a) => a.dollar) ?? candidates[candidates.length - 1];
    best = pick.cents; // the last total line wins (a grand total after totals of parts)
  }
  if (best === null) {
    const all = amounts.reduce<number[]>((acc, a) => acc.concat(a.map((x) => x.cents)), []);
    if (all.length) best = Math.max(...all);
  }
  return best;
}

const SKIP =
  /(welcome|receipt|invoice|thank|www\.|\.com|\btel\b|phone|store\s*#|order\s*#|table\s*\d|server|cashier|guest|date|folio|e-?ticket|synthetic|sample)/i;

function titleCase(s: string): string {
  return s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s;
}

function vendorLine(raw: string): string {
  return raw
    .replace(/^\s*welcome\s+to\s*/i, '')
    .replace(/[|_~*=<>{}[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A name wrapped onto a second line: one or two words, letters only, same capitals. */
function continuation(first: string, next: string): boolean {
  if (!next || SKIP.test(next) || /[\d$#@]/.test(next) || next.split(' ').length > 2) return false;
  const upper = (s: string) => s === s.toUpperCase();
  return upper(first) === upper(next) && /^[A-Za-z][A-Za-z&' -]+$/.test(next);
}

/** The vendor: the first name-like line in the top eight. */
export function findVendor(lines: readonly string[]): string {
  const top = lines.slice(0, 8);
  for (let i = 0; i < top.length; i++) {
    const raw = top[i];
    let line = vendorLine(raw);
    if (!line) continue;
    const letters = (line.match(/[A-Za-z]/g) ?? []).length;
    const digits = (line.match(/\d/g) ?? []).length;
    if (letters < 3 || digits > letters / 3) continue;
    if (SKIP.test(line) && !/^\s*welcome\s+to\s+\S/i.test(raw)) continue;
    if (findDates(line).length || findAmounts(line).length) continue;
    const next = top[i + 1] ? vendorLine(top[i + 1]) : '';
    if (continuation(line, next)) line = `${line} ${next}`;
    const name = titleCase(line.replace(/[.,:;]+$/, ''));
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return '';
}

/** The date, total and vendor a receipt's text suggests. */
export function guessReceiptFields(lines: readonly string[]): ReceiptGuess {
  const clean = lines.map((l) => l.trim()).filter(Boolean);
  const dateLines = clean.filter((l) => /date/i.test(l));
  const date = findDates(dateLines.join('\n'))[0] ?? findDates(clean.join('\n'))[0] ?? '';
  return { vendor: findVendor(clean), date, amountCents: findTotal(clean) };
}
