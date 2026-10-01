// Every naming rule: request numbers, request folders (travel D-012), file
// copies (travel D-044, P-021) and the CSV file (travel D-045, P-026). The flow
// cleans folder names again as a safety check, but the rule itself lives only here.

import { fileExtension, receiptFiles, receiptSourceRow } from './receipts';
import { FileKind, PurchaseLine } from './types';

export const PURPOSE_NAME_MAX = 40;
/** A long display name is cut too, so the request number and the _R2 suffix always survive the flow's 120-character limit on a folder name. */
export const OWNER_NAME_MAX = 40;

export function requestNumber(itemId: number): string {
  return `PR-${String(itemId).padStart(4, '0')}`;
}

// Control characters, zero-width characters, direction marks and overrides,
// and the byte-order mark. They are invisible, and a direction override can
// make a name read differently from what it is ("receipt\u202Efdp.exe" shows
// as "receiptexe.pdf"), so they are removed from every name the app makes.
// eslint-disable-next-line no-control-regex
const INVISIBLE = /[\u0000-\u001f\u007f\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** A name with its invisible and direction characters removed. */
export function stripInvisible(text: string): string {
  return text.replace(INVISIBLE, '');
}

/**
 * Letters, digits and hyphens only; spaces and other characters become hyphens;
 * accents and invisible characters are removed. "Lab supplies, Zürich office
 * #2" becomes "Lab-supplies-Zurich-office-2".
 */
export function cleanNamePart(text: string): string {
  return stripInvisible(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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
  const owner = cleanNamePart(input.ownerName).slice(0, OWNER_NAME_MAX).replace(/-+$/g, '');
  const parts = [input.firstPurchaseDate, owner, purpose, input.requestNumber].filter((p) => p.length > 0);
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

/** Removes invisible characters and characters SharePoint does not allow, and shortens very long names. */
export function cleanFileName(original: string): string {
  const visible = stripInvisible(original);
  const ext = fileExtension(visible);
  let base = ext ? visible.slice(0, visible.length - ext.length) : visible;
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

/** The copies of one row's own files of one kind, under the row's own number. */
function ownCopyNames(line: PurchaseLine, kind: FileKind): string[] {
  return line.files.filter((f) => f.kind === kind).map((f, index) => fileCopyName(kind, line.rowNumber, index, f.fileName));
}

/**
 * The file copies in a request folder: every file each row holds, under that
 * row's number. A receipt shared by several rows ("Same receipt as row N") is
 * held by one row, so it is copied once, under that row. Quotes are never
 * shared. A row that points at another row's receipt should hold no receipt
 * of its own (the data services refuse it), but if it does, that file is
 * copied too: nothing attached is ever left out of the package.
 */
export function packageFiles(lines: readonly PurchaseLine[]): PackageFile[] {
  const result: PackageFile[] = [];
  for (const line of lines) {
    for (const kind of ['receipt', 'quote'] as const) {
      line.files
        .filter((f) => f.kind === kind)
        .forEach((f, index) => {
          result.push({ lineId: line.id, fileId: f.id, rowNumber: line.rowNumber, kind, packageName: fileCopyName(kind, line.rowNumber, index, f.fileName) });
        });
    }
  }
  return result;
}

/**
 * The package file names a row's receipts or quotes appear under (for the
 * CSV): its own files, and for a row that shares another row's receipt, that
 * row's receipt copies first.
 */
export function fileNamesForRow(line: PurchaseLine, lines: readonly PurchaseLine[], kind: FileKind): string[] {
  const own = ownCopyNames(line, kind);
  if (kind !== 'receipt' || line.sameReceiptAsRow === null) return own;
  const source = receiptSourceRow(line, lines);
  const shared = source ? receiptFiles(source).map((f, index) => fileCopyName('receipt', source.rowNumber, index, f.fileName)) : [];
  return [...shared, ...own];
}
