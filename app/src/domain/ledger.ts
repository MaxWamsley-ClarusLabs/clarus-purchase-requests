// The Ledger's data shapes and rules (P-052 to P-057). A ledger row is one purchase line of a request that has been
// bought and packaged, with what the bookkeeper adds: the QuickBooks account, the class, and whether the line has
// been posted to QuickBooks. These are stored as columns on the line itself (P-054); nothing here reads or writes
// data. Wording is in messages.ts; the lists and the class rule are in purchaseRules.ts.

import { messages } from './messages';
import { LEDGER_ACCOUNTS, LEDGER_CLASSES, CLASS_REQUIRED, defaultLedgerAccount, findPaidBy } from './purchaseRules';
import { BuyerId, PurchaseLine, RequestStatus } from './types';

/** What the bookkeeper sets on a line. Account and class are stored as the exact QuickBooks text. */
export interface LedgerEntry {
  /** "6182 R&D Materials & Supplies", or '' while none is chosen (the line's category account is then the starting point). */
  account: string;
  /** "1.0 Grants:1.01 NSF Phase 1 SBIR", or '' while none is chosen. */
  className: string;
  posted: boolean;
  /** Who posted it, and when ("YYYY-MM-DD HH:MM"); '' while not posted. */
  postedBy: string;
  postedOn: string;
}

export const EMPTY_LEDGER_ENTRY: LedgerEntry = { account: '', className: '', posted: false, postedBy: '', postedOn: '' };

/** A receipt file of a line, with the address to open it, or '' when that is not known yet. */
export interface LedgerReceipt {
  fileName: string;
  url: string;
}

/** Where a line's receipt links point: the permanent archive, the request folder in Purchases_To_Process, or nowhere yet. */
export type ReceiptPlace = 'archive' | 'request folder' | 'none';

export interface LedgerRow {
  line: PurchaseLine;
  entry: LedgerEntry;
  requestNumber: string;
  requestStatus: RequestStatus;
  buyer: BuyerId;
  ownerName: string;
  businessPurpose: string;
  department: string;
  projectCode: string;
  approvedBy: string;
  approvedOn: string;
  /** The package this line was last sent in, and who sent it and when. */
  submissionNumber: number;
  submitterName: string;
  submittedOn: string;
  receipts: LedgerReceipt[];
  receiptPlace: ReceiptPlace;
}

/** The account a row shows now: the one chosen, otherwise its category's account (P-038), otherwise none. */
export function effectiveAccount(row: Pick<LedgerRow, 'entry' | 'line'>): string {
  return row.entry.account || defaultLedgerAccount(row.line.category);
}

export function isKnownAccount(text: string): boolean {
  return LEDGER_ACCOUNTS.some((a) => `${a.number} ${a.name}` === text);
}

export function isKnownClass(text: string): boolean {
  return LEDGER_CLASSES.some((c) => c.name === text);
}

/** "PR-0042 row 3", for a message about one line. */
export function lineLabel(row: Pick<LedgerRow, 'requestNumber' | 'line'>): string {
  return `${row.requestNumber} row ${row.line.rowNumber}`;
}

/** Whether the row's reimbursement applies: the company pays for everything the approver buys (P-037). */
export function ledgerPaidBy(row: Pick<LedgerRow, 'buyer' | 'line'>): { label: string; reimbursable: boolean } | undefined {
  const paid = findPaidBy(row.buyer === 'approver' ? 'company' : row.line.paidBy);
  return paid ? { label: paid.label, reimbursable: paid.reimbursable } : undefined;
}

/**
 * Why a row cannot be marked Posted, or '' when it can: it needs an account in the list, and a class in the list
 * because QuickBooks asks for one on every line (P-056). A row already Posted has nothing to check.
 */
export function postProblem(row: LedgerRow): string {
  if (row.entry.posted) return '';
  const what = lineLabel(row);
  const account = effectiveAccount(row);
  if (account === '') return messages.ledgerNeedsAccount(what);
  if (!isKnownAccount(account)) return messages.ledgerUnknownAccount(what);
  if (CLASS_REQUIRED && row.entry.className === '') return messages.ledgerNeedsClass(what);
  if (row.entry.className !== '' && !isKnownClass(row.entry.className)) return messages.ledgerUnknownClass(what);
  return '';
}

export interface LedgerEntryChanges {
  /** Pass the exact text of an account from the list, or '' to clear it. */
  account?: string;
  /** Pass the exact text of a class from the list, or '' to clear it. */
  className?: string;
}

/**
 * Why these changes to a row's account or class are refused, or '' when they are allowed: a Posted row is locked until
 * it is set back to Not posted, and only items from the lists can be chosen (so the ledger matches QuickBooks).
 */
export function entryChangeProblem(row: LedgerRow, changes: LedgerEntryChanges): string {
  if (row.entry.posted) return messages.ledgerPostedLocked(lineLabel(row));
  if (changes.account !== undefined && changes.account !== '' && !isKnownAccount(changes.account)) return messages.ledgerBadAccount;
  if (changes.className !== undefined && changes.className !== '' && !isKnownClass(changes.className)) return messages.ledgerBadClass;
  return '';
}

/** Whether a row belongs in the Ledger: its request has been bought and packaged (Submitted, or Processed after it). */
export function inLedger(status: RequestStatus): boolean {
  return status === 'Submitted' || status === 'Processed';
}

export type LedgerFilter = 'notPosted' | 'posted' | 'all';

/** Rows for a filter and a search. The search matches request number, vendor, description, account and class, every word of it. */
export function filterLedger(rows: readonly LedgerRow[], filter: LedgerFilter, search: string): LedgerRow[] {
  const words = search
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w !== '');
  return rows.filter((row) => {
    if (filter === 'notPosted' && row.entry.posted) return false;
    if (filter === 'posted' && !row.entry.posted) return false;
    if (words.length === 0) return true;
    const hay = [row.requestNumber, row.line.vendor, row.line.description, effectiveAccount(row), row.entry.className, row.ownerName].join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** Oldest purchase first within a request, requests newest first: the order bookkeepers work down the page. */
export function sortLedger(rows: readonly LedgerRow[]): LedgerRow[] {
  return [...rows].sort((a, b) => {
    if (a.requestNumber !== b.requestNumber) return b.requestNumber.localeCompare(a.requestNumber);
    return a.line.rowNumber - b.line.rowNumber;
  });
}
