// File rules: accepted files (travel D-041), receipts and quotes (P-021), and
// whether a row has a receipt (travel D-038).

import { vendorKey } from './purchaseRules';
import { AttachedFile, PurchaseLine } from './types';

export const MAX_RECEIPT_BYTES = 15 * 1024 * 1024;

export const ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.heic'] as const;

/** For the file picker's accept attribute. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_EXTENSIONS.join(',');

export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot < 0 ? '' : fileName.slice(dot).toLowerCase();
}

export type FileCheck = { ok: true } | { ok: false; reason: 'type' | 'size' | 'empty' };

export function checkReceiptFile(fileName: string, sizeBytes: number): FileCheck {
  if (!(ACCEPTED_EXTENSIONS as readonly string[]).includes(fileExtension(fileName))) {
    return { ok: false, reason: 'type' };
  }
  if (sizeBytes === 0) return { ok: false, reason: 'empty' };
  if (sizeBytes > MAX_RECEIPT_BYTES) return { ok: false, reason: 'size' };
  return { ok: true };
}

/** Browsers can show PDFs and common images; HEIC shows the file name instead. */
export function canPreview(fileName: string): 'image' | 'pdf' | 'none' {
  const ext = fileExtension(fileName);
  if (ext === '.pdf') return 'pdf';
  if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') return 'image';
  return 'none';
}

/** A row's receipt and invoice files (not quotes). */
export function receiptFiles(line: Pick<PurchaseLine, 'files'>): AttachedFile[] {
  return line.files.filter((f) => f.kind === 'receipt');
}

/** A row's quote files. */
export function quoteFiles(line: Pick<PurchaseLine, 'files'>): AttachedFile[] {
  return line.files.filter((f) => f.kind === 'quote');
}

/**
 * The row that holds the receipt for a row's vendor when the row has none of its own (P-049): the
 * vendor's first row, in row order, that holds a receipt file. One receipt covers every row of its
 * vendor in the request, the way one quote does. Vendors are matched as the vendor totals match them
 * (`vendorKey`); a row with no vendor name yet has no vendor to share with.
 */
export function vendorReceiptRow(line: PurchaseLine, lines: readonly PurchaseLine[]): PurchaseLine | undefined {
  const key = vendorKey(line.vendor);
  if (key === '') return undefined;
  return lines
    .filter((l) => l.id !== line.id && l.sameReceiptAsRow === null && vendorKey(l.vendor) === key && receiptFiles(l).length > 0)
    .sort((a, b) => a.rowNumber - b.rowNumber)[0];
}

/**
 * The row whose receipt files a row uses: the row it points to with "Same receipt as row N" (which can be
 * for a receipt that covers rows with different vendor names), otherwise itself when it holds a receipt,
 * otherwise the first row of the same vendor that does (P-049), otherwise itself. Returns undefined if a
 * pointer is broken.
 */
export function receiptSourceRow(line: PurchaseLine, lines: readonly PurchaseLine[]): PurchaseLine | undefined {
  if (line.sameReceiptAsRow !== null) {
    if (line.sameReceiptAsRow === line.rowNumber) return undefined;
    const target = lines.find((l) => l.rowNumber === line.sameReceiptAsRow);
    // Only one step is allowed: the target must hold its own files.
    if (!target || target.sameReceiptAsRow !== null) return undefined;
    return target;
  }
  if (receiptFiles(line).length > 0) return line;
  return vendorReceiptRow(line, lines) ?? line;
}

/** A row has a receipt if it holds a receipt or invoice file, shares one, or its vendor has one on another row (P-049). A quote never counts (P-021). */
export function hasReceipt(line: PurchaseLine, lines: readonly PurchaseLine[]): boolean {
  const source = receiptSourceRow(line, lines);
  return !!source && receiptFiles(source).length > 0;
}

export function hasQuote(line: Pick<PurchaseLine, 'files'>): boolean {
  return quoteFiles(line).length > 0;
}
