// User-facing wording for rules and checks. Keeping it here means a wording
// change is made once (strategy section 10).

export const messages = {
  tripNameRequired: 'Enter a trip name.',
  destinationRequired: 'Enter the destination.',
  businessPurposeRequired: 'Say what the trip was for, in a sentence or two.',
  tripPurposeRequired: 'Choose what the trip was for. "Not sure" is fine.',
  tripStartRequired: 'Enter the trip start date.',
  tripEndRequired: 'Enter the trip end date.',
  tripEndBeforeStart: 'The trip end date is before the start date.',
  noRows: 'Add at least one expense.',

  dateRequired: 'Enter the date of the expense.',
  vendorRequired: 'Enter the vendor.',
  categoryRequired: 'Choose a category.',
  amountRequired: 'Enter an amount greater than zero, like 45.10.',
  paymentTypeRequired: 'Choose how it was paid.',
  descriptionRequiredForOther: 'Say what this was. A description is needed for "Other travel".',
  receiptOrReason: 'Attach a receipt, or give a reason there is none.',
  sameReceiptBroken: (row: number) => `Row ${row} has no receipt of its own to share. Choose a row that has a receipt.`,
  suggestionsNotConfirmed: (fields: string) => `Filled in by the app: ${fields}. Check against the receipt, then confirm or correct.`,

  lateSubmission: (days: number) => `Submitted ${days} days after the trip ended. The travel policy asks for reports within 30 days.`,
  mealsOverLimit: (date: string, total: string, limit: string) => `Meals on ${date} total ${total}, over the ${limit} daily meal limit.`,
  mealsProjectedOver: (date: string, total: string, count: number, projected: string, limit: string) =>
    `Meals on ${date}: ${total} for ${count === 1 ? 'one meal' : `${count} meals`}. At that rate, three meals would be about ${projected}, over the ${limit} daily meal limit.`,
  rateNotCurrent: 'The GSA rate for this date is not in the app yet, so the last known rate was used. The administrator will check it.',
  mileageNone: 'Add your drives, or turn off "I drove my own car" on Trip details.',
  mileageFromRequired: 'Enter where the drive started.',
  mileageToRequired: 'Enter where the drive ended.',
  mileageMilesRequired: 'Enter the miles, like 42 or 12.5.',
  mileageNoRate: (date: string) => `The app has no GSA mileage rate for ${date}. Tell the administrator.`,
  dateOutsideTrip: 'This date is outside the trip dates. Check it is right.',
  duplicateFileInReport: (row: number) => `Same receipt file as row ${row}. Check it is not entered twice.`,
  duplicateFileElsewhere: (report: string, row: number) => `Same receipt file as ${report} row ${row}. Check it is not entered twice.`,
  duplicateEntryInReport: (row: number) => `Same date, vendor and amount as row ${row}. Check it is not entered twice.`,
  duplicateEntryElsewhere: (report: string, row: number) => `Same date, vendor and amount as ${report} row ${row}. Check it is not entered twice.`,

  fileWrongType: (name: string) => `${name} is not a PDF, JPG, PNG or HEIC file, so it was not added.`,
  fileTooLarge: (name: string) => `${name} is larger than 15 MB, so it was not added. Try a smaller scan or photo.`,
  fileEmpty: (name: string) => `${name} is empty, so it was not added.`,
  receiptsRead: (rows: number) =>
    `Suggestions filled in on ${rows === 1 ? '1 row' : `${rows} rows`} from the receipts. Check the highlighted values, then confirm each row.`,
  readerUnavailable: 'Receipt suggestions could not start in this browser. Fill in the rows as usual.',

  startFailed: 'Purchase Requests could not start. Refresh the page. If it keeps happening, tell the administrator.',
  loadFailed: 'This could not be loaded. Refresh the page. If it keeps happening, tell the administrator.',
  actionFailed: (detail: string) => `That did not work. ${detail} Try again. If it keeps happening, tell the administrator.`,

  /**
   * The employee's certification at Submit (D-064), from the Travel
   * Reimbursement Policy (P3), Appendix A, part c, without "By signing below,".
   * Changing this text changes what employees certify: record it in DECISIONS.
   */
  certification:
    "I certify that these expenses were incurred for official business purposes, are in compliance with the company's travel policy, and that the information provided is accurate.",
  certificationRequired: 'Tick the certification to submit.',
  // SharePoint problems, shown inside actionFailed (D-060).
  spForbidden: 'You do not have permission for this.',
  spNotFound: 'It could not be found; it may have been deleted. Refresh the page.',
  spConflict: 'Someone else changed it at the same time. Refresh the page.',
  spBusy: 'SharePoint is busy. Wait a minute.',
  spOffline: 'SharePoint could not be reached. Check your connection.',
  spOther: (status: number) => `SharePoint returned error ${status}.`,
  flowNeedsLists: 'Create the lists first (step 1).',
  flowLibraryMissing: (path: string) => `The folder ${path} could not be found, or you do not have access to it.`,
  ratesOutdated: (names: string) =>
    `The GSA rates in the app have run out (${names}). Ask Claude to add the new rates, then upload the new app package. Until then the last known rate is used.`,
  notSetUp: 'Purchase Requests is not set up on this site yet. An administrator needs to open Set-up in the app.',

  submitConfirm: 'After you submit, the report is locked. It can only be changed if an administrator returns it to you.',
  saved: 'Saved',
  saving: 'Saving'
} as const;
