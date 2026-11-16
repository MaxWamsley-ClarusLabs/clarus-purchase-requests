// Builds the Ledger's rows from a request, its lines, the bookkeeper's entries and the request's submissions. Both
// data services use this, so the preview and the real site agree (P-052).

import { EMPTY_LEDGER_ENTRY, LedgerEntry, LedgerReceipt, LedgerRow, ReceiptPlace, inLedger, sortLedger } from './ledger';
import { fileNamesForRow } from './naming';
import { safeLink } from './purchaseRules';
import { PurchaseLine, PurchaseRequest, Submission } from './types';

export interface LedgerSource {
  request: PurchaseRequest;
  /** Every line of the request. */
  lines: readonly PurchaseLine[];
  /** What the bookkeepers have set, by line ID. A line with no entry has not been touched. */
  entries: ReadonlyMap<string, LedgerEntry>;
  /** The request's submissions, any order. */
  submissions: readonly Submission[];
}

/**
 * Where the receipt copies of the newest package that has an address are, and what kind of place that is. The address is
 * written by the flow, but anyone who can edit the submission item could change it, so only a plain web address is
 * ever used (`safeLink`). A package from before the archive existed links to its request folder instead (P-058).
 */
export function receiptBase(submissions: readonly Submission[]): { base: string; place: ReceiptPlace } {
  const packages = submissions.filter((s) => s.type === 'package').sort((a, b) => b.submissionNumber - a.submissionNumber);
  for (const s of packages) {
    const archive = safeLink(s.archiveLink ?? '');
    if (archive) return { base: archive.replace(/\/+$/, ''), place: 'archive' };
    const folder = safeLink(s.folderLink);
    if (folder) return { base: folder.replace(/\/+$/, ''), place: 'request folder' };
  }
  return { base: '', place: 'none' };
}

/** The rows of one request: none unless it has been bought and packaged. */
export function ledgerRowsOf(source: LedgerSource): LedgerRow[] {
  const { request, lines } = source;
  if (!inLedger(request.status)) return [];
  const newest = source.submissions.filter((s) => s.type === 'package').sort((a, b) => b.submissionNumber - a.submissionNumber)[0];
  const { base, place } = receiptBase(source.submissions);
  return [...lines]
    .sort((a, b) => a.rowNumber - b.rowNumber)
    .map((line): LedgerRow => {
      const receipts: LedgerReceipt[] = fileNamesForRow(line, lines, 'receipt').map((fileName) => ({
        fileName,
        url: base ? `${base}/${encodeURIComponent(fileName)}` : ''
      }));
      return {
        line,
        entry: source.entries.get(line.id) ?? { ...EMPTY_LEDGER_ENTRY },
        requestNumber: request.requestNumber,
        requestStatus: request.status,
        buyer: request.buyer,
        ownerName: request.ownerName,
        businessPurpose: request.businessPurpose,
        department: request.department,
        projectCode: request.projectCode,
        approvedBy: request.approvedBy,
        approvedOn: request.approvedOn,
        submissionNumber: newest ? newest.submissionNumber : 1,
        submitterName: newest ? newest.submitterName : '',
        submittedOn: newest ? newest.submittedOn : request.submittedOn,
        receipts,
        receiptPlace: receipts.length > 0 ? place : 'none'
      };
    });
}

/** The rows of many requests, in the order bookkeepers work down the page. */
export function ledgerRowsOfAll(sources: readonly LedgerSource[]): LedgerRow[] {
  return sortLedger(sources.flatMap(ledgerRowsOf));
}
