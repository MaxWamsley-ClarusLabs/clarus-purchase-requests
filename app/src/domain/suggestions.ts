// Receipt suggestions and vendor memory (travel D-074, D-078; carried over).
// Reading a receipt fills in only empty fields, and only when a row has an
// empty date, amount or vendor; anything the employee typed is never changed
// or compared. Values the app fills in from the receipt, and a "Who paid"
// changed by vendor memory, are marked Suggested until the employee edits them
// or confirms the row. A row with unconfirmed suggestions cannot be submitted.
// Only receipt files are read; quotes are typed (P-021).

import { knownVendorName, suggestCategoryForVendor, suggestPaidByForVendor } from './defaults';
import { ReceiptGuess } from './receiptText';
import { IsoDate, PurchaseLine, SuggestedField, TEXT_MAX_LENGTH } from './types';

/** In the order the grid shows them. */
export const SUGGESTED_FIELDS: readonly SuggestedField[] = ['date', 'vendor', 'category', 'amount', 'paidBy'];

const LABELS: Record<SuggestedField, string> = {
  date: 'date',
  vendor: 'vendor',
  category: 'category',
  amount: 'amount',
  paidBy: 'who paid'
};

/** "date, vendor and amount" */
export function suggestedFieldsText(fields: readonly SuggestedField[]): string {
  const names = SUGGESTED_FIELDS.filter((f) => fields.includes(f)).map((f) => LABELS[f]);
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export type SuggestionChanges = Partial<Pick<PurchaseLine, 'date' | 'vendor' | 'category' | 'amountCents' | 'paidBy' | 'suggested'>>;

type RowValues = Pick<PurchaseLine, 'date' | 'vendor' | 'category' | 'amountCents' | 'paidBy' | 'sameReceiptAsRow' | 'suggested'>;

const ordered = (marks: ReadonlySet<SuggestedField>): SuggestedField[] => SUGGESTED_FIELDS.filter((f) => marks.has(f));

/**
 * Whether to read a row's receipt: only if it could fill something, that is
 * the date, amount or vendor is empty (travel D-078). A row that uses another
 * row's receipt is not read.
 */
export function shouldReadReceipt(line: RowValues): boolean {
  return line.sameReceiptAsRow === null && (!line.date || line.amountCents === null || !line.vendor.trim());
}

/**
 * Vendor memory for a vendor just filled in, typed or read (travel D-074): the
 * employee's last category for it if the row has none, and their last "Who
 * paid" if it differs and they have not chosen "Who paid" on this row. A
 * changed "Who paid" is always marked Suggested, because it replaces a value
 * and decides who is reimbursed. The category is marked when the vendor itself
 * came from the receipt; after a typed vendor it fills in unmarked (travel D-057).
 */
export function vendorMemoryChanges(
  vendor: string,
  line: RowValues,
  history: readonly PurchaseLine[],
  options: { paidByChosen: boolean; vendorSuggested: boolean }
): SuggestionChanges {
  const changes: SuggestionChanges = {};
  const marks = new Set(line.suggested);
  if (!line.category) {
    const category = suggestCategoryForVendor(vendor, history);
    if (category) {
      changes.category = category;
      if (options.vendorSuggested) marks.add('category');
    }
  }
  if (!options.paidByChosen) {
    const paid = suggestPaidByForVendor(vendor, history);
    if (paid && paid !== line.paidBy) {
      changes.paidBy = paid;
      marks.add('paidBy');
    }
  }
  if (marks.size !== line.suggested.length) changes.suggested = ordered(marks);
  return changes;
}

/**
 * What reading a receipt changes on its row: each empty field the receipt
 * answers, marked Suggested, plus vendor memory for a vendor it found. A date
 * after `today` is ignored, since receipts are not dated in the future. A
 * vendor the employee used before keeps their own spelling. Returns null when
 * nothing changes.
 */
export function readingChanges(
  line: RowValues,
  guess: ReceiptGuess,
  history: readonly PurchaseLine[],
  today: IsoDate,
  paidByChosen: boolean
): SuggestionChanges | null {
  let changes: SuggestionChanges = {};
  let marks = new Set(line.suggested);
  if (!line.date && guess.date && guess.date <= today) {
    changes.date = guess.date;
    marks.add('date');
  }
  if (line.amountCents === null && guess.amountCents !== null && guess.amountCents > 0) {
    changes.amountCents = guess.amountCents;
    marks.add('amount');
  }
  if (!line.vendor.trim() && guess.vendor.trim()) {
    const vendor = (knownVendorName(guess.vendor, history) ?? guess.vendor.trim()).slice(0, TEXT_MAX_LENGTH);
    changes.vendor = vendor;
    marks.add('vendor');
    const memory = vendorMemoryChanges(vendor, { ...line, suggested: ordered(marks) }, history, { paidByChosen, vendorSuggested: true });
    if (memory.suggested) marks = new Set(memory.suggested);
    changes = { ...changes, ...memory };
  }
  if (Object.keys(changes).length === 0) return null;
  return { ...changes, suggested: ordered(marks) };
}

const FIELD_FOR_CHANGE: Record<string, SuggestedField | undefined> = {
  date: 'date',
  vendor: 'vendor',
  category: 'category',
  amountCents: 'amount',
  paidBy: 'paidBy'
};

/**
 * The marks left after the employee changes some of a row's fields: a value
 * the employee edited is their own. Undefined when no mark goes.
 */
export function marksAfterEdit(line: Pick<PurchaseLine, 'suggested'>, changedKeys: readonly string[]): SuggestedField[] | undefined {
  const edited = changedKeys.map((k) => FIELD_FOR_CHANGE[k]).filter((f): f is SuggestedField => !!f);
  const left = line.suggested.filter((f) => !edited.includes(f));
  return left.length === line.suggested.length ? undefined : left;
}
