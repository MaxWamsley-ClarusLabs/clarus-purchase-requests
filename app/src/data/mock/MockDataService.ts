// In-memory implementation of TravelDataService for the prototype. It keeps
// the same rules as the real service will: employees see only their own
// reports, submitted reports are locked, and packaging is simulated.

import { LineRef } from '../../domain/duplicates';
import { toLocalDateTime } from '../../domain/dates';
import { reportNumber } from '../../domain/naming';
import { checkReceiptFile } from '../../domain/receipts';
import { isEditable } from '../../domain/statuses';
import { computeTotals } from '../../domain/totals';
import { activeTrips } from '../../domain/mileage';
import { defaultPaymentType } from '../../domain/defaults';
import { CurrentUser, ExpenseLine, ReceiptFile, Submission, TravelReport } from '../../domain/types';
import { prepareSubmission } from '../../export/submission';
import { fingerprintFile } from '../files';
import { LineChanges, ReportChanges, ReportWithLines, TravelDataService } from '../TravelDataService';
import { ListCheck, SetupStatus } from '../setup';
import { FlowConfig, FlowMode, LIVE_DESTINATION, TEST_FOLDERS } from '../../export/flowPackage';
import { SampleStore } from './sampleData';

const LATENCY_MS = 120;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class NotAllowedError extends Error {}

export class MockDataService implements TravelDataService {
  private idCounter = 0;
  /** Set to notSetUp() to show the set-up page in the preview. */
  public setupStatus: SetupStatus = readySetup();

  constructor(
    private readonly store: SampleStore,
    private readonly user: CurrentUser,
    /** Packaging steps in milliseconds; tests can make them instant. */
    private readonly packagingDelayMs = 1500
  ) {}

  async getCurrentUser(): Promise<CurrentUser> {
    return { ...this.user };
  }

  /** The sample site is always set up, unless a test says otherwise. */
  async getSetupStatus(): Promise<SetupStatus> {
    return this.setupStatus;
  }

  async runSetup(progress: (step: string) => void): Promise<SetupStatus> {
    this.requireAdmin();
    for (const list of this.setupStatus.lists) {
      progress(`Creating the ${list.title} list`);
      await wait(LATENCY_MS * 3);
    }
    this.setupStatus = readySetup();
    return this.setupStatus;
  }

  async receiptPreviewUrl(_lineId: string, receipt: ReceiptFile): Promise<string> {
    return receipt.url ?? '';
  }

  async getFlowSettings(mode: FlowMode, appPageUrl: string): Promise<FlowConfig> {
    this.requireAdmin();
    await wait(LATENCY_MS);
    const travel = 'https://contoso.sharepoint.com/sites/Travel';
    return {
      mode,
      travelSiteUrl: travel,
      submissionsListId: this.setupStatus.lists[2].listId,
      destinationSiteUrl: mode === 'live' ? LIVE_DESTINATION.siteUrl : travel,
      libraryUrlName: 'Shared Documents',
      folders: mode === 'live' ? [...LIVE_DESTINATION.folders] : [...TEST_FOLDERS],
      adminEmail: this.user.email,
      appPageUrl
    };
  }

  // ---- Employee -------------------------------------------------------

  async listMyReports(): Promise<TravelReport[]> {
    await wait(LATENCY_MS);
    return clone(this.store.reports.filter((r) => r.ownerEmail === this.user.email).sort(byLastChanged));
  }

  async getReport(reportId: number): Promise<ReportWithLines> {
    await wait(LATENCY_MS);
    const report = this.findReportForRead(reportId);
    return { report: clone(report), lines: clone(this.linesOf(reportId)) };
  }

  async createReport(): Promise<TravelReport> {
    await wait(LATENCY_MS);
    const id = this.store.nextReportId++;
    const report: TravelReport = {
      id,
      reportNumber: reportNumber(id),
      tripName: '',
      destination: '',
      businessPurpose: '',
      tripPurpose: '',
      tripStart: '',
      tripEnd: '',
      hasMileage: false,
      mileageTrips: [],
      status: 'Draft',
      returnNote: '',
      ownerName: this.user.displayName,
      ownerEmail: this.user.email,
      submissionCount: 0,
      totalReimburseCents: 0,
      totalCompanyCents: 0,
      totalTripCents: 0,
      submittedOn: '',
      processedOn: '',
      processedBy: '',
      lastChanged: toLocalDateTime(new Date())
    };
    this.store.reports.push(report);
    return clone(report);
  }

  async updateReport(reportId: number, changes: ReportChanges): Promise<TravelReport> {
    await wait(LATENCY_MS);
    const report = this.findReportForEdit(reportId);
    Object.assign(report, clone(changes), { lastChanged: toLocalDateTime(new Date()) });
    if (changes.hasMileage !== undefined || changes.mileageTrips !== undefined) this.touch(reportId);
    return clone(report);
  }

  async deleteReport(reportId: number): Promise<void> {
    await wait(LATENCY_MS);
    const report = this.findReportForEdit(reportId);
    if (report.status !== 'Draft') throw new NotAllowedError('Only drafts can be deleted.');
    this.store.reports = this.store.reports.filter((r) => r.id !== reportId);
    this.store.lines = this.store.lines.filter((l) => l.reportId !== reportId);
  }

  async addLinesFromFiles(reportId: number, files: File[]): Promise<ExpenseLine[]> {
    this.findReportForEdit(reportId);
    const added: ExpenseLine[] = [];
    for (const f of files) {
      if (!checkReceiptFile(f.name, f.size).ok) continue; // the screen reports refused files
      const receipt = await this.toReceipt(f);
      const line = this.newLine(reportId, { receipts: [receipt] });
      this.store.lines.push(line);
      added.push(line);
    }
    this.touch(reportId);
    return clone(added);
  }

  async addEmptyLine(reportId: number): Promise<ExpenseLine> {
    await wait(LATENCY_MS);
    this.findReportForEdit(reportId);
    const line = this.newLine(reportId, {});
    this.store.lines.push(line);
    this.touch(reportId);
    return clone(line);
  }

  async updateLine(lineId: string, changes: LineChanges): Promise<ExpenseLine> {
    await wait(LATENCY_MS);
    const line = this.findLineForEdit(lineId);
    Object.assign(line, clone(changes));
    this.touch(line.reportId);
    return clone(line);
  }

  async deleteLine(lineId: string): Promise<void> {
    await wait(LATENCY_MS);
    const line = this.findLineForEdit(lineId);
    const removedRow = line.rowNumber;
    this.store.lines = this.store.lines.filter((l) => l.id !== lineId);
    // Renumber the rows after it, and keep "same receipt as row" pointers correct.
    for (const l of this.linesOf(line.reportId)) {
      if (l.sameReceiptAsRow === removedRow) l.sameReceiptAsRow = null;
      else if (l.sameReceiptAsRow !== null && l.sameReceiptAsRow > removedRow) l.sameReceiptAsRow -= 1;
      if (l.rowNumber > removedRow) l.rowNumber -= 1;
    }
    this.touch(line.reportId);
  }

  async addFileToLine(lineId: string, f: File): Promise<ExpenseLine> {
    const line = this.findLineForEdit(lineId);
    if (!checkReceiptFile(f.name, f.size).ok) return clone(line);
    line.receipts.push(await this.toReceipt(f));
    line.sameReceiptAsRow = null;
    this.touch(line.reportId);
    return clone(line);
  }

  async removeFileFromLine(lineId: string, receiptId: string): Promise<ExpenseLine> {
    await wait(LATENCY_MS);
    const line = this.findLineForEdit(lineId);
    line.receipts = line.receipts.filter((r) => r.id !== receiptId);
    this.touch(line.reportId);
    return clone(line);
  }

  async getOwnerOtherLines(reportId: number): Promise<LineRef[]> {
    const report = this.findReportForRead(reportId);
    return clone(
      this.store.lines
        .filter((l) => l.reportId !== reportId)
        .map((l) => ({ line: l, owner: this.store.reports.find((r) => r.id === l.reportId) }))
        .filter((x) => x.owner && x.owner.ownerEmail === report.ownerEmail)
        .map((x) => ({ line: x.line, reportNumber: x.owner!.reportNumber, ownerEmail: x.owner!.ownerEmail }))
    );
  }

  async submitReport(reportId: number, certificationText: string): Promise<Submission> {
    await wait(LATENCY_MS);
    const report = this.findReportForEdit(reportId);
    const lines = this.linesOf(reportId);
    const previous = this.store.submissions.filter((s) => s.reportId === reportId).sort((a, b) => b.submissionNumber - a.submissionNumber)[0];
    const prepared = prepareSubmission(report, lines, await this.getOwnerOtherLines(reportId), new Date(), previous ? previous.folderName : '', {
      text: certificationText,
      email: this.user.email
    });

    const submission: Submission = {
      ...prepared.submission,
      id: this.store.nextSubmissionId++,
      packageStatus: 'Ready',
      folderLink: '',
      packagedAt: '',
      errorMessage: ''
    };
    this.store.submissions.push(submission);
    this.store.csvBySubmission[submission.id] = prepared.csvContent;
    report.status = 'Submitted';
    report.submissionCount = submission.submissionNumber;
    report.submittedOn = submission.submittedOn;
    report.returnNote = '';
    report.lastChanged = submission.submittedOn;
    this.simulatePackaging(submission.id);
    return clone(submission);
  }

  async listSubmissionsForReport(reportId: number): Promise<Submission[]> {
    this.findReportForRead(reportId);
    return clone(this.store.submissions.filter((s) => s.reportId === reportId));
  }

  async getSubmissionCsv(submissionId: number): Promise<string> {
    const submission = this.store.submissions.find((s) => s.id === submissionId);
    if (!submission) throw new Error('Submission not found.');
    this.findReportForRead(submission.reportId);
    return this.store.csvBySubmission[submissionId] ?? '';
  }

  // ---- Administrator -----------------------------------------------------

  async listAllReports(): Promise<TravelReport[]> {
    this.requireAdmin();
    await wait(LATENCY_MS);
    return clone([...this.store.reports].sort(byLastChanged));
  }

  async listSubmissions(): Promise<Submission[]> {
    this.requireAdmin();
    return clone(this.store.submissions);
  }

  async listAllLineRefs(): Promise<LineRef[]> {
    this.requireAdmin();
    return clone(
      this.store.lines.map((l) => {
        const r = this.store.reports.find((x) => x.id === l.reportId)!;
        return { line: l, reportNumber: r.reportNumber, ownerEmail: r.ownerEmail };
      })
    );
  }

  async markProcessed(reportId: number): Promise<TravelReport> {
    this.requireAdmin();
    await wait(LATENCY_MS);
    const report = this.mustFindReport(reportId);
    if (report.status !== 'Submitted') throw new NotAllowedError('Only submitted reports can be marked processed.');
    report.status = 'Processed';
    report.processedOn = toLocalDateTime(new Date());
    report.processedBy = this.user.displayName;
    report.lastChanged = report.processedOn;
    return clone(report);
  }

  async returnReport(reportId: number, note: string): Promise<TravelReport> {
    this.requireAdmin();
    await wait(LATENCY_MS);
    const report = this.mustFindReport(reportId);
    if (report.status !== 'Submitted') throw new NotAllowedError('Only submitted reports can be returned.');
    report.status = 'Returned';
    report.returnNote = note;
    report.lastChanged = toLocalDateTime(new Date());
    return clone(report);
  }

  async retryPackaging(submissionId: number): Promise<Submission> {
    this.requireAdmin();
    const submission = this.store.submissions.find((s) => s.id === submissionId);
    if (!submission) throw new Error('Submission not found.');
    submission.packageStatus = 'Ready';
    submission.errorMessage = '';
    this.simulatePackaging(submission.id);
    return clone(submission);
  }

  // ---- Helpers -------------------------------------------------------------

  private simulatePackaging(submissionId: number): void {
    const step = (status: Submission['packageStatus'], after: number) =>
      setTimeout(() => {
        const s = this.store.submissions.find((x) => x.id === submissionId);
        if (!s) return;
        s.packageStatus = status;
        if (status === 'Packaged') {
          s.folderLink = `Accounting > Trips > Trips_To_Process > ${s.folderName}`;
          s.packagedAt = toLocalDateTime(new Date());
        }
      }, after);
    step('Processing', this.packagingDelayMs);
    step('Packaged', this.packagingDelayMs * 2);
  }

  private async toReceipt(f: File): Promise<ReceiptFile> {
    this.idCounter += 1;
    return {
      id: `upload-${Date.now()}-${this.idCounter}`,
      fileName: f.name,
      sizeBytes: f.size,
      fingerprint: await fingerprintFile(f),
      contentType: f.type,
      url: URL.createObjectURL(f)
    };
  }

  private newLine(reportId: number, fields: Partial<ExpenseLine>): ExpenseLine {
    this.idCounter += 1;
    const existing = this.linesOf(reportId);
    const rowNumber = existing.length + 1;
    return {
      id: `line-${Date.now()}-${this.idCounter}`,
      reportId,
      rowNumber,
      date: '',
      vendor: '',
      category: '',
      description: '',
      amountCents: null,
      paymentType: defaultPaymentType(existing),
      noReceiptReason: '',
      sameReceiptAsRow: null,
      receipts: [],
      suggested: [],
      ...fields
    };
  }

  private linesOf(reportId: number): ExpenseLine[] {
    return this.store.lines.filter((l) => l.reportId === reportId).sort((a, b) => a.rowNumber - b.rowNumber);
  }

  /** Records a change: the report's totals and last-changed time are kept current. */
  private touch(reportId: number): void {
    const report = this.store.reports.find((r) => r.id === reportId);
    if (!report) return;
    const totals = computeTotals(this.linesOf(reportId), activeTrips(report));
    report.totalReimburseCents = totals.reimburseCents;
    report.totalCompanyCents = totals.companyCents;
    report.totalTripCents = totals.tripCents;
    report.lastChanged = toLocalDateTime(new Date());
  }

  private mustFindReport(reportId: number): TravelReport {
    const report = this.store.reports.find((r) => r.id === reportId);
    if (!report) throw new Error('Report not found.');
    return report;
  }

  private findReportForRead(reportId: number): TravelReport {
    const report = this.mustFindReport(reportId);
    if (!this.user.isAdministrator && report.ownerEmail !== this.user.email) throw new NotAllowedError('Not your report.');
    return report;
  }

  private findReportForEdit(reportId: number): TravelReport {
    const report = this.mustFindReport(reportId);
    if (report.ownerEmail !== this.user.email) throw new NotAllowedError('Not your report.');
    if (!isEditable(report.status)) throw new NotAllowedError('This report is locked.');
    return report;
  }

  private findLineForEdit(lineId: string): ExpenseLine {
    const line = this.store.lines.find((l) => l.id === lineId);
    if (!line) throw new Error('Row not found.');
    this.findReportForEdit(line.reportId);
    return line;
  }

  private requireAdmin(): void {
    if (!this.user.isAdministrator) throw new NotAllowedError('Administrators only.');
  }
}

function byLastChanged(a: TravelReport, b: TravelReport): number {
  return b.lastChanged.localeCompare(a.lastChanged);
}

const SAMPLE_LISTS: [ListCheck['key'], string, string, string][] = [
  ['reports', 'Travel Reports', 'Lists/TravelReports', '00000000-0000-0000-0000-000000000001'],
  ['lines', 'Travel Expense Lines', 'Lists/TravelExpenseLines', '00000000-0000-0000-0000-000000000002'],
  ['submissions', 'Travel Submissions', 'Lists/TravelSubmissions', '00000000-0000-0000-0000-000000000003']
];

export function readySetup(): SetupStatus {
  return {
    ready: true,
    lists: SAMPLE_LISTS.map(([key, title, address, listId]) => ({
      key,
      title,
      exists: true,
      address,
      notOurs: false,
      listId,
      missingFields: [],
      missingChoices: [],
      unindexedFields: [],
      ownItemsOnly: true,
      versioning: true,
      attachments: true
    }))
  };
}

/** A new travel site before set-up, for the preview and tests. */
export function notSetUp(): SetupStatus {
  return {
    ready: false,
    lists: SAMPLE_LISTS.map(([key, title, address]) => ({
      key,
      title,
      exists: false,
      address,
      notOurs: false,
      listId: '',
      missingFields: [],
      missingChoices: [],
      unindexedFields: [],
      ownItemsOnly: false,
      versioning: false,
      attachments: false
    }))
  };
}
