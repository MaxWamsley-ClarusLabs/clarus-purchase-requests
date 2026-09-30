// Every naming rule: request numbers, request folders (travel D-012), file
// copies (travel D-044, P-021) and the CSV file (travel D-045, P-026). The flow
// cleans folder names again as a safety check, but the rule itself lives only here.

import { fileExtension, receiptSourceRow } from './receipts';
import { FileKind, PurchaseLine } from './types';

export const PURPOSE_NAME_MAX = 40;

export function requestNumber(itemId: number): string {
  return `PR-${String(itemId).padStart(4, '0')}`;
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
  /** The earliest purchase date: the year shows where the folder is filed (P-026). */
  firstPurchaseDate: string;
  ownerName: string;
  businessPurpose: string;
  requestNumber: string;
  submissionNumber: number;
}

/** YYYY-MM-DD_Employee-Name_Business-Purpose_PR-0042, plus _R2 and up for resubmissions. */
export function folderName(input: FolderNameInput): string {
  const purpose = cleanNamePart(input.businessPurpose).slice(0, PURPOSE_NAME_MAX).replace(/-+$/g, '');
  const parts = [input.firstPurchaseDate, cleanNamePart(input.ownerName), purpose, input.requestNumber].filter((p) => p.length > 0);
  const suffix = input.submissionNumber > 1 ? `_R${input.submissionNumber}` : '';
  return parts.join('_') + suffix;
}

/** PR-0042_Purchases.csv, or PR-0042_R2_Purchases.csv for a resubmission. */
export function csvFileName(requestNo: string, submissionNumber: number): string {
  return submissionNumber > 1 ? `${requestNo}_R${submissionNumber}_Purchases.csv` : `${requestNo}_Purchases.csv`;
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

const PREFIX: Record<FileKind, string> = { receipt: 'R', quote: 'Q' };

/**
 * R01_original.pdf for a row's first receipt, R01-2_original.pdf for its
 * second; Q01_quote.pdf for a quote (P-021).
 */
export function fileCopyName(kind: FileKind, rowNumber: number, fileIndex: number, originalName: string): string {
  const row = `${PREFIX[kind]}${String(rowNumber).padStart(2, '0')}`;
  const prefix = fileIndex === 0 ? row : `${row}-${fileIndex + 1}`;
  return `${prefix}_${cleanFileName(originalName)}`;
}

export interface PackageFile {
  lineId: string;
  fileId: string;
  rowNumber: number;
  kind: FileKind;
  packageName: string;
}

/**
 * The file copies in a request folder. A receipt shared by several rows
 * ("Same receipt as row N") is copied once, under the row that holds it.
 * Quotes are never shared.
 */
export function packageFiles(lines: readonly PurchaseLine[]): PackageFile[] {
  const result: PackageFile[] = [];
  for (const line of lines) {
    for (const kind of ['receipt', 'quote'] as const) {
      if (kind === 'receipt' && line.sameReceiptAsRow !== null) continue;
      line.files
        .filter((f) => f.kind === kind)
        .forEach((f, index) => {
          result.push({ lineId: line.id, fileId: f.id, rowNumber: line.rowNumber, kind, packageName: fileCopyName(kind, line.rowNumber, index, f.fileName) });
        });
    }
  }
  return result;
}

/** The package file names a row's receipts or quotes appear under (for the CSV). */
export function fileNamesForRow(line: PurchaseLine, lines: readonly PurchaseLine[], kind: FileKind): string[] {
  const source = kind === 'receipt' ? receiptSourceRow(line, lines) : line;
  if (!source) return [];
  return source.files.filter((f) => f.kind === kind).map((f, index) => fileCopyName(kind, source.rowNumber, index, f.fileName));
}
