// Prototype of the receipt field guesser (D-074). Input: the receipt's text lines, top to bottom.
// Output: suggested vendor, date (YYYY-MM-DD) and total (string with two decimals). Anything
// not found is left empty rather than guessed wildly.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function pad(n) {
  return String(n).padStart(2, '0');
}

function validDate(y, m, d) {
  if (y < 2000 || y > 2099 || m < 1 || m > 12 || d < 1 || d > 31) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return '';
  return `${y}-${pad(m)}-${pad(d)}`;
}

// OCR often reads 0 as O and 1 as l or I inside numbers.
function fixDigits(s) {
  return s.replace(/(?<=\d)[Oo](?=[\d\s/.-])|(?<=[\d/.-])[Oo](?=\d)/g, '0').replace(/(?<=\d)[lI|](?=\d)|(?<=[/.-])[lI|](?=\d)|(?<=\d)[lI|](?=[/.-])/g, '1');
}

export function findDates(text) {
  const t = fixDigits(text);
  const found = [];
  const push = (index, iso) => iso && found.push({ index, iso });
  for (const m of t.matchAll(/\b(20\d\d)[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) push(m.index, validDate(+m[1], +m[2], +m[3]));
  for (const m of t.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/g)) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    push(m.index, validDate(y, +m[1], +m[2]));
  }
  for (const m of t.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})\b/gi))
    push(m.index, validDate(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2]));
  for (const m of t.matchAll(/\b(\d{1,2})[\s-]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?[\s-]*(\d{4})\b/gi))
    push(m.index, validDate(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]));
  return found.sort((a, b) => a.index - b.index).map((f) => f.iso);
}

export function findAmounts(line) {
  const t = fixDigits(line);
  const out = [];
  for (const m of t.matchAll(/(\$|USD)?\s*(\d{1,3}(?:,\d{3})+|\d+)\s?[.,]\s?(\d{2})(?![\d%])/g)) {
    const before = t.slice(Math.max(0, m.index - 1), m.index);
    if (/[\d.]/.test(before)) continue; // part of a longer number
    const value = Number(m[2].replace(/,/g, '') + '.' + m[3]);
    if (value > 0 && value < 100000) out.push({ value, dollar: !!m[1] });
  }
  return out;
}

const TOTAL = /(grand\s*total|total\s*due|amount\s*due|balance\s*due|total\s*usd|amount\s*paid|total\s*charged|\btotal\b)/i;
const NOT_TOTAL = /(sub\s*-?\s*total|total\s*(tax|savings|discount|items?)|tax\s*total|items?\s*total)/i;

export function findTotal(lines) {
  const amounts = lines.map(findAmounts);
  let best = null;
  lines.forEach((line, i) => {
    if (!TOTAL.test(line) || NOT_TOTAL.test(line)) return;
    let cand = amounts[i];
    // Tilted photos can push the amount onto the line just above or below the label.
    if (cand.length === 0) cand = [...(amounts[i + 1] ?? []), ...(amounts[i - 1] ?? [])];
    // A total printed as "$1485" where the decimal point was not read: the last two digits are cents.
    if (cand.length === 0) {
      const m = fixDigits(line).match(/\$\s?(\d{3,6})(?![\d.,])/);
      if (m) cand = [{ value: Number(m[1]) / 100, dollar: true }];
    }
    if (cand.length === 0) return;
    const pick = cand.find((a) => a.dollar) ?? cand[cand.length - 1];
    best = pick.value; // the last total line wins (grand total after totals of parts)
  });
  if (best === null) {
    const all = amounts.flat().map((a) => a.value);
    if (all.length) best = Math.max(...all);
  }
  return best === null ? '' : best.toFixed(2);
}

const SKIP = /(welcome|receipt|invoice|thank|www\.|\.com|\btel\b|phone|store\s*#|order\s*#|table\s*\d|server|cashier|guest|date|folio|e-?ticket|synthetic|sample)/i;

function titleCase(s) {
  return s === s.toUpperCase() ? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : s;
}

function vendorLine(raw) {
  return raw.replace(/^\s*welcome\s+to\s*/i, '').replace(/[|_~*=<>{}[\]]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// A name wrapped onto a second line: 1 or 2 words, letters only, same capitalisation.
function continuation(first, next) {
  if (!next || SKIP.test(next) || /[\d$#@]/.test(next) || next.split(' ').length > 2) return false;
  const upper = (s) => s === s.toUpperCase();
  return upper(first) === upper(next) && /^[A-Za-z][A-Za-z&' -]+$/.test(next);
}

export function findVendor(lines) {
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
    return titleCase(line.replace(/[.,:;]+$/, ''));
  }
  return '';
}

export function guessFields(lines) {
  const clean = lines.map((l) => l.trim()).filter(Boolean);
  const dateLines = clean.filter((l) => /date/i.test(l));
  const date = findDates(dateLines.join('\n'))[0] ?? findDates(clean.join('\n'))[0] ?? '';
  return { vendor: findVendor(clean), date, total: findTotal(clean) };
}
