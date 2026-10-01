// Converts between SharePoint list items (docs/DATA_MODEL.md) and the app's
// own records. Everything stored may have been edited directly in SharePoint
// (travel D-002), so every value read here is checked, never trusted.

import { toLocalDateTime } from '../../domain/dates';
import { CATEGORIES, PAID_BY_OPTIONS } from '../../domain/purchaseRules';
import { REQUEST_STATUSES } from '../../domain/statuses';
import { SUGGESTED_FIELDS } from '../../domain/suggestions';
import {
  ApprovalGroup,
  ApprovalRecord,
  AttachedFile,
  FileKind,
  PackageStatus,
  PurchaseLine,
  PurchaseRequest,
  RequestStatus,
  ReturnStage,
  SuggestedField,
  Submission,
  TEXT_MAX_LENGTH
} from '../../domain/types';
import { SubmissionFields } from '../../export/submission';
import { PACKAGE_STATUSES, RETURN_STAGE_LABELS, SUBMISSION_TYPE_LABELS } from './schema';

export interface SpPerson {
  Id?: number;
  Title?: string;
  EMail?: string;
}

export interface SpAttachment {
  FileName: string;
  ServerRelativeUrl: string;
}

export interface RequestItem {
  Id: number;
  Title: string | null;
  RequestNumber: string | null;
  Department: string | null;
  ProjectCode: string | null;
  RequestStatus: string | null;
  ReturnNote: string | null;
  ReturnStage: string | null;
  TotalReimburse: number | null;
  TotalCompany: number | null;
  TotalRequest: number | null;
  SubmissionCount: number | null;
  ApprovalRounds: number | null;
  SentForApprovalOn: string | null;
  BoughtBeforeApproval?: boolean | null;
  ApprovalRecord: string | null;
  ApprovalNote: string | null;
  ApprovedOn: string | null;
  ApprovedBy?: SpPerson | null;
  SubmittedOn: string | null;
  ProcessedOn: string | null;
  ProcessedBy?: SpPerson | null;
  Author?: SpPerson | null;
  AuthorId?: number;
  Modified: string;
}

export interface LineItem {
  Id: number;
  RequestId: number | null;
  RowNumber: number | null;
  PurchaseDate: string | null;
  Vendor: string | null;
  Description: string | null;
  Category: string | null;
  CategoryOther: string | null;
  CategoryConfirmedBy: string | null;
  Amount: number | null;
  PaidBy: string | null;
  NoQuoteReason: string | null;
  NoReceiptReason: string | null;
  SameReceiptAsRow: number | null;
  FileFingerprints: string | null;
  SuggestedFields?: string | null;
  AttachmentFiles?: SpAttachment[];
}

export interface SubmissionItem {
  Id: number;
  RequestId: number | null;
  SubmissionType: string | null;
  SubmissionNumber: number | null;
  PackageStatus: string | null;
  FolderName: string | null;
  PreviousFolderName: string | null;
  SubmitterName: string | null;
  SubmitterEmail: string | null;
  CertificationText: string | null;
  BusinessPurpose: string | null;
  Department: string | null;
  ProjectCode: string | null;
  PurchaseDates: string | null;
  TotalReimburse: number | null;
  TotalCompany: number | null;
  TotalRequest: number | null;
  ReceiptCount: number | null;
  QuoteCount: number | null;
  RowsWithoutReceipt: number | null;
  BoughtBeforeApproval?: boolean | null;
  ApprovedBy: string | null;
  ApprovedOn: string | null;
  EmailSubject: string | null;
  EmailSummary: string | null;
  FolderLink: string | null;
  PackagedAt: string | null;
  ErrorMessage: string | null;
  Created: string;
  AttachmentFiles?: SpAttachment[];
}

/** What is stored per attached file: for duplicate checks (travel D-043) and to tell receipts from quotes (P-021). */
export interface StoredFingerprint {
  fileName: string;
  sizeBytes: number;
  fingerprint: string;
  kind: FileKind;
}

// ---- Small helpers -------------------------------------------------------

/** One-line text columns hold 255 characters; pasted text is cut to fit rather than refused. */
export const line255 = (v: string): string => v.slice(0, TEXT_MAX_LENGTH);

const str = (v: unknown): string => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));
const int = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0);
/** A count cannot be negative, even if someone types one into the list. */
const count = (v: unknown): number => Math.max(0, int(v));
const cents = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) : 0);
const email = (p: SpPerson | null | undefined): string => str(p && p.EMail).toLowerCase();
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** SharePoint currency columns hold dollars; the app works in whole cents (travel D-043). */
export function centsToDollars(value: number): number {
  return Math.round(value) / 100;
}

/** Date-and-time columns come back as UTC; the app shows local "YYYY-MM-DD HH:MM". */
export function localTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : toLocalDateTime(date);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

const idForLabel = <T extends { id: string; label: string }>(list: readonly T[], label: unknown): T['id'] | '' => list.find((x) => x.label === label)?.id ?? '';
const labelForId = <T extends { id: string; label: string }>(list: readonly T[], id: string): string | null => list.find((x) => x.id === id)?.label ?? null;

export function contentTypeFor(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'heic') return 'image/heic';
  if (ext === 'csv') return 'text/csv';
  return 'application/octet-stream';
}

// ---- Files and their fingerprints ---------------------------------------------

/** A stored file with no kind, or an unknown one, is a receipt (P-021). */
const kindOf = (value: unknown): FileKind => (value === 'quote' ? 'quote' : 'receipt');

export function parseFingerprints(value: string | null): StoredFingerprint[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is Record<string, unknown> => isRecord(x) && typeof x.fileName === 'string')
      .map((x) => ({ fileName: x.fileName as string, sizeBytes: int(x.sizeBytes), fingerprint: str(x.fingerprint), kind: kindOf(x.kind) }));
  } catch {
    return [];
  }
}

/** What is written to FileFingerprints for a row's files, in the order they were added. */
export function storedFingerprint(file: AttachedFile): StoredFingerprint {
  return { fileName: file.fileName, sizeBytes: file.sizeBytes, fingerprint: file.fingerprint, kind: file.kind };
}

function fileFromPrint(print: StoredFingerprint): AttachedFile {
  return {
    id: print.fileName,
    fileName: print.fileName,
    sizeBytes: print.sizeBytes,
    fingerprint: print.fingerprint,
    contentType: contentTypeFor(print.fileName),
    kind: print.kind
  };
}

/**
 * A row's files from its attachments. The stored fingerprints say what kind
 * each is and give the order the files were added in, which is the order the
 * package names follow (R01, R01-2, ...); SharePoint's own listing order is
 * not relied on. A file with no stored entry (added directly in SharePoint) is
 * a receipt and comes after the others.
 */
function filesFromAttachments(attachments: readonly SpAttachment[], prints: readonly StoredFingerprint[]): AttachedFile[] {
  const position = (name: string): number => {
    const at = prints.findIndex((p) => p.fileName === name);
    return at < 0 ? prints.length : at;
  };
  return [...attachments]
    .sort((a, b) => position(a.FileName) - position(b.FileName))
    .map((a) => {
      const print = prints.find((p) => p.fileName === a.FileName);
      return {
        id: a.FileName,
        fileName: a.FileName,
        sizeBytes: print ? print.sizeBytes : 0,
        fingerprint: print ? print.fingerprint : '',
        contentType: contentTypeFor(a.FileName),
        kind: print ? print.kind : 'receipt',
        url: a.ServerRelativeUrl
      };
    });
}

// ---- The approval record -----------------------------------------------------

const emptyRecord = (): ApprovalRecord => ({ sent: [], approved: [] });

/** The vendor totals in a record. A group that is not well formed is dropped, which can only ask for more approval, never less. */
function parseGroups(value: unknown): ApprovalGroup[] {
  const groups: ApprovalGroup[] = [];
  if (!Array.isArray(value)) return groups;
  for (const g of value) {
    if (!isRecord(g) || typeof g.key !== 'string' || typeof g.vendor !== 'string') continue;
    if (typeof g.cents !== 'number' || !Number.isFinite(g.cents) || g.cents < 0) continue;
    groups.push({ key: g.key, vendor: g.vendor, cents: Math.round(g.cents), bought: g.bought === true });
  }
  return groups;
}

/**
 * The approval record stored on a request as JSON (docs/DATA_MODEL.md),
 * read defensively: anything that is not the two lists of vendor totals gives
 * the empty record, which reads as "not approved" (P-029).
 */
export function parseApprovalRecord(value: string | null | undefined): ApprovalRecord {
  if (!value) return emptyRecord();
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return emptyRecord();
    const shape = (v: unknown) => v === undefined || Array.isArray(v);
    if (!shape(parsed.sent) || !shape(parsed.approved)) return emptyRecord();
    return { sent: parseGroups(parsed.sent), approved: parseGroups(parsed.approved) };
  } catch {
    return emptyRecord();
  }
}

export function approvalRecordJson(record: ApprovalRecord): string {
  return JSON.stringify({ sent: record.sent, approved: record.approved });
}

// ---- Purchase Requests -----------------------------------------------------

function returnStageFrom(label: unknown): ReturnStage {
  if (label === RETURN_STAGE_LABELS.approval) return 'approval';
  if (label === RETURN_STAGE_LABELS.processing) return 'processing';
  return '';
}

export function requestFromItem(item: RequestItem): PurchaseRequest {
  return {
    id: item.Id,
    requestNumber: str(item.RequestNumber),
    businessPurpose: str(item.Title),
    department: str(item.Department),
    projectCode: str(item.ProjectCode),
    status: oneOf<RequestStatus>(item.RequestStatus, REQUEST_STATUSES, 'Draft'),
    returnNote: str(item.ReturnNote),
    returnStage: returnStageFrom(item.ReturnStage),
    ownerName: str(item.Author && item.Author.Title),
    ownerEmail: email(item.Author),
    submissionCount: count(item.SubmissionCount),
    approvalRounds: count(item.ApprovalRounds),
    totalReimburseCents: cents(item.TotalReimburse),
    totalCompanyCents: cents(item.TotalCompany),
    totalRequestCents: cents(item.TotalRequest),
    sentForApprovalOn: localTime(item.SentForApprovalOn),
    boughtBeforeApproval: item.BoughtBeforeApproval === true,
    approval: parseApprovalRecord(item.ApprovalRecord),
    approvalNote: str(item.ApprovalNote),
    approvedOn: localTime(item.ApprovedOn),
    approvedBy: str(item.ApprovedBy && item.ApprovedBy.Title),
    approvedByEmail: email(item.ApprovedBy),
    submittedOn: localTime(item.SubmittedOn),
    processedOn: localTime(item.ProcessedOn),
    processedBy: str(item.ProcessedBy && item.ProcessedBy.Title),
    lastChanged: localTime(item.Modified)
  };
}

/**
 * What a change to a request writes. The date-and-time columns take an ISO
 * time (an instant, not the local text the app shows), the person columns take
 * a SharePoint user ID, and null clears a column.
 */
export type RequestWrite = Partial<
  Pick<
    PurchaseRequest,
    | 'businessPurpose'
    | 'department'
    | 'projectCode'
    | 'status'
    | 'returnNote'
    | 'returnStage'
    | 'submissionCount'
    | 'approvalRounds'
    | 'totalReimburseCents'
    | 'totalCompanyCents'
    | 'totalRequestCents'
    | 'boughtBeforeApproval'
    | 'approval'
    | 'approvalNote'
  >
> & {
  sentForApprovalOn?: string | null;
  approvedOn?: string | null;
  approvedById?: number | null;
  submittedOn?: string | null;
  processedOn?: string | null;
  processedById?: number | null;
};

/** The columns a request change writes. Only fields present in `changes` are sent. */
export function requestFields(changes: RequestWrite): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (changes.businessPurpose !== undefined) out.Title = line255(changes.businessPurpose);
  if (changes.department !== undefined) out.Department = line255(changes.department);
  if (changes.projectCode !== undefined) out.ProjectCode = line255(changes.projectCode);
  if (changes.status !== undefined) out.RequestStatus = changes.status;
  if (changes.returnNote !== undefined) out.ReturnNote = changes.returnNote;
  if (changes.returnStage !== undefined) out.ReturnStage = changes.returnStage === '' ? null : RETURN_STAGE_LABELS[changes.returnStage];
  if (changes.submissionCount !== undefined) out.SubmissionCount = changes.submissionCount;
  if (changes.approvalRounds !== undefined) out.ApprovalRounds = changes.approvalRounds;
  if (changes.totalReimburseCents !== undefined) out.TotalReimburse = centsToDollars(changes.totalReimburseCents);
  if (changes.totalCompanyCents !== undefined) out.TotalCompany = centsToDollars(changes.totalCompanyCents);
  if (changes.totalRequestCents !== undefined) out.TotalRequest = centsToDollars(changes.totalRequestCents);
  if (changes.sentForApprovalOn !== undefined) out.SentForApprovalOn = changes.sentForApprovalOn;
  if (changes.boughtBeforeApproval !== undefined) out.BoughtBeforeApproval = changes.boughtBeforeApproval;
  if (changes.approval !== undefined) out.ApprovalRecord = approvalRecordJson(changes.approval);
  if (changes.approvalNote !== undefined) out.ApprovalNote = changes.approvalNote;
  if (changes.approvedOn !== undefined) out.ApprovedOn = changes.approvedOn;
  if (changes.approvedById !== undefined) out.ApprovedById = changes.approvedById;
  if (changes.submittedOn !== undefined) out.SubmittedOn = changes.submittedOn;
  if (changes.processedOn !== undefined) out.ProcessedOn = changes.processedOn;
  if (changes.processedById !== undefined) out.ProcessedById = changes.processedById;
  return out;
}

// ---- Purchase Request Lines -------------------------------------------------

export function lineFromItem(item: LineItem): PurchaseLine {
  const prints = parseFingerprints(item.FileFingerprints);
  return {
    id: String(item.Id),
    requestId: int(item.RequestId),
    rowNumber: count(item.RowNumber),
    date: str(item.PurchaseDate),
    vendor: str(item.Vendor),
    description: str(item.Description),
    category: idForLabel(CATEGORIES, item.Category),
    categoryOther: str(item.CategoryOther),
    categoryConfirmedBy: str(item.CategoryConfirmedBy),
    amountCents: typeof item.Amount === 'number' && Number.isFinite(item.Amount) ? Math.round(item.Amount * 100) : null,
    paidBy: idForLabel(PAID_BY_OPTIONS, item.PaidBy),
    noQuoteReason: str(item.NoQuoteReason),
    noReceiptReason: str(item.NoReceiptReason),
    sameReceiptAsRow: typeof item.SameReceiptAsRow === 'number' && item.SameReceiptAsRow > 0 ? Math.round(item.SameReceiptAsRow) : null,
    // Without the attachment list (a lighter query), the stored fingerprints
    // still describe the files, which is all the duplicate checks need.
    files: item.AttachmentFiles ? filesFromAttachments(item.AttachmentFiles, prints) : prints.map(fileFromPrint),
    suggested: parseSuggested(item.SuggestedFields)
  };
}

/**
 * The row's unconfirmed suggestions (travel D-078), stored as "date,amount,vendor".
 * Read defensively (travel D-002): unknown names are dropped.
 */
export function parseSuggested(value: string | null | undefined): SuggestedField[] {
  const names = typeof value === 'string' ? value.split(',').map((v) => v.trim()) : [];
  return SUGGESTED_FIELDS.filter((f) => names.includes(f));
}

/** The columns a row change writes. Only fields present in `changes` are sent. */
export function lineFields(changes: Partial<PurchaseLine>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (changes.rowNumber !== undefined) out.RowNumber = changes.rowNumber;
  if (changes.date !== undefined) out.PurchaseDate = changes.date;
  if (changes.vendor !== undefined) out.Vendor = line255(changes.vendor);
  if (changes.description !== undefined) out.Description = line255(changes.description);
  if (changes.category !== undefined) out.Category = labelForId(CATEGORIES, changes.category);
  if (changes.categoryOther !== undefined) out.CategoryOther = line255(changes.categoryOther);
  if (changes.categoryConfirmedBy !== undefined) out.CategoryConfirmedBy = line255(changes.categoryConfirmedBy);
  if (changes.amountCents !== undefined) out.Amount = changes.amountCents === null ? null : centsToDollars(changes.amountCents);
  if (changes.paidBy !== undefined) out.PaidBy = labelForId(PAID_BY_OPTIONS, changes.paidBy);
  if (changes.noQuoteReason !== undefined) out.NoQuoteReason = line255(changes.noQuoteReason);
  if (changes.noReceiptReason !== undefined) out.NoReceiptReason = line255(changes.noReceiptReason);
  if (changes.sameReceiptAsRow !== undefined) out.SameReceiptAsRow = changes.sameReceiptAsRow;
  if (changes.suggested !== undefined) out.SuggestedFields = parseSuggested(changes.suggested.join(',')).join(',');
  return out;
}

// ---- Purchase Submissions --------------------------------------------------

export function submissionFromItem(item: SubmissionItem, requestNumber: string): Submission {
  return {
    id: item.Id,
    requestId: int(item.RequestId),
    requestNumber,
    type: item.SubmissionType === SUBMISSION_TYPE_LABELS.approval ? 'approval' : 'package',
    submissionNumber: count(item.SubmissionNumber),
    packageStatus: oneOf<PackageStatus>(item.PackageStatus, PACKAGE_STATUSES, 'Uploading'),
    folderName: str(item.FolderName),
    previousFolderName: str(item.PreviousFolderName),
    submitterName: str(item.SubmitterName),
    submitterEmail: str(item.SubmitterEmail).toLowerCase(),
    submittedOn: localTime(item.Created),
    certificationText: str(item.CertificationText),
    businessPurpose: str(item.BusinessPurpose),
    department: str(item.Department),
    projectCode: str(item.ProjectCode),
    purchaseDates: str(item.PurchaseDates),
    totalReimburseCents: cents(item.TotalReimburse),
    totalCompanyCents: cents(item.TotalCompany),
    totalRequestCents: cents(item.TotalRequest),
    receiptCount: count(item.ReceiptCount),
    quoteCount: count(item.QuoteCount),
    rowsWithoutReceipt: count(item.RowsWithoutReceipt),
    boughtBeforeApproval: item.BoughtBeforeApproval === true,
    approvedBy: str(item.ApprovedBy),
    approvedOn: str(item.ApprovedOn),
    emailSubject: str(item.EmailSubject),
    emailSummary: str(item.EmailSummary),
    folderLink: str(item.FolderLink),
    packagedAt: localTime(item.PackagedAt),
    errorMessage: str(item.ErrorMessage),
    packageFileNames: (item.AttachmentFiles ?? []).map((a) => a.FileName)
  };
}

/** The columns written when a submission is created (the flow fills in the rest). */
export function submissionFields(s: SubmissionFields): Record<string, unknown> {
  return {
    Title: line255(`${s.requestNumber} ${s.type === 'approval' ? 'approval' : 'submission'} ${s.submissionNumber}`),
    RequestId: s.requestId,
    SubmissionType: SUBMISSION_TYPE_LABELS[s.type],
    SubmissionNumber: s.submissionNumber,
    PackageStatus: 'Uploading',
    FolderName: line255(s.folderName),
    PreviousFolderName: line255(s.previousFolderName),
    SubmitterName: line255(s.submitterName),
    SubmitterEmail: line255(s.submitterEmail),
    CertificationText: s.certificationText,
    BusinessPurpose: line255(s.businessPurpose),
    Department: line255(s.department),
    ProjectCode: line255(s.projectCode),
    PurchaseDates: line255(s.purchaseDates),
    TotalReimburse: centsToDollars(s.totalReimburseCents),
    TotalCompany: centsToDollars(s.totalCompanyCents),
    TotalRequest: centsToDollars(s.totalRequestCents),
    ReceiptCount: s.receiptCount,
    QuoteCount: s.quoteCount,
    RowsWithoutReceipt: s.rowsWithoutReceipt,
    BoughtBeforeApproval: s.boughtBeforeApproval,
    ApprovedBy: line255(s.approvedBy),
    ApprovedOn: line255(s.approvedOn),
    EmailSubject: line255(s.emailSubject),
    EmailSummary: s.emailSummary
  };
}
