// User-facing wording for rules and checks. Keeping it here means a wording
// change is made once (travel strategy section 10). The policy numbers come
// from purchaseRules.ts; the certification sentence is CERTIFICATION there.

import { FIRST_YEAR, LAST_YEAR } from './dates';
import { MAX_AMOUNT_CENTS, formatCents } from './money';
import { APPROVAL_THRESHOLD_TEXT, OVERRUN_TOLERANCE_PERCENT, QUOTE_THRESHOLD_TEXT } from './purchaseRules';

const thisVendor = (vendor: string): string => (vendor.trim() ? vendor.trim() : 'A purchase with no vendor yet');

export const messages = {
  businessPurposeRequired: 'Say what the purchases are for, in one line.',
  departmentRequired: 'Enter your department.',
  noRows: 'Add at least one purchase.',

  dateRequired: 'Enter the purchase date.',
  dateInvalid: `Enter a date between ${FIRST_YEAR} and ${LAST_YEAR}, like 2026-10-14.`,
  vendorRequired: 'Enter the vendor.',
  descriptionRequired: 'Say what was bought and why.',
  categoryRequired: 'Choose a category.',
  categoryOtherRequired: 'Describe the category, for "Other".',
  /** For an amount that is empty, or typed in a way that is not an amount (a decimal comma, three decimals, too large: P-035). */
  amountRequired: `Enter an amount like 45.10: digits, at most two decimals, up to ${formatCents(MAX_AMOUNT_CENTS)}.`,
  amountNotPositive: 'Enter an amount greater than zero, like 45.10.',
  paidByRequired: 'Choose who paid.',
  receiptOrReason: 'Attach a receipt or invoice, or give a reason there is none.',
  sameReceiptBroken: (row: number) => `Row ${row} has no receipt of its own to share. Choose a row that has a receipt.`,
  suggestionsNotConfirmed: (fields: string) => `Filled in by the app: ${fields}. Check against the receipt, then confirm or correct.`,

  // Approval and quotes (P-005, P-015, P-017, P-019)
  quoteOrReason: (vendor: string, total: string) =>
    `${thisVendor(vendor)} totals ${total}, which is ${QUOTE_THRESHOLD_TEXT} or more. Attach a quote, or say why there is none.`,
  boughtBeforeWarning: (vendor: string, total: string) =>
    `${thisVendor(vendor)} totals ${total} and looks already bought (dated before today, or a receipt is attached). It can still be sent for approval, flagged Bought before approval.`,
  /** For a vendor total flagged in an earlier round when nothing in it looks bought now: the flag stays (P-017). */
  boughtBeforeEarlierWarning: (vendor: string, total: string) =>
    `${thisVendor(vendor)} totals ${total} and was flagged as bought before approval when it was sent before. It can still be sent for approval.`,
  vendorNeedsApproval: (vendor: string, total: string) =>
    `${thisVendor(vendor)} totals ${total}, which is ${APPROVAL_THRESHOLD_TEXT} or more, so it needs approval before you buy.`,
  changedSinceApproval: (vendor: string, total: string, approved: string) =>
    `${thisVendor(vendor)} now totals ${total}, above the ${approved} that was approved (up to ${OVERRUN_TOLERANCE_PERCENT}% more is allowed). Send the request for approval again.`,
  notApproved: (vendor: string, total: string) =>
    `${thisVendor(vendor)} totals ${total} and was not part of the approval. Send the request for approval again.`,
  approvalRequiredToSubmit: 'This request needs approval first. Send it for approval, then submit it once it is approved.',
  approvalNotNeeded: 'Every vendor total is under the approval threshold, so this request does not need approval. Submit it instead.',
  alreadyWithApprover: 'This request is already with the approver.',
  alreadyApproved: 'This request is approved, and every vendor total is still within what was approved. Submit it instead.',

  duplicateFileInRequest: (row: number) => `Same receipt file as row ${row}. Check it is not entered twice.`,
  duplicateFileElsewhere: (request: string, row: number) => `Same receipt file as ${request} row ${row}. Check it is not entered twice.`,
  duplicateEntryInRequest: (row: number) => `Same date, vendor and amount as row ${row}. Check it is not entered twice.`,
  duplicateEntryElsewhere: (request: string, row: number) => `Same date, vendor and amount as ${request} row ${row}. Check it is not entered twice.`,

  fileWrongType: (name: string) => `${name} is not a PDF, JPG, PNG or HEIC file, so it was not added.`,
  fileTooLarge: (name: string) => `${name} is larger than 15 MB, so it was not added. Try a smaller scan or photo.`,
  fileEmpty: (name: string) => `${name} is empty, so it was not added.`,
  receiptsRead: (rows: number) =>
    `Suggestions filled in on ${rows === 1 ? '1 row' : `${rows} rows`} from the receipts. Check the highlighted values, then confirm each row.`,
  readerUnavailable: 'Receipt suggestions could not start in this browser. Fill in the rows as usual.',

  startFailed: 'Purchase Requests could not start. Refresh the page. If it keeps happening, tell the administrator.',
  loadFailed: 'This could not be loaded. Refresh the page. If it keeps happening, tell the administrator.',
  actionFailed: (detail: string) => `That did not work. ${detail} Try again. If it keeps happening, tell the administrator.`,

  certificationRequired: 'Tick the certification to submit.',
  // SharePoint problems, shown inside actionFailed (travel D-060).
  spForbidden: 'You do not have permission for this.',
  spNotFound: 'It could not be found; it may have been deleted. Refresh the page.',
  spConflict: 'Someone else changed it at the same time. Refresh the page.',
  spBusy: 'SharePoint is busy. Wait a minute.',
  spOffline: 'SharePoint could not be reached. Check your connection.',
  spOther: (status: number) => `SharePoint returned error ${status}.`,
  flowNeedsLists: 'Create the lists first (step 1).',
  flowLibraryMissing: (path: string) => `The folder ${path} could not be found, or you do not have access to it.`,
  notSetUp: 'Purchase Requests is not set up on this site yet. An administrator needs to open Set-up in the app.',

  submitConfirm: 'After you submit, the request is locked. It can only be changed if an administrator returns it to you.',
  sendConfirm: 'After you send it, the request is locked while the approver decides. The approver can approve it or return it to you with a note.',
  saved: 'Saved',
  saving: 'Saving'
} as const;
