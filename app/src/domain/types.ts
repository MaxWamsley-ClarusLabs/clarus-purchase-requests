// Core data shapes shared by the domain rules, the data layer and the screens.
// Field meanings follow docs/DATA_MODEL.md.

/** A calendar date in the form YYYY-MM-DD, or '' when not yet entered (D-043). */
export type IsoDate = string;

export type ReportStatus = 'Draft' | 'Submitted' | 'Returned' | 'Processed';
export type PackageStatus = 'Uploading' | 'Ready' | 'Processing' | 'Packaged' | 'Failed';

export type CategoryId = 'airfare' | 'lodging' | 'meals' | 'businessMeal' | 'transportation' | 'registration' | 'otherTravel';

export type PaymentTypeId = 'personal' | 'companyCard' | 'paidByClarus';

/**
 * A row value the app filled in from the receipt or from vendor memory, which
 * the employee has not yet confirmed or changed (D-074, D-078).
 */
export type SuggestedField = 'date' | 'vendor' | 'category' | 'amount' | 'paymentType';

export type TripPurposeId = 'nsfPhase1' | 'xCompetition' | 'commercial' | 'internalRnd' | 'generalBusiness' | 'notSure';

export interface ReceiptFile {
  id: string;
  fileName: string;
  sizeBytes: number;
  /** SHA-256 of the file content, hex encoded. Used for duplicate checks. */
  fingerprint: string;
  contentType: string;
  /** Where the screens can load the file for preview. */
  url?: string;
}

export interface ExpenseLine {
  id: string;
  reportId: number;
  rowNumber: number;
  date: IsoDate;
  vendor: string;
  category: CategoryId | '';
  description: string;
  /** Whole cents; null when not yet entered or not a valid amount. */
  amountCents: number | null;
  paymentType: PaymentTypeId | '';
  noReceiptReason: string;
  /** Row number of another row in the same report whose receipt this row uses. */
  sameReceiptAsRow: number | null;
  receipts: ReceiptFile[];
  /** Values suggested by the app and not yet confirmed; submitting waits until this is empty (D-078). */
  suggested: SuggestedField[];
}

/** A drive in the employee's own car (D-071). Paid at the GSA rate for its date. */
export interface MileageTrip {
  id: string;
  date: IsoDate;
  from: string;
  to: string;
  /** Miles driven, up to one decimal place; null when not yet entered. */
  miles: number | null;
}

export interface TravelReport {
  id: number;
  reportNumber: string;
  tripName: string;
  destination: string;
  businessPurpose: string;
  tripPurpose: TripPurposeId | '';
  tripStart: IsoDate;
  tripEnd: IsoDate;
  /** The "I drove my own car" switch (D-071). Off by default. */
  hasMileage: boolean;
  mileageTrips: MileageTrip[];
  status: ReportStatus;
  returnNote: string;
  ownerName: string;
  ownerEmail: string;
  submissionCount: number;
  /** Totals kept on the report so lists can show them (DATA_MODEL.md). */
  totalReimburseCents: number;
  totalCompanyCents: number;
  totalTripCents: number;
  submittedOn: string;
  processedOn: string;
  processedBy: string;
  lastChanged: string;
}

export interface Submission {
  id: number;
  reportId: number;
  reportNumber: string;
  submissionNumber: number;
  packageStatus: PackageStatus;
  folderName: string;
  previousFolderName: string;
  submitterName: string;
  /** The submitting account (D-064). The item's Created By is the lasting record. */
  submitterEmail: string;
  submittedOn: string;
  /** The certification sentence the employee ticked at Submit (D-064). */
  certificationText: string;
  tripName: string;
  destination: string;
  tripStart: IsoDate;
  tripEnd: IsoDate;
  tripPurpose: string;
  suggestedClass: string;
  totalReimburseCents: number;
  totalCompanyCents: number;
  totalTripCents: number;
  receiptCount: number;
  rowsWithoutReceipt: number;
  emailSubject: string;
  emailSummary: string;
  folderLink: string;
  packagedAt: string;
  errorMessage: string;
  /** Names of the files attached for the flow to copy. */
  packageFileNames: string[];
}

export interface CurrentUser {
  displayName: string;
  email: string;
  isAdministrator: boolean;
}
