// Core data shapes shared by the domain rules, the data layer and the screens.
// Field meanings follow docs/DATA_MODEL.md.

/** A calendar date in the form YYYY-MM-DD, or '' when not yet entered (travel D-043). */
export type IsoDate = string;

/** Longest text a one-line field holds (a SharePoint single-line text column). */
export const TEXT_MAX_LENGTH = 255;

/**
 * Where a request is (docs/STRATEGY.md section 5). A request with no vendor
 * total of $500 or more goes Draft, Submitted, Processed; one with a vendor
 * total at or over the threshold goes Draft, Awaiting approval, Approved,
 * Submitted, Processed. Returned can come from the approver or the administrator.
 */
export type RequestStatus = 'Draft' | 'Awaiting approval' | 'Approved' | 'Submitted' | 'Returned' | 'Processed';
export type PackageStatus = 'Uploading' | 'Ready' | 'Processing' | 'Packaged' | 'Failed';

/** An approval request only emails the approvers; a package creates the request folder (P-018). */
export type SubmissionType = 'approval' | 'package';

/** Which step a return came at, for wording only. */
export type ReturnStage = 'approval' | 'processing' | '';

export type CategoryId = 'rdMaterials' | 'advertising' | 'computer' | 'office' | 'training' | 'shipping' | 'insurance' | 'other';

export type PaidById = 'company' | 'employee';

/** An attached file is a receipt (which includes an invoice) or a quote (P-021). */
export type FileKind = 'receipt' | 'quote';

/**
 * A row value the app filled in from a receipt or from vendor memory, which
 * the employee has not yet confirmed or changed (travel D-074, D-078).
 */
export type SuggestedField = 'date' | 'vendor' | 'category' | 'amount' | 'paidBy';

export interface AttachedFile {
  id: string;
  fileName: string;
  sizeBytes: number;
  /** SHA-256 of the file content, hex encoded. Used for duplicate checks. */
  fingerprint: string;
  contentType: string;
  kind: FileKind;
  /** Where the screens can load the file for preview. */
  url?: string;
}

export interface PurchaseLine {
  id: string;
  requestId: number;
  rowNumber: number;
  date: IsoDate;
  vendor: string;
  /** What was bought and why. */
  description: string;
  category: CategoryId | '';
  /** What kind of expense it is, when the category is Other (the form's "Other: ____"). */
  categoryOther: string;
  /** The approver or administrator who confirmed or changed the category; '' while it is only the employee's suggestion. */
  categoryConfirmedBy: string;
  /** Whole cents; null when not yet entered or not a valid amount. */
  amountCents: number | null;
  paidBy: PaidById | '';
  noQuoteReason: string;
  noReceiptReason: string;
  /** Row number of another row in the same request whose receipt this row uses. */
  sameReceiptAsRow: number | null;
  /** Every attached file, receipts and quotes (P-021). */
  files: AttachedFile[];
  /** Values suggested by the app and not yet confirmed; submitting waits until this is empty. */
  suggested: SuggestedField[];
}

/** One vendor's total in a request, as recorded when it is sent for approval or approved (P-016, P-019). */
export interface ApprovalGroup {
  /** The vendor matching key (`vendorKey`), or `line:<id>` for a line with no vendor yet. */
  key: string;
  vendor: string;
  cents: number;
  /** Already bought when it was sent for approval (P-017). */
  bought: boolean;
}

/** Stored as JSON on the request (docs/DATA_MODEL.md). Read back defensively. */
export interface ApprovalRecord {
  /** The vendor totals of $500 or more when the request was last sent for approval. */
  sent: ApprovalGroup[];
  /** The vendor totals the approver approved; empty until approved, and cleared by a return. */
  approved: ApprovalGroup[];
}

export interface PurchaseRequest {
  id: number;
  requestNumber: string;
  /** One line. Also the request's name (P-022). */
  businessPurpose: string;
  department: string;
  projectCode: string;
  status: RequestStatus;
  returnNote: string;
  returnStage: ReturnStage;
  ownerName: string;
  ownerEmail: string;
  /** Processing packages submitted so far. */
  submissionCount: number;
  /** Times the request has been sent for approval. */
  approvalRounds: number;
  /** Totals kept on the request so lists can show them (DATA_MODEL.md). */
  totalReimburseCents: number;
  totalCompanyCents: number;
  totalRequestCents: number;
  sentForApprovalOn: string;
  boughtBeforeApproval: boolean;
  approval: ApprovalRecord;
  approvalNote: string;
  approvedOn: string;
  approvedBy: string;
  approvedByEmail: string;
  submittedOn: string;
  processedOn: string;
  processedBy: string;
  lastChanged: string;
}

export interface Submission {
  id: number;
  requestId: number;
  requestNumber: string;
  type: SubmissionType;
  /** For a package: 1, 2 after a return. For an approval request: the round. */
  submissionNumber: number;
  packageStatus: PackageStatus;
  folderName: string;
  previousFolderName: string;
  submitterName: string;
  /** The submitting account (travel D-064). The item's Created By is the lasting record. */
  submitterEmail: string;
  submittedOn: string;
  /** The certification sentence the employee ticked at Submit; '' for an approval request. */
  certificationText: string;
  businessPurpose: string;
  department: string;
  projectCode: string;
  /** "2026-10-12 to 2026-10-14", or one date. */
  purchaseDates: string;
  totalReimburseCents: number;
  totalCompanyCents: number;
  totalRequestCents: number;
  receiptCount: number;
  quoteCount: number;
  rowsWithoutReceipt: number;
  boughtBeforeApproval: boolean;
  /** Packages only: the approver's name and time, frozen at submission; '' when no approval was needed. */
  approvedBy: string;
  approvedOn: string;
  emailSubject: string;
  emailSummary: string;
  folderLink: string;
  packagedAt: string;
  errorMessage: string;
  /** Names of the files attached for the flow to copy. */
  packageFileNames: string[];
}

/**
 * The signed-in person. Approvers and administrators are the same people for
 * now: those with SharePoint's "Manage web site" permission, which site
 * Owners have (P-020, travel D-066).
 */
export interface CurrentUser {
  displayName: string;
  email: string;
  isAdministrator: boolean;
}
