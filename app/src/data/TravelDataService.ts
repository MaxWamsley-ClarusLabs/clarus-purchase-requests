// The only way the screens read or change data. The preview and tests use the
// in-memory MockDataService; Stage 8 adds a SharePoint implementation.
// Nothing else in the app talks to SharePoint (CLAUDE.md, strategy section 10).

import { LineRef } from '../domain/duplicates';
import { CurrentUser, ExpenseLine, ReceiptFile, Submission, TravelReport } from '../domain/types';
import { SetupStatus } from './setup';
import { FlowConfig, FlowMode } from '../export/flowPackage';

export type ReportChanges = Partial<
  Pick<TravelReport, 'tripName' | 'destination' | 'businessPurpose' | 'tripPurpose' | 'tripStart' | 'tripEnd' | 'hasMileage' | 'mileageTrips'>
>;

export type LineChanges = Partial<
  Pick<ExpenseLine, 'date' | 'vendor' | 'category' | 'description' | 'amountCents' | 'paymentType' | 'noReceiptReason' | 'sameReceiptAsRow' | 'suggested'>
>;

export interface ReportWithLines {
  report: TravelReport;
  lines: ExpenseLine[];
}

export interface TravelDataService {
  getCurrentUser(): Promise<CurrentUser>;

  /** Whether the travel site's lists are ready (D-063). */
  getSetupStatus(): Promise<SetupStatus>;
  /** Creates or completes the lists. Administrators only. */
  runSetup(progress: (step: string) => void): Promise<SetupStatus>;
  /**
   * An address the browser can show a receipt from. For SharePoint the file is
   * loaded by the app first, so the site's download settings cannot block the
   * preview. Release it with URL.revokeObjectURL when done, if it starts "blob:".
   */
  receiptPreviewUrl(lineId: string, receipt: ReceiptFile): Promise<string>;
  /**
   * What the flow package needs from this site (D-047): the Submissions list,
   * the destination library, and the administrator's email. Administrators only.
   */
  getFlowSettings(mode: FlowMode, appPageUrl: string): Promise<FlowConfig>;

  // Employee
  listMyReports(): Promise<TravelReport[]>;
  getReport(reportId: number): Promise<ReportWithLines>;
  createReport(): Promise<TravelReport>;
  updateReport(reportId: number, changes: ReportChanges): Promise<TravelReport>;
  deleteReport(reportId: number): Promise<void>;
  addLinesFromFiles(reportId: number, files: File[]): Promise<ExpenseLine[]>;
  addEmptyLine(reportId: number): Promise<ExpenseLine>;
  updateLine(lineId: string, changes: LineChanges): Promise<ExpenseLine>;
  deleteLine(lineId: string): Promise<void>;
  addFileToLine(lineId: string, file: File): Promise<ExpenseLine>;
  removeFileFromLine(lineId: string, receiptId: string): Promise<ExpenseLine>;
  /** Rows of the owner's other reports, for duplicate warnings. */
  getOwnerOtherLines(reportId: number): Promise<LineRef[]>;
  /** Submits with the certification the employee ticked (D-064). */
  submitReport(reportId: number, certificationText: string): Promise<Submission>;
  listSubmissionsForReport(reportId: number): Promise<Submission[]>;
  /** The CSV attached to a submission, for the administrator to preview. */
  getSubmissionCsv(submissionId: number): Promise<string>;

  // Administrator
  listAllReports(): Promise<TravelReport[]>;
  listSubmissions(): Promise<Submission[]>;
  listAllLineRefs(): Promise<LineRef[]>;
  markProcessed(reportId: number): Promise<TravelReport>;
  returnReport(reportId: number, note: string): Promise<TravelReport>;
  retryPackaging(submissionId: number): Promise<Submission>;
}
