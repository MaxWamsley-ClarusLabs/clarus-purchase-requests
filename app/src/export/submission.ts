// Everything the app prepares when a request is sent for approval or submitted
// (strategy section 5): the folder name, the CSV, the file copies to attach,
// the email text and the frozen copy of the request details and totals. When
// the approver buys (P-037), the employee certifies when sending the request,
// and the approver's "Mark purchased" prepares the same package as a submit.

import { dateRange, dateRangeText, toIsoDate, toLocalDateTime } from '../domain/dates';
import { LineRef } from '../domain/duplicates';
import { messages } from '../domain/messages';
import { csvFileName, folderName, packageFiles, PackageFile } from '../domain/naming';
import { hasReceipt, quoteFiles } from '../domain/receipts';
import { CERTIFICATION, anyBoughtBefore, mustSendForApproval, sentRowsOf } from '../domain/purchaseRules';
import { computeTotals } from '../domain/totals';
import { ApprovalGroup, PurchaseLine, PurchaseRequest, SentRow, Submission } from '../domain/types';
import { Issue, approvalGroupsToSend, approvalStateOf, blockingIssues, validateRequest } from '../domain/validation';
import { buildPurchasesCsv } from './csv';
import { approvalEmailSubject, buildApprovalEmailSummary, buildSubmissionEmailSummary, submissionEmailSubject } from './email';

/** The part of a submission item the app writes; the flow completes the rest. */
export type SubmissionFields = Omit<Submission, 'id' | 'packageStatus' | 'folderLink' | 'packagedAt' | 'errorMessage'>;

export interface PreparedSubmission {
  submission: SubmissionFields;
  csvName: string;
  csvContent: string;
  files: PackageFile[];
  warnings: Issue[];
}

/**
 * What the employee confirmed (travel D-064): at Submit when the employee buys,
 * when sending the request to the approver when the approver buys (P-037).
 */
export interface Certification {
  /** The sentence shown with the tick box; must be the current wording. */
  text: string;
  /** The signed-in account that ticked it. */
  email: string;
  /** Who ticked it; the request's owner when absent. */
  name?: string;
  /** When it was ticked, "YYYY-MM-DD HH:MM"; the time of the submission when absent. */
  on?: string;
}

/** Who submits the package: the request's owner when the employee buys, the approver who bought it otherwise (P-037). */
export interface Submitter {
  name: string;
  email: string;
}

export class SubmissionBlockedError extends Error {
  constructor(public readonly issues: Issue[]) {
    super(`The request has ${issues.length} problem(s) to fix first.`);
  }
}

/** The request needs approval (or is awaiting it) and cannot be submitted (P-006). */
export class ApprovalRequiredError extends Error {}

function emptySubmission(
  request: PurchaseRequest,
  lines: readonly PurchaseLine[]
): Pick<
  SubmissionFields,
  | 'requestId'
  | 'requestNumber'
  | 'businessPurpose'
  | 'department'
  | 'projectCode'
  | 'purchaseDates'
  | 'totalReimburseCents'
  | 'totalCompanyCents'
  | 'totalRequestCents'
> {
  const totals = computeTotals(lines, request.buyer);
  return {
    requestId: request.id,
    requestNumber: request.requestNumber,
    businessPurpose: request.businessPurpose,
    department: request.department,
    projectCode: request.projectCode,
    purchaseDates: dateRangeText(lines.map((l) => l.date)),
    totalReimburseCents: totals.reimburseCents,
    totalCompanyCents: totals.companyCents,
    totalRequestCents: totals.requestCents
  };
}

/**
 * The processing package for a request that needs no approval, or is
 * approved. Refuses while approval is still to come (P-006). When the approver
 * buys, `submitter` is the approver marking it purchased and `certification` is
 * what the employee ticked when sending it (P-037); without a submitter the
 * employee submits, as when the employee buys.
 */
export function prepareSubmission(
  request: PurchaseRequest,
  lines: readonly PurchaseLine[],
  otherLines: readonly LineRef[],
  now: Date,
  previousFolderName: string,
  certification: Certification,
  submitter?: Submitter
): PreparedSubmission {
  if (certification.text !== CERTIFICATION || !certification.email) throw new Error(messages.certificationRequired);
  if (request.buyer === 'approver' && !submitter) throw new Error(messages.approverBuysNotSubmitted);
  const state = approvalStateOf(request, lines);
  if (mustSendForApproval(state) || state === 'pending') throw new ApprovalRequiredError(messages.approvalRequiredToSubmit);
  const issues = validateRequest(request, lines, otherLines, toIsoDate(now));
  const blocking = blockingIssues(issues);
  if (blocking.length > 0) throw new SubmissionBlockedError(blocking);
  const warnings = issues.filter((i) => i.severity === 'warning');

  const submissionNumber = request.submissionCount + 1;
  const submittedOn = toLocalDateTime(now);
  const totals = computeTotals(lines, request.buyer);
  const submitterName = submitter ? submitter.name : request.ownerName;
  const submitterEmail = submitter ? submitter.email : certification.email;
  const certifiedName = certification.name ?? request.ownerName;
  const certifiedOn = certification.on ?? submittedOn;
  const files = packageFiles(lines);
  const receiptCount = files.filter((f) => f.kind === 'receipt').length;
  const quoteCount = files.filter((f) => f.kind === 'quote').length;
  const name = folderName({
    firstPurchaseDate: dateRange(lines.map((l) => l.date)).first,
    ownerName: request.ownerName,
    businessPurpose: request.businessPurpose,
    requestNumber: request.requestNumber,
    submissionNumber
  });
  const csvName = csvFileName(request.requestNumber, submissionNumber);
  const csvContent = buildPurchasesCsv({
    request,
    lines,
    submissionNumber,
    submitterName,
    submittedOn,
    certifiedBy: { name: certifiedName, email: certification.email },
    warnings
  });

  return {
    csvName,
    csvContent,
    files,
    warnings,
    submission: {
      ...emptySubmission(request, lines),
      type: 'package',
      submissionNumber,
      folderName: name,
      previousFolderName,
      submitterName,
      submitterEmail,
      submittedOn,
      certificationText: certification.text,
      receiptCount,
      quoteCount,
      rowsWithoutReceipt: lines.filter((l) => !hasReceipt(l, lines)).length,
      // Nothing is bought before approval when the approver buys (P-037).
      boughtBeforeApproval: request.buyer === 'self' && (request.boughtBeforeApproval || anyBoughtBefore(request.approval.approved)),
      approvedBy: request.approvedBy,
      approvedOn: request.approvedOn,
      emailSubject: submissionEmailSubject(request.ownerName, request.businessPurpose, request.requestNumber, submissionNumber, request.buyer),
      emailSummary: buildSubmissionEmailSummary({
        request,
        lines,
        totals,
        submitterName,
        submitterEmail,
        buyer: request.buyer,
        certification: { email: certification.email, text: certification.text, submittedOn: certifiedOn, name: certifiedName },
        receiptCount,
        quoteCount,
        warnings,
        previousFolderName
      }),
      packageFileNames: [...files.map((f) => f.packageName), csvName]
    }
  };
}

export interface PreparedApproval {
  /** The approval request item: no files, only the email for the flow to send. */
  submission: SubmissionFields;
  warnings: Issue[];
  /** The vendor totals sent, each flagged if bought before approval (P-017); stored on the request. */
  sentGroups: ApprovalGroup[];
  /** The rows as sent, for a request the approver buys (P-040); empty otherwise. Stored on the request. */
  sentRows: SentRow[];
  boughtBefore: boolean;
  sentOn: string;
}

/**
 * The approval request for a request with a vendor total at or over the
 * threshold (P-005, P-018), or for any request the approver buys (P-037). When
 * the employee buys, no certification is needed at this step (P-028); when the
 * approver buys, the employee certifies now, because there is no later submit
 * for them. Each vendor total is flagged bought before approval against the
 * approval record the request holds now (`request.approval`), so a flag from an
 * earlier round stays, and a total an earlier approval still covers is not
 * newly flagged (`groupsForApproval`).
 */
export function prepareApprovalRequest(
  request: PurchaseRequest,
  lines: readonly PurchaseLine[],
  otherLines: readonly LineRef[],
  now: Date,
  submitter: { name: string; email: string },
  round: number,
  certification?: Certification
): PreparedApproval {
  const approverBuys = request.buyer === 'approver';
  if (approverBuys && (!certification || certification.text !== CERTIFICATION || !certification.email)) throw new Error(messages.certificationRequiredToSend);
  const state = approvalStateOf(request, lines);
  // Why it cannot be sent now: nothing needs approval, it is with the approver, or what was approved still covers it.
  if (!mustSendForApproval(state))
    throw new Error(state === 'notRequired' ? messages.approvalNotNeeded : state === 'pending' ? messages.alreadyWithApprover : messages.alreadyApproved);
  const today = toIsoDate(now);
  const issues = validateRequest(request, lines, otherLines, today);
  const blocking = blockingIssues(issues);
  if (blocking.length > 0) throw new SubmissionBlockedError(blocking);
  const warnings = issues.filter((i) => i.severity === 'warning');

  const sentOn = toLocalDateTime(now);
  const sentGroups = approvalGroupsToSend(request, lines, today);
  const totals = computeTotals(lines, request.buyer);
  return {
    warnings,
    sentGroups,
    sentRows: approverBuys ? sentRowsOf(lines) : [],
    boughtBefore: anyBoughtBefore(sentGroups),
    sentOn,
    submission: {
      ...emptySubmission(request, lines),
      type: 'approval',
      submissionNumber: round,
      folderName: '',
      previousFolderName: '',
      submitterName: request.ownerName,
      submitterEmail: submitter.email,
      submittedOn: sentOn,
      // Kept on the approval request, the only record of what the employee certified when the approver buys (P-037).
      certificationText: approverBuys && certification ? certification.text : '',
      receiptCount: 0,
      quoteCount: lines.reduce((n, l) => n + quoteFiles(l).length, 0),
      rowsWithoutReceipt: 0,
      boughtBeforeApproval: anyBoughtBefore(sentGroups),
      approvedBy: '',
      approvedOn: '',
      emailSubject: approvalEmailSubject(request.ownerName, request.businessPurpose, request.requestNumber, round),
      emailSummary: buildApprovalEmailSummary({
        request,
        lines,
        totals,
        submitterName: request.ownerName,
        submitterEmail: submitter.email,
        buyer: request.buyer,
        round,
        sentOn,
        groups: sentGroups,
        certification: approverBuys && certification ? { name: request.ownerName, email: certification.email, text: certification.text } : undefined
      }),
      packageFileNames: []
    }
  };
}
