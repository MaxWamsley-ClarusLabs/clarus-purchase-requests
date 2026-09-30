// The SharePoint implementation of TravelDataService: the three lists on the
// travel site (docs/DATA_MODEL.md), read and written as the signed-in user.
// It keeps the same rules as MockDataService. SharePoint itself enforces
// "own items only" for employees (D-003); the locking rules (D-042) are
// enforced here, because employees may still edit their own items directly
// in SharePoint (D-002).

import { defaultPaymentType } from '../../domain/defaults';
import { LineRef } from '../../domain/duplicates';
import { messages } from '../../domain/messages';
import { cleanFileName, reportNumber } from '../../domain/naming';
import { checkReceiptFile } from '../../domain/receipts';
import { isEditable } from '../../domain/statuses';
import { computeTotals } from '../../domain/totals';
import { activeTrips } from '../../domain/mileage';
import { CurrentUser, ExpenseLine, ReceiptFile, Submission, TravelReport } from '../../domain/types';
import { prepareSubmission } from '../../export/submission';
import { fingerprintFile } from '../files';
import { SetupStatus } from '../setup';
import { LineChanges, ReportChanges, ReportWithLines, TravelDataService } from '../TravelDataService';
import { SharePointRequestError, SpClient, odataString } from './http';
import {
  LineItem,
  ReportItem,
  StoredFingerprint,
  SubmissionItem,
  centsToDollars,
  lineFields,
  lineFromItem,
  reportFields,
  reportFromItem,
  submissionFields,
  submissionFromItem
} from './mapping';
import { LISTS } from './schema';
import { SiteSetup } from './SiteSetup';
import { FlowConfig, FlowMode, LIVE_DESTINATION, TEST_FOLDERS } from '../../export/flowPackage';

const REPORT_SELECT =
  '$select=Id,Title,ReportNumber,Destination,BusinessPurpose,TripPurpose,TripStart,TripEnd,HasMileage,MileageTrips,ReportStatus,ReturnNote,TotalReimburse,TotalCompany,TotalTrip,' +
  'SubmissionCount,SubmittedOn,ProcessedOn,Modified,AuthorId,Author/Title,Author/EMail,ProcessedBy/Title&$expand=Author,ProcessedBy';
const LINE_FIELDS =
  'Id,ReportId,RowNumber,ExpenseDate,Vendor,Category,Description,Amount,PaymentType,NoReceiptReason,SameReceiptAsRow,FileFingerprints,SuggestedFields';
const LINE_SELECT = `$select=${LINE_FIELDS},AttachmentFiles&$expand=AttachmentFiles`;
const SUBMISSION_SELECT =
  '$select=Id,ReportId,SubmissionNumber,PackageStatus,FolderName,PreviousFolderName,SubmitterName,SubmitterEmail,CertificationText,TripName,Destination,' +
  'TripStart,TripEnd,TripPurpose,SuggestedClass,TotalReimburse,TotalCompany,TotalTrip,ReceiptCount,RowsWithoutReceipt,EmailSubject,EmailSummary,FolderLink,' +
  'PackagedAt,ErrorMessage,Created,AttachmentFiles&$expand=AttachmentFiles';
const PAGE = '$top=5000';

/** SharePoint's "Manage web site" permission, held by site Owners (strategy section 9). */
const MANAGE_WEB = 31;

export class NotAllowedError extends Error {}

/** Whether a SharePoint permission set includes a permission (SP.PermissionKind). */
export function hasPermission(perms: { High: string | number; Low: string | number }, kind: number): boolean {
  const bit = kind - 1;
  const word = Number(bit < 32 ? perms.Low : perms.High);
  const position = bit < 32 ? bit : bit - 32;
  return Math.floor(word / Math.pow(2, position)) % 2 === 1;
}

export class SharePointDataService implements TravelDataService {
  private me: (CurrentUser & { id: number }) | undefined;
  private readonly setup: SiteSetup;

  constructor(
    private readonly sp: SpClient,
    private readonly now: () => Date = () => new Date()
  ) {
    this.setup = new SiteSetup(sp);
  }

  // ---- Who is signed in; set-up ---------------------------------------------

  async getCurrentUser(): Promise<CurrentUser> {
    const user = await this.currentUser();
    return { displayName: user.displayName, email: user.email, isAdministrator: user.isAdministrator };
  }

  getSetupStatus(): Promise<SetupStatus> {
    return this.setup.check();
  }

  async runSetup(progress: (step: string) => void): Promise<SetupStatus> {
    await this.requireAdmin();
    return this.setup.run(progress);
  }

  async receiptPreviewUrl(lineId: string, receipt: ReceiptFile): Promise<string> {
    const blob = await this.sp.getBlob(this.attachmentPath('lines', Number(lineId), receipt.fileName) + '/$value');
    // The stored file may not say what it is; give the browser the right type.
    const typed = blob.type === receipt.contentType ? blob : new Blob([blob], { type: receipt.contentType });
    return URL.createObjectURL(typed);
  }

  async getFlowSettings(mode: FlowMode, appPageUrl: string): Promise<FlowConfig> {
    const me = await this.requireAdmin();
    const setup = await this.setup.check();
    const submissions = setup.lists.find((l) => l.key === 'submissions');
    if (!setup.ready || !submissions) throw new Error(messages.flowNeedsLists);
    const destination = mode === 'live' ? this.sp.forSite(LIVE_DESTINATION.siteUrl) : this.sp;
    const libraryUrlName = mode === 'live' ? LIVE_DESTINATION.libraryUrlName : 'Shared Documents';
    // Read-only checks that the destination is there; nothing is created now.
    const library = destination.webServerRelativeUrl.replace(/\/$/, '') + '/' + libraryUrlName;
    try {
      await destination.getJson(`web/GetList('${odataString(library)}')?$select=Id`);
    } catch (e) {
      if (e instanceof SharePointRequestError && (e.status === 404 || e.status === 403)) throw new Error(messages.flowLibraryMissing(library));
      throw e;
    }
    if (mode === 'live') {
      const parent = `${library}/${LIVE_DESTINATION.existingParent}`;
      const found = await destination.getJson<{ value: boolean }>(`web/GetFolderByServerRelativeUrl('${odataString(parent)}')/Exists`);
      if (!found.value) throw new Error(messages.flowLibraryMissing(parent));
    }
    return {
      mode,
      travelSiteUrl: this.sp.webUrl,
      submissionsListId: submissions.listId,
      destinationSiteUrl: destination.webUrl,
      libraryUrlName,
      folders: mode === 'live' ? [...LIVE_DESTINATION.folders] : [...TEST_FOLDERS],
      adminEmail: me.email,
      appPageUrl
    };
  }

  // ---- Employee ----------------------------------------------------------------

  async listMyReports(): Promise<TravelReport[]> {
    const me = await this.currentUser();
    const items = await this.sp.getAll<ReportItem>(`${this.items('reports')}?${REPORT_SELECT}&$filter=AuthorId eq ${me.id}&${PAGE}`);
    return items.map(reportFromItem).sort(byLastChanged);
  }

  async getReport(reportId: number): Promise<ReportWithLines> {
    const report = await this.readReport(reportId);
    return { report, lines: await this.readLines(reportId) };
  }

  async createReport(): Promise<TravelReport> {
    await this.currentUser();
    const created = await this.sp.post<{ Id: number }>(this.items('reports'), {
      Title: '',
      ReportStatus: 'Draft',
      SubmissionCount: 0,
      TotalReimburse: 0,
      TotalCompany: 0,
      TotalTrip: 0
    });
    if (!created) throw new Error(messages.spOther(500));
    await this.sp.merge(this.item('reports', created.Id), { ReportNumber: reportNumber(created.Id) });
    return this.readReport(created.Id);
  }

  async updateReport(reportId: number, changes: ReportChanges): Promise<TravelReport> {
    await this.reportForEdit(reportId);
    await this.sp.merge(this.item('reports', reportId), reportFields(changes));
    if (changes.hasMileage !== undefined || changes.mileageTrips !== undefined) await this.updateTotals(reportId);
    return this.readReport(reportId);
  }

  async deleteReport(reportId: number): Promise<void> {
    const report = await this.reportForEdit(reportId);
    if (report.status !== 'Draft') throw new NotAllowedError('Only drafts can be deleted.');
    // Moved to the site's recycle bin, so a mistake can be undone there.
    for (const line of await this.readLines(reportId)) await this.sp.post(`${this.item('lines', Number(line.id))}/recycle()`);
    await this.sp.post(`${this.item('reports', reportId)}/recycle()`);
  }

  async addLinesFromFiles(reportId: number, files: File[]): Promise<ExpenseLine[]> {
    const report = await this.reportForEdit(reportId);
    const lines = await this.readLines(reportId);
    const added: ExpenseLine[] = [];
    for (const file of files) {
      if (!checkReceiptFile(file.name, file.size).ok) continue; // the screen reports refused files
      const id = await this.createLine(report, lines.length + added.length + 1, defaultPaymentType([...lines, ...added]));
      await this.attach(id, [], file);
      added.push(await this.readLine(id));
    }
    return added;
  }

  async addEmptyLine(reportId: number): Promise<ExpenseLine> {
    const report = await this.reportForEdit(reportId);
    const lines = await this.readLines(reportId);
    const id = await this.createLine(report, lines.length + 1, defaultPaymentType(lines));
    return this.readLine(id);
  }

  async updateLine(lineId: string, changes: LineChanges): Promise<ExpenseLine> {
    const line = await this.lineForEdit(lineId);
    await this.sp.merge(this.item('lines', Number(lineId)), lineFields(changes));
    const updated: ExpenseLine = { ...line, ...changes };
    if (changes.amountCents !== undefined || changes.paymentType !== undefined) await this.updateTotals(line.reportId);
    return updated;
  }

  async deleteLine(lineId: string): Promise<void> {
    const line = await this.lineForEdit(lineId);
    await this.sp.post(`${this.item('lines', Number(lineId))}/recycle()`);
    // Renumber the rows after it, and keep "same receipt as row" pointers correct.
    for (const l of await this.readLines(line.reportId)) {
      const changes: Partial<ExpenseLine> = {};
      if (l.sameReceiptAsRow === line.rowNumber) changes.sameReceiptAsRow = null;
      else if (l.sameReceiptAsRow !== null && l.sameReceiptAsRow > line.rowNumber) changes.sameReceiptAsRow = l.sameReceiptAsRow - 1;
      if (l.rowNumber > line.rowNumber) changes.rowNumber = l.rowNumber - 1;
      if (Object.keys(changes).length > 0) await this.sp.merge(this.item('lines', Number(l.id)), lineFields(changes));
    }
    await this.updateTotals(line.reportId);
  }

  async addFileToLine(lineId: string, file: File): Promise<ExpenseLine> {
    const line = await this.lineForEdit(lineId);
    if (!checkReceiptFile(file.name, file.size).ok) return line;
    await this.attach(Number(lineId), line.receipts, file);
    if (line.sameReceiptAsRow !== null) await this.sp.merge(this.item('lines', Number(lineId)), lineFields({ sameReceiptAsRow: null }));
    return this.readLine(Number(lineId));
  }

  async removeFileFromLine(lineId: string, receiptId: string): Promise<ExpenseLine> {
    const line = await this.lineForEdit(lineId);
    const receipt = line.receipts.find((r) => r.id === receiptId);
    if (!receipt) return line;
    await this.sp.remove(this.attachmentPath('lines', Number(lineId), receipt.fileName));
    const remaining = line.receipts.filter((r) => r.id !== receiptId);
    await this.sp.merge(this.item('lines', Number(lineId)), { FileFingerprints: JSON.stringify(remaining.map(storedPrint)) });
    return this.readLine(Number(lineId));
  }

  async getOwnerOtherLines(reportId: number): Promise<LineRef[]> {
    const report = await this.readReport(reportId);
    const reports = (await this.sp.getAll<ReportItem>(`${this.items('reports')}?${REPORT_SELECT}&${PAGE}`)).map(reportFromItem);
    const owned = new Map(reports.filter((r) => r.ownerEmail === report.ownerEmail && r.id !== reportId).map((r) => [r.id, r]));
    const lines = await this.sp.getAll<LineItem>(`${this.items('lines')}?$select=${LINE_FIELDS}&${PAGE}`);
    return lines
      .map(lineFromItem)
      .filter((l) => owned.has(l.reportId))
      .map((l) => ({ line: l, reportNumber: owned.get(l.reportId)!.reportNumber, ownerEmail: report.ownerEmail }));
  }

  async submitReport(reportId: number, certificationText: string): Promise<Submission> {
    const me = await this.currentUser();
    const report = await this.reportForEdit(reportId);
    const lines = await this.readLines(reportId);
    const others = await this.getOwnerOtherLines(reportId);
    const earlier = await this.readSubmissions(reportId, report.reportNumber);
    const number = report.submissionCount + 1;
    // An earlier attempt that stopped part-way never reached the flow; remove it.
    for (const stale of earlier.filter((s) => s.submissionNumber === number && s.packageStatus === 'Uploading')) {
      await this.sp.post(`${this.item('submissions', stale.id)}/recycle()`);
    }
    const previous = earlier.filter((s) => s.submissionNumber < number).sort((a, b) => b.submissionNumber - a.submissionNumber)[0];
    const now = this.now();
    const prepared = prepareSubmission(report, lines, others, now, previous ? previous.folderName : '', { text: certificationText, email: me.email });

    // 1. The submission, marked Uploading so the flow ignores it for now.
    const created = await this.sp.post<{ Id: number }>(this.items('submissions'), submissionFields(prepared.submission));
    if (!created) throw new Error(messages.spOther(500));
    // 2. The package files: the CSV and a copy of each receipt under its package name.
    await this.sp.postBinary(this.addAttachmentPath('submissions', created.Id, prepared.csvName), new Blob([prepared.csvContent], { type: 'text/csv' }));
    for (const copy of prepared.receiptCopies) {
      const source = lines.find((l) => l.id === copy.lineId)!.receipts.find((r) => r.id === copy.receiptId)!;
      const content = await this.sp.getBlob(this.attachmentPath('lines', Number(copy.lineId), source.fileName) + '/$value');
      await this.sp.postBinary(this.addAttachmentPath('submissions', created.Id, copy.packageName), content);
    }
    // 3. Lock the report, then 4. hand the submission to the flow. If step 4
    // fails, the administrator sees it under Needs attention and can retry.
    await this.sp.merge(this.item('reports', reportId), {
      ReportStatus: 'Submitted',
      SubmissionCount: number,
      SubmittedOn: now.toISOString(),
      ReturnNote: ''
    });
    await this.sp.merge(this.item('submissions', created.Id), { PackageStatus: 'Ready' });
    return this.readSubmission(created.Id, report.reportNumber);
  }

  async listSubmissionsForReport(reportId: number): Promise<Submission[]> {
    const report = await this.readReport(reportId);
    return this.readSubmissions(reportId, report.reportNumber);
  }

  async getSubmissionCsv(submissionId: number): Promise<string> {
    const item = await this.sp.getJson<SubmissionItem>(`${this.item('submissions', submissionId)}?${SUBMISSION_SELECT}`);
    const csv = (item.AttachmentFiles ?? []).find((a) => /_Expenses\.csv$/i.test(a.FileName));
    return csv ? this.sp.getText(this.attachmentPath('submissions', submissionId, csv.FileName) + '/$value') : '';
  }

  // ---- Administrator ---------------------------------------------------------

  async listAllReports(): Promise<TravelReport[]> {
    await this.requireAdmin();
    return (await this.sp.getAll<ReportItem>(`${this.items('reports')}?${REPORT_SELECT}&${PAGE}`)).map(reportFromItem).sort(byLastChanged);
  }

  async listSubmissions(): Promise<Submission[]> {
    await this.requireAdmin();
    const numbers = await this.reportNumbers();
    const items = await this.sp.getAll<SubmissionItem>(`${this.items('submissions')}?${SUBMISSION_SELECT}&${PAGE}`);
    return items.map((i) => submissionFromItem(i, numbers.get(Number(i.ReportId)) ?? ''));
  }

  async listAllLineRefs(): Promise<LineRef[]> {
    await this.requireAdmin();
    const reports = new Map((await this.listAllReports()).map((r) => [r.id, r]));
    const lines = await this.sp.getAll<LineItem>(`${this.items('lines')}?$select=${LINE_FIELDS}&${PAGE}`);
    return lines
      .map(lineFromItem)
      .filter((l) => reports.has(l.reportId))
      .map((l) => ({ line: l, reportNumber: reports.get(l.reportId)!.reportNumber, ownerEmail: reports.get(l.reportId)!.ownerEmail }));
  }

  async markProcessed(reportId: number): Promise<TravelReport> {
    const me = await this.requireAdmin();
    const report = await this.readReport(reportId);
    if (report.status !== 'Submitted') throw new NotAllowedError('Only submitted reports can be marked processed.');
    await this.sp.merge(this.item('reports', reportId), { ReportStatus: 'Processed', ProcessedOn: this.now().toISOString(), ProcessedById: me.id });
    return this.readReport(reportId);
  }

  async returnReport(reportId: number, note: string): Promise<TravelReport> {
    await this.requireAdmin();
    const report = await this.readReport(reportId);
    if (report.status !== 'Submitted') throw new NotAllowedError('Only submitted reports can be returned.');
    await this.sp.merge(this.item('reports', reportId), { ReportStatus: 'Returned', ReturnNote: note });
    return this.readReport(reportId);
  }

  async retryPackaging(submissionId: number): Promise<Submission> {
    await this.requireAdmin();
    await this.sp.merge(this.item('submissions', submissionId), { PackageStatus: 'Ready', ErrorMessage: '' });
    const item = await this.sp.getJson<SubmissionItem>(`${this.item('submissions', submissionId)}?${SUBMISSION_SELECT}`);
    return submissionFromItem(item, (await this.reportNumbers()).get(Number(item.ReportId)) ?? '');
  }

  // ---- Helpers ---------------------------------------------------------------

  private async currentUser(): Promise<CurrentUser & { id: number }> {
    if (this.me) return this.me;
    const user = await this.sp.getJson<{ Id: number; Title: string; Email: string }>('web/currentuser?$select=Id,Title,Email');
    const perms = await this.sp.getJson<{ High: string; Low: string }>('web/effectiveBasePermissions');
    this.me = { id: user.Id, displayName: user.Title, email: (user.Email || '').toLowerCase(), isAdministrator: hasPermission(perms, MANAGE_WEB) };
    return this.me;
  }

  private async requireAdmin(): Promise<CurrentUser & { id: number }> {
    const me = await this.currentUser();
    if (!me.isAdministrator) throw new NotAllowedError('Administrators only.');
    return me;
  }

  private items(list: keyof typeof LISTS): string {
    return `${this.sp.listPath(LISTS[list].urlName)}/items`;
  }

  private item(list: keyof typeof LISTS, id: number): string {
    return `${this.items(list)}(${id})`;
  }

  private attachmentPath(list: keyof typeof LISTS, id: number, fileName: string): string {
    return `${this.item(list, id)}/AttachmentFiles('${odataString(fileName)}')`;
  }

  private addAttachmentPath(list: keyof typeof LISTS, id: number, fileName: string): string {
    return `${this.item(list, id)}/AttachmentFiles/add(FileName='${odataString(fileName)}')`;
  }

  private async readReport(reportId: number): Promise<TravelReport> {
    try {
      return reportFromItem(await this.sp.getJson<ReportItem>(`${this.item('reports', reportId)}?${REPORT_SELECT}`));
    } catch (e) {
      // Employees cannot see other people's items at all (D-003).
      if (e instanceof SharePointRequestError && e.status === 404) throw new NotAllowedError(messages.spNotFound);
      throw e;
    }
  }

  private async readLines(reportId: number): Promise<ExpenseLine[]> {
    const items = await this.sp.getAll<LineItem>(`${this.items('lines')}?${LINE_SELECT}&$filter=ReportId eq ${reportId}&$orderby=RowNumber&${PAGE}`);
    return items.map(lineFromItem).sort((a, b) => a.rowNumber - b.rowNumber);
  }

  private async readLine(lineId: number): Promise<ExpenseLine> {
    return lineFromItem(await this.sp.getJson<LineItem>(`${this.item('lines', lineId)}?${LINE_SELECT}`));
  }

  private async readSubmission(id: number, reportNo: string): Promise<Submission> {
    return submissionFromItem(await this.sp.getJson<SubmissionItem>(`${this.item('submissions', id)}?${SUBMISSION_SELECT}`), reportNo);
  }

  private async readSubmissions(reportId: number, reportNo: string): Promise<Submission[]> {
    const items = await this.sp.getAll<SubmissionItem>(`${this.items('submissions')}?${SUBMISSION_SELECT}&$filter=ReportId eq ${reportId}&${PAGE}`);
    return items.map((i) => submissionFromItem(i, reportNo));
  }

  private async reportNumbers(): Promise<Map<number, string>> {
    const items = await this.sp.getAll<{ Id: number; ReportNumber: string | null }>(`${this.items('reports')}?$select=Id,ReportNumber&${PAGE}`);
    return new Map(items.map((i) => [i.Id, i.ReportNumber ?? '']));
  }

  /** A report the signed-in employee may change: their own, and not locked (D-042). */
  private async reportForEdit(reportId: number): Promise<TravelReport> {
    const me = await this.currentUser();
    const report = await this.readReport(reportId);
    if (report.ownerEmail !== me.email) throw new NotAllowedError('Not your report.');
    if (!isEditable(report.status)) throw new NotAllowedError('This report is locked.');
    return report;
  }

  private async lineForEdit(lineId: string): Promise<ExpenseLine> {
    const line = await this.readLine(Number(lineId));
    await this.reportForEdit(line.reportId);
    return line;
  }

  private async createLine(report: TravelReport, rowNumber: number, paymentType: ExpenseLine['paymentType']): Promise<number> {
    const created = await this.sp.post<{ Id: number }>(this.items('lines'), {
      Title: `${report.reportNumber} row ${rowNumber}`,
      ReportId: report.id,
      RowNumber: rowNumber,
      ...lineFields({ paymentType })
    });
    if (!created) throw new Error(messages.spOther(500));
    return created.Id;
  }

  /** Stores a receipt exactly as uploaded, under a name SharePoint accepts, with its fingerprint. */
  private async attach(lineId: number, existing: readonly ReceiptFile[], file: File): Promise<void> {
    const taken = new Set(existing.map((r) => r.fileName.toLowerCase()));
    const name = uniqueName(cleanFileName(file.name), taken);
    await this.sp.postBinary(this.addAttachmentPath('lines', lineId, name), file);
    const prints = [...existing.map(storedPrint), { fileName: name, sizeBytes: file.size, fingerprint: await fingerprintFile(file) }];
    await this.sp.merge(this.item('lines', lineId), { FileFingerprints: JSON.stringify(prints) });
  }

  /** Keeps the report's stored totals current, for the report lists (DATA_MODEL.md). */
  private async updateTotals(reportId: number): Promise<void> {
    const report = await this.readReport(reportId);
    const totals = computeTotals(await this.readLines(reportId), activeTrips(report));
    await this.sp.merge(this.item('reports', reportId), {
      TotalReimburse: centsToDollars(totals.reimburseCents),
      TotalCompany: centsToDollars(totals.companyCents),
      TotalTrip: centsToDollars(totals.tripCents)
    });
  }
}

function storedPrint(r: ReceiptFile): StoredFingerprint {
  return { fileName: r.fileName, sizeBytes: r.sizeBytes, fingerprint: r.fingerprint };
}

/** receipt.pdf, then receipt (2).pdf and so on, if a row already has that name. */
export function uniqueName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name.toLowerCase())) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})${ext}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

function byLastChanged(a: TravelReport, b: TravelReport): number {
  return b.lastChanged.localeCompare(a.lastChanged);
}
