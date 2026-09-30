// Converts between SharePoint list items (docs/DATA_MODEL.md) and the app's
// own records. Everything stored may have been edited directly in SharePoint
// (D-002), so every value read here is checked, never trusted.

import { toLocalDateTime } from '../../domain/dates';
import { CATEGORIES, PAYMENT_TYPES, TEXT_MAX_LENGTH, TRIP_PURPOSES } from '../../domain/lists';
import { SUGGESTED_FIELDS } from '../../domain/suggestions';
import { ExpenseLine, MileageTrip, ReceiptFile, ReportStatus, Submission, TravelReport, PackageStatus, SuggestedField } from '../../domain/types';
import { PACKAGE_STATUSES, REPORT_STATUSES } from './schema';

export interface SpPerson {
  Id?: number;
  Title?: string;
  EMail?: string;
}

export interface SpAttachment {
  FileName: string;
  ServerRelativeUrl: string;
}

export interface ReportItem {
  Id: number;
  Title: string | null;
  ReportNumber: string | null;
  Destination: string | null;
  BusinessPurpose: string | null;
  TripPurpose: string | null;
  TripStart: string | null;
  TripEnd: string | null;
  HasMileage?: boolean | null;
  MileageTrips?: string | null;
  ReportStatus: string | null;
  ReturnNote: string | null;
  TotalReimburse: number | null;
  TotalCompany: number | null;
  TotalTrip: number | null;
  SubmissionCount: number | null;
  SubmittedOn: string | null;
  ProcessedOn: string | null;
  ProcessedBy?: SpPerson | null;
  Author?: SpPerson | null;
  AuthorId?: number;
  Modified: string;
}

export interface LineItem {
  Id: number;
  ReportId: number | null;
  RowNumber: number | null;
  ExpenseDate: string | null;
  Vendor: string | null;
  Category: string | null;
  Description: string | null;
  Amount: number | null;
  PaymentType: string | null;
  NoReceiptReason: string | null;
  SameReceiptAsRow: number | null;
  FileFingerprints: string | null;
  SuggestedFields?: string | null;
  AttachmentFiles?: SpAttachment[];
}

export interface SubmissionItem {
  Id: number;
  ReportId: number | null;
  SubmissionNumber: number | null;
  PackageStatus: string | null;
  FolderName: string | null;
  PreviousFolderName: string | null;
  SubmitterName: string | null;
  SubmitterEmail: string | null;
  CertificationText: string | null;
  TripName: string | null;
  Destination: string | null;
  TripStart: string | null;
  TripEnd: string | null;
  TripPurpose: string | null;
  SuggestedClass: string | null;
  TotalReimburse: number | null;
  TotalCompany: number | null;
  TotalTrip: number | null;
  ReceiptCount: number | null;
  RowsWithoutReceipt: number | null;
  EmailSubject: string | null;
  EmailSummary: string | null;
  FolderLink: string | null;
  PackagedAt: string | null;
  ErrorMessage: string | null;
  Created: string;
  AttachmentFiles?: SpAttachment[];
}

/** What is stored per attached file, for duplicate checks (D-043). */
export interface StoredFingerprint {
  fileName: string;
  sizeBytes: number;
  fingerprint: string;
}

// ---- Small helpers -------------------------------------------------------

/** One-line text columns hold 255 characters; pasted text is cut to fit rather than refused. */
const line255 = (v: string): string => v.slice(0, TEXT_MAX_LENGTH);

const str = (v: unknown): string => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));
const int = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0);
const cents = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) : 0);
const email = (p: SpPerson | null | undefined): string => str(p && p.EMail).toLowerCase();

/** SharePoint currency columns hold dollars; the app works in whole cents (D-043). */
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

export function parseFingerprints(value: string | null): StoredFingerprint[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is StoredFingerprint => !!x && typeof x === 'object' && typeof (x as StoredFingerprint).fileName === 'string')
      .map((x) => ({ fileName: x.fileName, sizeBytes: int(x.sizeBytes), fingerprint: str(x.fingerprint) }));
  } catch {
    return [];
  }
}

/** The drives stored with a report (D-071), read defensively. */
export function parseTrips(value: string | null | undefined): MileageTrip[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
      .map((x, i) => ({
        id: typeof x.id === 'string' && x.id ? x.id : `trip-${i + 1}`,
        date: str(x.date),
        from: str(x.from).slice(0, TEXT_MAX_LENGTH),
        to: str(x.to).slice(0, TEXT_MAX_LENGTH),
        miles: typeof x.miles === 'number' && Number.isFinite(x.miles) && x.miles > 0 ? Math.round(x.miles * 10) / 10 : null
      }));
  } catch {
    return [];
  }
}

// ---- Travel Reports ----------------------------------------------------

export function reportFromItem(item: ReportItem): TravelReport {
  return {
    id: item.Id,
    reportNumber: str(item.ReportNumber),
    tripName: str(item.Title),
    destination: str(item.Destination),
    businessPurpose: str(item.BusinessPurpose),
    tripPurpose: idForLabel(TRIP_PURPOSES, item.TripPurpose),
    tripStart: str(item.TripStart),
    tripEnd: str(item.TripEnd),
    hasMileage: item.HasMileage === true,
    mileageTrips: parseTrips(item.MileageTrips),
    status: oneOf<ReportStatus>(item.ReportStatus, REPORT_STATUSES, 'Draft'),
    returnNote: str(item.ReturnNote),
    ownerName: str(item.Author && item.Author.Title),
    ownerEmail: email(item.Author),
    submissionCount: int(item.SubmissionCount),
    totalReimburseCents: cents(item.TotalReimburse),
    totalCompanyCents: cents(item.TotalCompany),
    totalTripCents: cents(item.TotalTrip),
    submittedOn: localTime(item.SubmittedOn),
    processedOn: localTime(item.ProcessedOn),
    processedBy: str(item.ProcessedBy && item.ProcessedBy.Title),
    lastChanged: localTime(item.Modified)
  };
}

/** The columns a report change writes. Only fields present in `changes` are sent. */
export function reportFields(changes: Partial<TravelReport>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (changes.tripName !== undefined) out.Title = line255(changes.tripName);
  if (changes.destination !== undefined) out.Destination = line255(changes.destination);
  if (changes.businessPurpose !== undefined) out.BusinessPurpose = changes.businessPurpose;
  if (changes.tripPurpose !== undefined) out.TripPurpose = labelForId(TRIP_PURPOSES, changes.tripPurpose);
  if (changes.tripStart !== undefined) out.TripStart = changes.tripStart;
  if (changes.tripEnd !== undefined) out.TripEnd = changes.tripEnd;
  if (changes.hasMileage !== undefined) out.HasMileage = changes.hasMileage;
  if (changes.mileageTrips !== undefined) out.MileageTrips = JSON.stringify(changes.mileageTrips);
  if (changes.totalReimburseCents !== undefined) out.TotalReimburse = centsToDollars(changes.totalReimburseCents);
  if (changes.totalCompanyCents !== undefined) out.TotalCompany = centsToDollars(changes.totalCompanyCents);
  if (changes.totalTripCents !== undefined) out.TotalTrip = centsToDollars(changes.totalTripCents);
  return out;
}

// ---- Expense Lines --------------------------------------------------------

export function lineFromItem(item: LineItem): ExpenseLine {
  const prints = parseFingerprints(item.FileFingerprints);
  // Without the attachment list (a lighter query), the stored fingerprints
  // still describe the files, which is all the duplicate checks need.
  if (!item.AttachmentFiles) {
    return {
      ...lineFromItem({ ...item, AttachmentFiles: [] }),
      receipts: prints.map((p) => ({
        id: p.fileName,
        fileName: p.fileName,
        sizeBytes: p.sizeBytes,
        fingerprint: p.fingerprint,
        contentType: contentTypeFor(p.fileName)
      }))
    };
  }
  const receipts: ReceiptFile[] = item.AttachmentFiles.map((a) => {
    const print = prints.find((p) => p.fileName === a.FileName);
    return {
      id: a.FileName,
      fileName: a.FileName,
      sizeBytes: print ? print.sizeBytes : 0,
      fingerprint: print ? print.fingerprint : '',
      contentType: contentTypeFor(a.FileName),
      url: a.ServerRelativeUrl
    };
  });
  return {
    id: String(item.Id),
    reportId: int(item.ReportId),
    rowNumber: int(item.RowNumber),
    date: str(item.ExpenseDate),
    vendor: str(item.Vendor),
    category: idForLabel(CATEGORIES, item.Category),
    description: str(item.Description),
    amountCents: typeof item.Amount === 'number' && Number.isFinite(item.Amount) ? Math.round(item.Amount * 100) : null,
    paymentType: idForLabel(PAYMENT_TYPES, item.PaymentType),
    noReceiptReason: str(item.NoReceiptReason),
    sameReceiptAsRow: typeof item.SameReceiptAsRow === 'number' && item.SameReceiptAsRow > 0 ? Math.round(item.SameReceiptAsRow) : null,
    receipts,
    suggested: parseSuggested(item.SuggestedFields)
  };
}

/**
 * The row's unconfirmed suggestions (D-078), stored as "date,amount,vendor".
 * Read defensively (D-002): unknown names are dropped.
 */
export function parseSuggested(value: string | null | undefined): SuggestedField[] {
  const names = typeof value === 'string' ? value.split(',').map((v) => v.trim()) : [];
  return SUGGESTED_FIELDS.filter((f) => names.includes(f));
}

export function lineFields(changes: Partial<ExpenseLine>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (changes.rowNumber !== undefined) out.RowNumber = changes.rowNumber;
  if (changes.date !== undefined) out.ExpenseDate = changes.date;
  if (changes.vendor !== undefined) out.Vendor = line255(changes.vendor);
  if (changes.category !== undefined) out.Category = labelForId(CATEGORIES, changes.category);
  if (changes.description !== undefined) out.Description = line255(changes.description);
  if (changes.amountCents !== undefined) out.Amount = changes.amountCents === null ? null : centsToDollars(changes.amountCents);
  if (changes.paymentType !== undefined) out.PaymentType = labelForId(PAYMENT_TYPES, changes.paymentType);
  if (changes.noReceiptReason !== undefined) out.NoReceiptReason = line255(changes.noReceiptReason);
  if (changes.sameReceiptAsRow !== undefined) out.SameReceiptAsRow = changes.sameReceiptAsRow;
  if (changes.suggested !== undefined) out.SuggestedFields = parseSuggested(changes.suggested.join(',')).join(',');
  return out;
}

// ---- Submissions ------------------------------------------------------------

export function submissionFromItem(item: SubmissionItem, reportNumber: string): Submission {
  return {
    id: item.Id,
    reportId: int(item.ReportId),
    reportNumber,
    submissionNumber: int(item.SubmissionNumber),
    packageStatus: oneOf<PackageStatus>(item.PackageStatus, PACKAGE_STATUSES, 'Uploading'),
    folderName: str(item.FolderName),
    previousFolderName: str(item.PreviousFolderName),
    submitterName: str(item.SubmitterName),
    submitterEmail: str(item.SubmitterEmail).toLowerCase(),
    submittedOn: localTime(item.Created),
    certificationText: str(item.CertificationText),
    tripName: str(item.TripName),
    destination: str(item.Destination),
    tripStart: str(item.TripStart),
    tripEnd: str(item.TripEnd),
    tripPurpose: str(item.TripPurpose),
    suggestedClass: str(item.SuggestedClass),
    totalReimburseCents: cents(item.TotalReimburse),
    totalCompanyCents: cents(item.TotalCompany),
    totalTripCents: cents(item.TotalTrip),
    receiptCount: int(item.ReceiptCount),
    rowsWithoutReceipt: int(item.RowsWithoutReceipt),
    emailSubject: str(item.EmailSubject),
    emailSummary: str(item.EmailSummary),
    folderLink: str(item.FolderLink),
    packagedAt: localTime(item.PackagedAt),
    errorMessage: str(item.ErrorMessage),
    packageFileNames: (item.AttachmentFiles ?? []).map((a) => a.FileName)
  };
}

/** The columns written when a submission is created (the flow fills in the rest). */
export function submissionFields(s: Omit<Submission, 'id' | 'packageStatus' | 'folderLink' | 'packagedAt' | 'errorMessage'>): Record<string, unknown> {
  return {
    Title: `${s.reportNumber} submission ${s.submissionNumber}`,
    ReportId: s.reportId,
    SubmissionNumber: s.submissionNumber,
    PackageStatus: 'Uploading',
    FolderName: s.folderName,
    PreviousFolderName: s.previousFolderName,
    SubmitterName: s.submitterName,
    SubmitterEmail: s.submitterEmail,
    CertificationText: s.certificationText,
    TripName: s.tripName,
    Destination: s.destination,
    TripStart: s.tripStart,
    TripEnd: s.tripEnd,
    TripPurpose: s.tripPurpose,
    SuggestedClass: s.suggestedClass,
    TotalReimburse: centsToDollars(s.totalReimburseCents),
    TotalCompany: centsToDollars(s.totalCompanyCents),
    TotalTrip: centsToDollars(s.totalTripCents),
    ReceiptCount: s.receiptCount,
    RowsWithoutReceipt: s.rowsWithoutReceipt,
    EmailSubject: s.emailSubject,
    EmailSummary: s.emailSummary
  };
}
