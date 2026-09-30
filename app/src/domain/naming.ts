// Every naming rule: report numbers, report folders (D-012), receipt copies
// (D-044) and the CSV file (D-045). The flow cleans folder names again as a
// safety check, but the rule itself lives only here.

import { ExpenseLine } from './types';
import { fileExtension, receiptSourceRow } from './receipts';

export const TRIP_NAME_MAX = 40;

export function reportNumber(itemId: number): string {
  return `TR-${String(itemId).padStart(4, '0')}`;
}

/**
 * Letters, digits and hyphens only; spaces and other characters become hyphens;
 * accents are removed. "São Paulo trip #2" becomes "Sao-Paulo-trip-2".
 */
export function cleanNamePart(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface FolderNameInput {
  tripStart: string;
  ownerName: string;
  tripName: string;
  reportNumber: string;
  submissionNumber: number;
}

/** YYYY-MM-DD_Traveller-Name_Trip-Name_TR-0042, plus _R2 and up for resubmissions. */
export function folderName(input: FolderNameInput): string {
  const trip = cleanNamePart(input.tripName).slice(0, TRIP_NAME_MAX).replace(/-+$/g, '');
  const parts = [input.tripStart, cleanNamePart(input.ownerName), trip, input.reportNumber].filter((p) => p.length > 0);
  const suffix = input.submissionNumber > 1 ? `_R${input.submissionNumber}` : '';
  return parts.join('_') + suffix;
}

/** TR-0042_Expenses.csv, or TR-0042_R2_Expenses.csv for a resubmission. */
export function csvFileName(reportNo: string, submissionNumber: number): string {
  return submissionNumber > 1 ? `${reportNo}_R${submissionNumber}_Expenses.csv` : `${reportNo}_Expenses.csv`;
}

// Control characters are removed on purpose, so the rule against them in
// patterns does not apply here.
// eslint-disable-next-line no-control-regex
const SHAREPOINT_UNSAFE = /["*:<>?/\\|#%\u0000-\u001f]/g;
const FILE_BASE_MAX = 80;

/** Removes characters SharePoint does not allow and shortens very long names. */
export function cleanFileName(original: string): string {
  const ext = fileExtension(original);
  let base = ext ? original.slice(0, original.length - ext.length) : original;
  base = base
    .replace(SHAREPOINT_UNSAFE, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+|\.+$/g, '');
  if (base.length === 0) base = 'receipt';
  if (base.length > FILE_BASE_MAX) base = base.slice(0, FILE_BASE_MAX).trim();
  return base + ext;
}

/** R01_original.pdf for a row's first file, R01-2_original.pdf for its second. */
export function receiptCopyName(rowNumber: number, fileIndex: number, originalName: string): string {
  const row = `R${String(rowNumber).padStart(2, '0')}`;
  const prefix = fileIndex === 0 ? row : `${row}-${fileIndex + 1}`;
  return `${prefix}_${cleanFileName(originalName)}`;
}

export interface PackageReceipt {
  lineId: string;
  receiptId: string;
  rowNumber: number;
  packageName: string;
}

/**
 * The receipt copies in a report folder. A receipt shared by several rows
 * ("Same receipt as row N") is copied once, under the row that holds it.
 */
export function packageReceipts(lines: readonly ExpenseLine[]): PackageReceipt[] {
  const result: PackageReceipt[] = [];
  for (const line of lines) {
    if (line.sameReceiptAsRow !== null) continue;
    line.receipts.forEach((r, index) => {
      result.push({ lineId: line.id, receiptId: r.id, rowNumber: line.rowNumber, packageName: receiptCopyName(line.rowNumber, index, r.fileName) });
    });
  }
  return result;
}

/** The package file names a row's receipts appear under (for the CSV). */
export function receiptNamesForRow(line: ExpenseLine, lines: readonly ExpenseLine[]): string[] {
  const source = receiptSourceRow(line, lines);
  if (!source) return [];
  return source.receipts.map((r, index) => receiptCopyName(source.rowNumber, index, r.fileName));
}
