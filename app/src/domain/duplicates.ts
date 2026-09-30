// Possible duplicates (D-031): the same receipt file, or the same date, vendor
// and amount. These are warnings; they never block a submission.

import { ExpenseLine } from './types';

export interface LineRef {
  line: ExpenseLine;
  reportNumber: string;
  ownerEmail: string;
}

export interface DuplicateMatch {
  lineId: string;
  other: LineRef;
  kind: 'file' | 'entry';
}

function entryKey(line: ExpenseLine): string | null {
  if (!line.date || !line.vendor.trim() || line.amountCents === null) return null;
  return `${line.date}|${line.vendor.trim().toLowerCase().replace(/\s+/g, ' ')}|${line.amountCents}`;
}

/** Fingerprints of the files a row holds itself (shared receipts are not duplicates). */
function ownFingerprints(line: ExpenseLine): string[] {
  return line.sameReceiptAsRow === null ? line.receipts.map((r) => r.fingerprint).filter((f) => f) : [];
}

/**
 * Compares each row of a report with the other rows of the same report and
 * with the rows of other reports in `others`.
 */
export function findDuplicates(reportNumber: string, lines: readonly ExpenseLine[], others: readonly LineRef[]): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  const candidates: LineRef[] = [...lines.map((line) => ({ line, reportNumber, ownerEmail: '' })), ...others];
  for (const line of lines) {
    const prints = ownFingerprints(line);
    const key = entryKey(line);
    for (const other of candidates) {
      if (other.line.id === line.id) continue;
      if (prints.some((p) => ownFingerprints(other.line).includes(p))) {
        matches.push({ lineId: line.id, other, kind: 'file' });
      } else if (key !== null && key === entryKey(other.line)) {
        matches.push({ lineId: line.id, other, kind: 'entry' });
      }
    }
  }
  return matches;
}

export interface CrossEmployeeMatch {
  a: LineRef;
  b: LineRef;
  kind: 'file' | 'entry';
}

/** For the admin view: possible duplicates between different employees' reports. */
export function findCrossEmployeeDuplicates(all: readonly LineRef[]): CrossEmployeeMatch[] {
  const result: CrossEmployeeMatch[] = [];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      if (a.ownerEmail === b.ownerEmail) continue;
      const pa = ownFingerprints(a.line);
      if (pa.some((p) => ownFingerprints(b.line).includes(p))) {
        result.push({ a, b, kind: 'file' });
        continue;
      }
      const ka = entryKey(a.line);
      if (ka !== null && ka === entryKey(b.line)) result.push({ a, b, kind: 'entry' });
    }
  }
  return result;
}
