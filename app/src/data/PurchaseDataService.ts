// The only way the screens read or change data. The preview and tests use the
// in-memory MockDataService; the web part uses SharePointDataService. Nothing
// else in the app talks to SharePoint (CLAUDE.md, travel strategy section 10).
//
// Who may call what (P-020): employee methods need the request to be the
// signed-in person's own and editable; approver and administrator methods need
// SharePoint's "Manage web site" permission (site Owners, travel D-066).

import { LineRef } from '../domain/duplicates';
import { AttachedFile, CategoryId, CurrentUser, FileKind, PurchaseLine, PurchaseRequest, Submission } from '../domain/types';
import { FlowConfig, FlowMode } from '../export/flowPackage';
import { SetupStatus } from './setup';

export type RequestChanges = Partial<Pick<PurchaseRequest, 'businessPurpose' | 'department' | 'projectCode'>>;

export type LineChanges = Partial<
  Pick<
    PurchaseLine,
    | 'date'
    | 'vendor'
    | 'description'
    | 'category'
    | 'categoryOther'
    | 'amountCents'
    | 'paidBy'
    | 'noQuoteReason'
    | 'noReceiptReason'
    | 'sameReceiptAsRow'
    | 'suggested'
  >
>;

export interface RequestWithLines {
  request: PurchaseRequest;
  lines: PurchaseLine[];
}

/** A category chosen by the approver or administrator for one line (P-012, P-024). */
export interface CategoryChoice {
  category: CategoryId;
  /** The description when the category is Other; '' otherwise. */
  categoryOther: string;
}

export interface ApproveOptions {
  /** The approver's optional note, shown to the employee and in the submission email. */
  note: string;
  /** Categories the approver changed, by line ID. Approving confirms every line's category as shown. */
  categories: Record<string, CategoryChoice>;
}

export interface PurchaseDataService {
  getCurrentUser(): Promise<CurrentUser>;

  /** Whether the site's lists are ready (travel D-063). */
  getSetupStatus(): Promise<SetupStatus>;
  /** Creates or completes the lists. Administrators only. */
  runSetup(progress: (step: string) => void): Promise<SetupStatus>;
  /**
   * An address the browser can show a file from. For SharePoint the file is
   * loaded by the app first, so the site's download settings cannot block the
   * preview. Release it with URL.revokeObjectURL when done, if it starts "blob:".
   */
  filePreviewUrl(lineId: string, file: AttachedFile): Promise<string>;
  /**
   * What the flow package needs from this site (travel D-047, P-018): the
   * Purchase Submissions list, the destination library, the administrator's
   * email and the approvers' emails (the site Owners). Administrators only.
   */
  getFlowSettings(mode: FlowMode, appPageUrl: string): Promise<FlowConfig>;
  /**
   * The names of the people who approve: the site Owners (P-020). Empty when
   * this person cannot read the Owners group (Unverified, strategy section
   * 17); the screens then say "the site Owners".
   */
  listApprovers(): Promise<string[]>;

  // Employee
  listMyRequests(): Promise<PurchaseRequest[]>;
  getRequest(requestId: number): Promise<RequestWithLines>;
  /** Creates a Draft. The department is filled in from the employee's latest request (P-022). */
  createRequest(): Promise<PurchaseRequest>;
  updateRequest(requestId: number, changes: RequestChanges): Promise<PurchaseRequest>;
  deleteRequest(requestId: number): Promise<void>;
  /** One new row per file; every file is of `kind` (P-021). Files that fail the file checks are skipped. */
  addLinesFromFiles(requestId: number, files: File[], kind: FileKind): Promise<PurchaseLine[]>;
  addEmptyLine(requestId: number): Promise<PurchaseLine>;
  updateLine(lineId: string, changes: LineChanges): Promise<PurchaseLine>;
  deleteLine(lineId: string): Promise<void>;
  addFileToLine(lineId: string, file: File, kind: FileKind): Promise<PurchaseLine>;
  removeFileFromLine(lineId: string, fileId: string): Promise<PurchaseLine>;
  /** Rows of the owner's other requests, for duplicate warnings. */
  getOwnerOtherLines(requestId: number): Promise<LineRef[]>;
  /**
   * Sends a request with a vendor total at or over the threshold to the
   * approver (P-005, P-018): records the approval request, sets the status to
   * Awaiting approval, and notes whether a purchase looks already bought
   * (P-017). Throws SubmissionBlockedError if something must be fixed first.
   */
  sendForApproval(requestId: number): Promise<Submission>;
  /**
   * Submits with the certification the employee ticked (P-010). Throws
   * ApprovalRequiredError while approval is still to come, and
   * SubmissionBlockedError if something must be fixed first.
   */
  submitRequest(requestId: number, certificationText: string): Promise<Submission>;
  /** Approval requests and packages for a request, newest first within each type. */
  listSubmissionsForRequest(requestId: number): Promise<Submission[]>;
  /** The CSV attached to a package submission, for the administrator to preview. */
  getSubmissionCsv(submissionId: number): Promise<string>;

  // Approver and administrator
  listAllRequests(): Promise<PurchaseRequest[]>;
  listSubmissions(): Promise<Submission[]>;
  listAllLineRefs(): Promise<LineRef[]>;
  /**
   * Approves a request that is Awaiting approval: records the approved vendor
   * totals, the approver and the time, confirms every line's category (with
   * the changes given), and sets the status to Approved (P-006, P-019).
   */
  approveRequest(requestId: number, options: ApproveOptions): Promise<PurchaseRequest>;
  /** Returns a request that is Awaiting approval or Submitted, with a note (P-006). */
  returnRequest(requestId: number, note: string): Promise<PurchaseRequest>;
  /**
   * Confirms the categories of a request that is Awaiting approval, Approved
   * or Submitted, changing those given (P-012, P-024). The CSV already in a
   * folder keeps the category as submitted.
   */
  confirmCategories(requestId: number, changes: Record<string, CategoryChoice>): Promise<PurchaseLine[]>;
  markProcessed(requestId: number): Promise<PurchaseRequest>;
  /** Sets a failed or stuck submission, of either type, back to Ready. */
  retryPackaging(submissionId: number): Promise<Submission>;
}
