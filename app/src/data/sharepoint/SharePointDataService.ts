// The SharePoint implementation of PurchaseDataService: the three lists on the
// Forms and Apps site (docs/DATA_MODEL.md), read and written as the signed-in
// user. It keeps the same rules as MockDataService. SharePoint itself enforces
// "own items only" for employees (travel D-003); the locking rules (P-027) and
// the approver rules (P-020) are enforced here, because employees may still
// edit their own items directly in SharePoint (travel D-002).

import { defaultPaidBy, latestDepartment } from '../../domain/defaults';
import { LineRef } from '../../domain/duplicates';
import { messages } from '../../domain/messages';
import { cleanFileName, requestNumber } from '../../domain/naming';
import { EMPTY_APPROVAL, groupsForApproved } from '../../domain/purchaseRules';
import { checkReceiptFile } from '../../domain/receipts';
import { isEditable } from '../../domain/statuses';
import { computeTotals } from '../../domain/totals';
import { AttachedFile, CurrentUser, FileKind, PurchaseLine, PurchaseRequest, Submission } from '../../domain/types';
import { FlowConfig, FlowMode, LIVE_DESTINATION, TEST_FOLDERS } from '../../export/flowPackage';
import { prepareApprovalRequest, prepareSubmission } from '../../export/submission';
import { fingerprintFile, uniqueName } from '../files';
import { ApproveOptions, CategoryChoice, LineChanges, PurchaseDataService, RequestChanges, RequestWithLines } from '../PurchaseDataService';
import { SetupStatus } from '../setup';
import { SharePointRequestError, SpClient, odataString } from './http';
import {
  LineItem,
  RequestItem,
  RequestWrite,
  SubmissionItem,
  lineFields,
  lineFromItem,
  requestFields,
  requestFromItem,
  storedFingerprint,
  submissionFields,
  submissionFromItem
} from './mapping';
import { LISTS } from './schema';
import {
  NotAllowedError,
  applyLineChanges,
  canConfirmCategories,
  categoryUpdates,
  changesAfterDelete,
  nextRowNumber,
  notAllowed,
  previousFolderName,
  returnStageFor,
  sortSubmissionsForRequest,
  staleUploading
} from './serviceRules';
import { SiteSetup } from './SiteSetup';

export { NotAllowedError };

const REQUEST_SELECT =
  '$select=Id,Title,RequestNumber,Department,ProjectCode,RequestStatus,ReturnNote,ReturnStage,TotalReimburse,TotalCompany,TotalRequest,SubmissionCount,ApprovalRounds,' +
  'SentForApprovalOn,BoughtBeforeApproval,ApprovalRecord,ApprovalNote,ApprovedOn,SubmittedOn,ProcessedOn,Modified,AuthorId,Author/Title,Author/EMail,' +
  'ApprovedBy/Title,ApprovedBy/EMail,ProcessedBy/Title&$expand=Author,ApprovedBy,ProcessedBy';
const LINE_FIELDS =
  'Id,RequestId,RowNumber,PurchaseDate,Vendor,Description,Category,CategoryOther,CategoryConfirmedBy,Amount,PaidBy,NoQuoteReason,NoReceiptReason,SameReceiptAsRow,' +
  'FileFingerprints,SuggestedFields';
const LINE_SELECT = `$select=${LINE_FIELDS},AttachmentFiles&$expand=AttachmentFiles`;
const SUBMISSION_SELECT =
  '$select=Id,RequestId,SubmissionType,SubmissionNumber,PackageStatus,FolderName,PreviousFolderName,SubmitterName,SubmitterEmail,CertificationText,BusinessPurpose,' +
  'Department,ProjectCode,PurchaseDates,TotalReimburse,TotalCompany,TotalRequest,ReceiptCount,QuoteCount,RowsWithoutReceipt,BoughtBeforeApproval,ApprovedBy,ApprovedOn,' +
  'EmailSubject,EmailSummary,FolderLink,PackagedAt,ErrorMessage,Created,AttachmentFiles&$expand=AttachmentFiles';
const PAGE = '$top=5000';

/** The site's Owners group: the approvers (P-020). Reading it needs a permission ordinary members may not have. */
const OWNERS_PATH = 'web/AssociatedOwnerGroup/users?$select=Title,Email,PrincipalType';
/** SP.PrincipalType.User; the Owners group can also hold security groups. */
const PRINCIPAL_USER = 1;

/** SharePoint's "Manage web site" permission, held by site Owners (strategy section 9). */
const MANAGE_WEB = 31;

/** Whether a SharePoint permission set includes a permission (SP.PermissionKind). */
export function hasPermission(perms: { High: string | number; Low: string | number }, kind: number): boolean {
  const bit = kind - 1;
  const word = Number(bit < 32 ? perms.Low : perms.High);
  const position = bit < 32 ? bit : bit - 32;
  return Math.floor(word / Math.pow(2, position)) % 2 === 1;
}

/** A person in the Owners group, as far as the app needs to know. */
interface Owner {
  title: string;
  email: string;
}

type Signed = CurrentUser & { id: number };
type ListKey = keyof typeof LISTS;

export class SharePointDataService implements PurchaseDataService {
  private me: Signed | undefined;
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

  async filePreviewUrl(lineId: string, file: AttachedFile): Promise<string> {
    const blob = await this.sp.getBlob(this.attachmentPath('lines', Number(lineId), file.fileName) + '/$value');
    // The stored file may not say what it is; give the browser the right type.
    const typed = blob.type === file.contentType ? blob : new Blob([blob], { type: file.contentType });
    return URL.createObjectURL(typed);
  }

  async listApprovers(): Promise<string[]> {
    return (await this.readOwners()).map((o) => o.title).filter((title) => title !== '');
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
    // The approval email goes to the Owners, read now and fixed in the package (P-018).
    const owners = (await this.readOwners()).map((o) => o.email).filter(isEmailAddress);
    const approverEmails = owners.filter((email, i) => owners.indexOf(email) === i);
    return {
      mode,
      siteUrl: this.sp.webUrl,
      submissionsListId: submissions.listId,
      destinationSiteUrl: destination.webUrl,
      libraryUrlName,
      folders: mode === 'live' ? [...LIVE_DESTINATION.folders] : [...TEST_FOLDERS],
      adminEmail: me.email,
      approverEmails: approverEmails.length > 0 ? approverEmails : [me.email].filter(isEmailAddress),
      appPageUrl
    };
  }

  // ---- Employee ----------------------------------------------------------------

  async listMyRequests(): Promise<PurchaseRequest[]> {
    const me = await this.currentUser();
    const items = await this.sp.getAll<RequestItem>(`${this.items('requests')}?${REQUEST_SELECT}&$filter=AuthorId eq ${me.id}&${PAGE}`);
    return items.map(requestFromItem).sort(byLastChanged);
  }

  async getRequest(requestId: number): Promise<RequestWithLines> {
    const request = await this.readRequest(requestId);
    return { request, lines: await this.readLines(requestId) };
  }

  async createRequest(): Promise<PurchaseRequest> {
    await this.currentUser();
    const department = latestDepartment(await this.listMyRequests());
    const created = await this.sp.post<{ Id: number }>(
      this.items('requests'),
      requestFields({
        businessPurpose: '',
        department,
        status: 'Draft',
        submissionCount: 0,
        approvalRounds: 0,
        totalReimburseCents: 0,
        totalCompanyCents: 0,
        totalRequestCents: 0,
        boughtBeforeApproval: false,
        approval: EMPTY_APPROVAL
      })
    );
    if (!created) throw new Error(messages.spOther(500));
    await this.sp.merge(this.item('requests', created.Id), { RequestNumber: requestNumber(created.Id) });
    return this.readRequest(created.Id);
  }

  async updateRequest(requestId: number, changes: RequestChanges): Promise<PurchaseRequest> {
    await this.requestForEdit(requestId);
    // Only the three header fields can be changed here, whatever else is passed.
    await this.sp.merge(
      this.item('requests', requestId),
      requestFields({ businessPurpose: changes.businessPurpose, department: changes.department, projectCode: changes.projectCode })
    );
    return this.readRequest(requestId);
  }

  async deleteRequest(requestId: number): Promise<void> {
    const request = await this.requestForEdit(requestId);
    if (request.status !== 'Draft') throw new NotAllowedError(notAllowed.draftsOnly);
    // Moved to the site's recycle bin, so a mistake can be undone there. A draft
    // has no submissions except one that stopped part-way while being sent.
    for (const line of await this.readLines(requestId)) await this.recycle('lines', Number(line.id));
    for (const submission of await this.readSubmissions(requestId, request.requestNumber)) await this.recycle('submissions', submission.id);
    await this.recycle('requests', requestId);
  }

  async addLinesFromFiles(requestId: number, files: File[], kind: FileKind): Promise<PurchaseLine[]> {
    const request = await this.requestForEdit(requestId);
    const lines = await this.readLines(requestId);
    const added: PurchaseLine[] = [];
    for (const file of files) {
      if (!checkReceiptFile(file.name, file.size).ok) continue; // the screen reports refused files
      const soFar = [...lines, ...added];
      const id = await this.createLine(request, nextRowNumber(soFar), defaultPaidBy(soFar));
      await this.attach(id, [], file, kind);
      added.push(await this.readLine(id));
    }
    return added;
  }

  async addEmptyLine(requestId: number): Promise<PurchaseLine> {
    const request = await this.requestForEdit(requestId);
    const lines = await this.readLines(requestId);
    const id = await this.createLine(request, nextRowNumber(lines), defaultPaidBy(lines));
    return this.readLine(id);
  }

  async updateLine(lineId: string, changes: LineChanges): Promise<PurchaseLine> {
    const { line } = await this.lineForEdit(lineId);
    const applied = applyLineChanges(line, changes);
    const columns = lineFields(applied.written);
    if (Object.keys(columns).length > 0) await this.sp.merge(this.item('lines', Number(lineId)), columns);
    if (applied.written.amountCents !== undefined || applied.written.paidBy !== undefined) await this.updateTotals(line.requestId);
    return applied.line;
  }

  async deleteLine(lineId: string): Promise<void> {
    const { line, request } = await this.lineForEdit(lineId);
    await this.recycle('lines', Number(lineId));
    // Renumber the rows after it, and keep "same receipt as row" pointers correct.
    for (const [id, change] of changesAfterDelete(await this.readLines(line.requestId), line.rowNumber)) {
      const columns = lineFields(change);
      if (change.rowNumber !== undefined) columns.Title = `${request.requestNumber} row ${change.rowNumber}`;
      await this.sp.merge(this.item('lines', Number(id)), columns);
    }
    await this.updateTotals(line.requestId);
  }

  async addFileToLine(lineId: string, file: File, kind: FileKind): Promise<PurchaseLine> {
    const { line } = await this.lineForEdit(lineId);
    if (!checkReceiptFile(file.name, file.size).ok) return line;
    await this.attach(Number(lineId), line.files, file, kind);
    // A receipt of its own replaces "same receipt as row N"; a quote never does (P-021).
    if (kind === 'receipt' && line.sameReceiptAsRow !== null) await this.sp.merge(this.item('lines', Number(lineId)), lineFields({ sameReceiptAsRow: null }));
    return this.readLine(Number(lineId));
  }

  async removeFileFromLine(lineId: string, fileId: string): Promise<PurchaseLine> {
    const { line } = await this.lineForEdit(lineId);
    const file = line.files.find((f) => f.id === fileId);
    if (!file) return line;
    await this.sp.remove(this.attachmentPath('lines', Number(lineId), file.fileName));
    const remaining = line.files.filter((f) => f.id !== fileId);
    await this.sp.merge(this.item('lines', Number(lineId)), { FileFingerprints: JSON.stringify(remaining.map(storedFingerprint)) });
    return this.readLine(Number(lineId));
  }

  async getOwnerOtherLines(requestId: number): Promise<LineRef[]> {
    const request = await this.readRequest(requestId);
    const requests = (await this.sp.getAll<RequestItem>(`${this.items('requests')}?${REQUEST_SELECT}&${PAGE}`)).map(requestFromItem);
    const owned = new Map(requests.filter((r) => r.ownerEmail === request.ownerEmail && r.id !== requestId).map((r) => [r.id, r]));
    const lines = await this.sp.getAll<LineItem>(`${this.items('lines')}?$select=${LINE_FIELDS}&${PAGE}`);
    return lines
      .map(lineFromItem)
      .filter((l) => owned.has(l.requestId))
      .map((l) => ({ line: l, requestNumber: owned.get(l.requestId)!.requestNumber, ownerEmail: request.ownerEmail }));
  }

  async sendForApproval(requestId: number): Promise<Submission> {
    const me = await this.currentUser();
    const request = await this.requestForEdit(requestId);
    const lines = await this.readLines(requestId);
    const others = await this.getOwnerOtherLines(requestId);
    const earlier = await this.readSubmissions(requestId, request.requestNumber);
    const round = request.approvalRounds + 1;
    // An earlier attempt that stopped part-way never reached the flow; remove it.
    for (const stale of staleUploading(earlier, 'approval', round)) await this.recycle('submissions', stale.id);
    const now = this.now();
    const prepared = prepareApprovalRequest(request, lines, others, now, { name: me.displayName, email: me.email }, round);

    // 1. The approval request, marked Uploading so the flow ignores it for now. It has no files.
    const created = await this.sp.post<{ Id: number }>(this.items('submissions'), submissionFields(prepared.submission));
    if (!created) throw new Error(messages.spOther(500));
    // 2. Lock the request, recording what was sent. Then 3. hand the approval request to the
    // flow. If step 3 fails, the administrator sees it under Needs attention and can retry.
    await this.sp.merge(
      this.item('requests', requestId),
      requestFields({
        status: 'Awaiting approval',
        approvalRounds: round,
        sentForApprovalOn: now.toISOString(),
        boughtBeforeApproval: prepared.boughtBefore,
        approval: { sent: prepared.sentGroups, approved: [] },
        returnNote: '',
        returnStage: '',
        approvedOn: null,
        approvedById: null,
        approvalNote: ''
      })
    );
    await this.sp.merge(this.item('submissions', created.Id), { PackageStatus: 'Ready' });
    return this.readSubmission(created.Id, request.requestNumber);
  }

  async submitRequest(requestId: number, certificationText: string): Promise<Submission> {
    const me = await this.currentUser();
    const request = await this.requestForEdit(requestId);
    const lines = await this.readLines(requestId);
    const others = await this.getOwnerOtherLines(requestId);
    const earlier = await this.readSubmissions(requestId, request.requestNumber);
    const number = request.submissionCount + 1;
    // An earlier attempt that stopped part-way never reached the flow; remove it.
    for (const stale of staleUploading(earlier, 'package', number)) await this.recycle('submissions', stale.id);
    const now = this.now();
    const prepared = prepareSubmission(request, lines, others, now, previousFolderName(earlier, number), { text: certificationText, email: me.email });

    // 1. The submission, marked Uploading so the flow ignores it for now.
    const created = await this.sp.post<{ Id: number }>(this.items('submissions'), submissionFields(prepared.submission));
    if (!created) throw new Error(messages.spOther(500));
    // 2. The package files: the CSV, and a copy of each receipt and quote under its package name.
    await this.sp.postBinary(this.addAttachmentPath('submissions', created.Id, prepared.csvName), new Blob([prepared.csvContent], { type: 'text/csv' }));
    for (const copy of prepared.files) {
      const source = lines.find((l) => l.id === copy.lineId)!.files.find((f) => f.id === copy.fileId)!;
      const content = await this.sp.getBlob(this.attachmentPath('lines', Number(copy.lineId), source.fileName) + '/$value');
      await this.sp.postBinary(this.addAttachmentPath('submissions', created.Id, copy.packageName), content);
    }
    // 3. Lock the request, then 4. hand the submission to the flow. If step 4
    // fails, the administrator sees it under Needs attention and can retry.
    await this.sp.merge(
      this.item('requests', requestId),
      requestFields({ status: 'Submitted', submissionCount: number, submittedOn: now.toISOString(), returnNote: '', returnStage: '' })
    );
    await this.sp.merge(this.item('submissions', created.Id), { PackageStatus: 'Ready' });
    return this.readSubmission(created.Id, request.requestNumber);
  }

  async listSubmissionsForRequest(requestId: number): Promise<Submission[]> {
    const request = await this.readRequest(requestId);
    return sortSubmissionsForRequest(await this.readSubmissions(requestId, request.requestNumber));
  }

  async getSubmissionCsv(submissionId: number): Promise<string> {
    const item = await this.readSubmissionItem(submissionId);
    const csv = (item.AttachmentFiles ?? []).find((a) => /_Purchases\.csv$/i.test(a.FileName));
    return csv ? this.sp.getText(this.attachmentPath('submissions', submissionId, csv.FileName) + '/$value') : '';
  }

  // ---- Approver and administrator ---------------------------------------------------

  async listAllRequests(): Promise<PurchaseRequest[]> {
    await this.requireAdmin();
    return (await this.sp.getAll<RequestItem>(`${this.items('requests')}?${REQUEST_SELECT}&${PAGE}`)).map(requestFromItem).sort(byLastChanged);
  }

  async listSubmissions(): Promise<Submission[]> {
    await this.requireAdmin();
    const numbers = await this.requestNumbers();
    const items = await this.sp.getAll<SubmissionItem>(`${this.items('submissions')}?${SUBMISSION_SELECT}&${PAGE}`);
    return items.map((i) => submissionFromItem(i, numbers.get(Number(i.RequestId)) ?? ''));
  }

  async listAllLineRefs(): Promise<LineRef[]> {
    await this.requireAdmin();
    const requests = new Map((await this.listAllRequests()).map((r) => [r.id, r]));
    const lines = await this.sp.getAll<LineItem>(`${this.items('lines')}?$select=${LINE_FIELDS}&${PAGE}`);
    return lines
      .map(lineFromItem)
      .filter((l) => requests.has(l.requestId))
      .map((l) => ({ line: l, requestNumber: requests.get(l.requestId)!.requestNumber, ownerEmail: requests.get(l.requestId)!.ownerEmail }));
  }

  async approveRequest(requestId: number, options: ApproveOptions): Promise<PurchaseRequest> {
    const me = await this.requireAdmin();
    const request = await this.readRequest(requestId);
    if (request.status !== 'Awaiting approval') throw new NotAllowedError(notAllowed.approveWhen);
    // Approving confirms every row's category as shown, with the changes given.
    const lines = await this.confirmCategoriesOn(requestId, options.categories, me.displayName);
    const approved = groupsForApproved(lines, request.approval.sent);
    await this.sp.merge(
      this.item('requests', requestId),
      requestFields({
        status: 'Approved',
        approval: { sent: request.approval.sent, approved },
        approvedOn: this.now().toISOString(),
        approvedById: me.id,
        approvalNote: options.note,
        returnNote: '',
        returnStage: ''
      })
    );
    return this.readRequest(requestId);
  }

  async returnRequest(requestId: number, note: string): Promise<PurchaseRequest> {
    await this.requireAdmin();
    const request = await this.readRequest(requestId);
    const stage = returnStageFor(request.status);
    if (!stage) throw new NotAllowedError(notAllowed.returnWhen);
    // A return at the approval step takes the approval back; one at processing keeps it (P-027).
    const write: RequestWrite =
      stage === 'approval'
        ? {
            status: 'Returned',
            returnNote: note,
            returnStage: stage,
            approval: { sent: request.approval.sent, approved: [] },
            approvedOn: null,
            approvedById: null,
            approvalNote: ''
          }
        : { status: 'Returned', returnNote: note, returnStage: stage };
    await this.sp.merge(this.item('requests', requestId), requestFields(write));
    return this.readRequest(requestId);
  }

  async confirmCategories(requestId: number, changes: Record<string, CategoryChoice>): Promise<PurchaseLine[]> {
    const me = await this.requireAdmin();
    const request = await this.readRequest(requestId);
    if (!canConfirmCategories(request.status)) throw new NotAllowedError(notAllowed.confirmWhen);
    return this.confirmCategoriesOn(requestId, changes, me.displayName);
  }

  async markProcessed(requestId: number): Promise<PurchaseRequest> {
    const me = await this.requireAdmin();
    const request = await this.readRequest(requestId);
    if (request.status !== 'Submitted') throw new NotAllowedError(notAllowed.processWhen);
    await this.sp.merge(this.item('requests', requestId), requestFields({ status: 'Processed', processedOn: this.now().toISOString(), processedById: me.id }));
    return this.readRequest(requestId);
  }

  async retryPackaging(submissionId: number): Promise<Submission> {
    await this.requireAdmin();
    const before = await this.readSubmissionItem(submissionId);
    await this.sp.merge(this.item('submissions', submissionId), { PackageStatus: 'Ready', ErrorMessage: '' });
    const item = await this.readSubmissionItem(submissionId);
    return submissionFromItem(item, (await this.requestNumbers()).get(Number(before.RequestId)) ?? '');
  }

  // ---- Helpers ---------------------------------------------------------------

  private async currentUser(): Promise<Signed> {
    if (this.me) return this.me;
    const user = await this.sp.getJson<{ Id: number; Title: string; Email: string }>('web/currentuser?$select=Id,Title,Email');
    const perms = await this.sp.getJson<{ High: string; Low: string }>('web/effectiveBasePermissions');
    this.me = { id: user.Id, displayName: user.Title, email: (user.Email || '').toLowerCase(), isAdministrator: hasPermission(perms, MANAGE_WEB) };
    return this.me;
  }

  private async requireAdmin(): Promise<Signed> {
    const me = await this.currentUser();
    if (!me.isAdministrator) throw new NotAllowedError(notAllowed.administratorsOnly);
    return me;
  }

  /**
   * The people in the site's Owners group. Empty when it cannot be read, which
   * is the usual answer for an employee (Unverified, strategy section 17).
   */
  private async readOwners(): Promise<Owner[]> {
    try {
      const entries = await this.sp.getAll<{ Title?: unknown; Email?: unknown; PrincipalType?: unknown }>(OWNERS_PATH);
      return entries
        .filter((e) => e.PrincipalType === PRINCIPAL_USER)
        .map((e) => ({ title: typeof e.Title === 'string' ? e.Title.trim() : '', email: typeof e.Email === 'string' ? e.Email.trim().toLowerCase() : '' }));
    } catch {
      return [];
    }
  }

  private items(list: ListKey): string {
    return `${this.sp.listPath(LISTS[list].urlName)}/items`;
  }

  private item(list: ListKey, id: number): string {
    return `${this.items(list)}(${id})`;
  }

  private attachmentPath(list: ListKey, id: number, fileName: string): string {
    return `${this.item(list, id)}/AttachmentFiles('${odataString(fileName)}')`;
  }

  private addAttachmentPath(list: ListKey, id: number, fileName: string): string {
    return `${this.item(list, id)}/AttachmentFiles/add(FileName='${odataString(fileName)}')`;
  }

  private async recycle(list: ListKey, id: number): Promise<void> {
    await this.sp.post(`${this.item(list, id)}/recycle()`);
  }

  /** Employees cannot see other people's items at all (travel D-003), so a missing item and someone else's look the same. */
  private async notFoundAsNotAllowed<T>(read: () => Promise<T>): Promise<T> {
    try {
      return await read();
    } catch (e) {
      if (e instanceof SharePointRequestError && e.status === 404) throw new NotAllowedError(messages.spNotFound);
      throw e;
    }
  }

  private readRequest(requestId: number): Promise<PurchaseRequest> {
    return this.notFoundAsNotAllowed(async () => requestFromItem(await this.sp.getJson<RequestItem>(`${this.item('requests', requestId)}?${REQUEST_SELECT}`)));
  }

  private async readLines(requestId: number): Promise<PurchaseLine[]> {
    const items = await this.sp.getAll<LineItem>(`${this.items('lines')}?${LINE_SELECT}&$filter=RequestId eq ${requestId}&$orderby=RowNumber&${PAGE}`);
    return items.map(lineFromItem).sort((a, b) => a.rowNumber - b.rowNumber);
  }

  private readLine(lineId: number): Promise<PurchaseLine> {
    return this.notFoundAsNotAllowed(async () => lineFromItem(await this.sp.getJson<LineItem>(`${this.item('lines', lineId)}?${LINE_SELECT}`)));
  }

  private readSubmissionItem(submissionId: number): Promise<SubmissionItem> {
    return this.notFoundAsNotAllowed(() => this.sp.getJson<SubmissionItem>(`${this.item('submissions', submissionId)}?${SUBMISSION_SELECT}`));
  }

  private async readSubmission(id: number, requestNo: string): Promise<Submission> {
    return submissionFromItem(await this.readSubmissionItem(id), requestNo);
  }

  private async readSubmissions(requestId: number, requestNo: string): Promise<Submission[]> {
    const items = await this.sp.getAll<SubmissionItem>(`${this.items('submissions')}?${SUBMISSION_SELECT}&$filter=RequestId eq ${requestId}&${PAGE}`);
    return items.map((i) => submissionFromItem(i, requestNo));
  }

  private async requestNumbers(): Promise<Map<number, string>> {
    const items = await this.sp.getAll<{ Id: number; RequestNumber: string | null }>(`${this.items('requests')}?$select=Id,RequestNumber&${PAGE}`);
    return new Map(items.map((i) => [i.Id, i.RequestNumber ?? '']));
  }

  /** A request the signed-in employee may change: their own, and not locked (P-027). */
  private async requestForEdit(requestId: number): Promise<PurchaseRequest> {
    const me = await this.currentUser();
    const request = await this.readRequest(requestId);
    if (request.ownerEmail !== me.email) throw new NotAllowedError(notAllowed.notYours);
    if (!isEditable(request.status)) throw new NotAllowedError(notAllowed.locked);
    return request;
  }

  private async lineForEdit(lineId: string): Promise<{ line: PurchaseLine; request: PurchaseRequest }> {
    // A row ID is a list item number; anything else is a row that does not exist.
    if (!/^[1-9]\d*$/.test(lineId)) throw new NotAllowedError(messages.spNotFound);
    const line = await this.readLine(Number(lineId));
    return { line, request: await this.requestForEdit(line.requestId) };
  }

  private async createLine(request: PurchaseRequest, rowNumber: number, paidBy: PurchaseLine['paidBy']): Promise<number> {
    const created = await this.sp.post<{ Id: number }>(this.items('lines'), {
      Title: `${request.requestNumber} row ${rowNumber}`,
      RequestId: request.id,
      RowNumber: rowNumber,
      ...lineFields({ paidBy })
    });
    if (!created) throw new Error(messages.spOther(500));
    return created.Id;
  }

  /** Stores a file exactly as uploaded, under a name SharePoint accepts, with its fingerprint and kind. */
  private async attach(lineId: number, existing: readonly AttachedFile[], file: File, kind: FileKind): Promise<void> {
    const taken = new Set(existing.map((f) => f.fileName.toLowerCase()));
    const name = uniqueName(cleanFileName(file.name), taken);
    await this.sp.postBinary(this.addAttachmentPath('lines', lineId, name), file);
    const prints = [...existing.map(storedFingerprint), { fileName: name, sizeBytes: file.size, fingerprint: await fingerprintFile(file), kind }];
    await this.sp.merge(this.item('lines', lineId), { FileFingerprints: JSON.stringify(prints) });
  }

  /**
   * Confirms the categories of a request's rows as the approver or administrator
   * chose (P-024). Every choice is checked before any row is written.
   */
  private async confirmCategoriesOn(requestId: number, choices: Record<string, CategoryChoice>, confirmedBy: string): Promise<PurchaseLine[]> {
    const lines = await this.readLines(requestId);
    const updates = categoryUpdates(lines, choices, confirmedBy);
    for (const [id, update] of updates) await this.sp.merge(this.item('lines', Number(id)), lineFields(update));
    return lines.map((l) => ({ ...l, ...updates.get(l.id) }));
  }

  /** Keeps the request's stored totals current, for the request lists (docs/DATA_MODEL.md). */
  private async updateTotals(requestId: number): Promise<void> {
    // The stored fingerprints are enough for totals; the attachment list is not needed.
    const items = await this.sp.getAll<LineItem>(`${this.items('lines')}?$select=${LINE_FIELDS}&$filter=RequestId eq ${requestId}&${PAGE}`);
    const totals = computeTotals(items.map(lineFromItem));
    await this.sp.merge(
      this.item('requests', requestId),
      requestFields({ totalReimburseCents: totals.reimburseCents, totalCompanyCents: totals.companyCents, totalRequestCents: totals.requestCents })
    );
  }
}

/**
 * A single plain address. Approver addresses are written into the flow as
 * text, so anything that could be read as an expression or markup (braces,
 * quotes, angle brackets) is refused as well as spaces, commas and semicolons.
 */
function isEmailAddress(value: string): boolean {
  return /^[^\s@,;{}<>"'`\\]+@[^\s@,;{}<>"'`\\]+$/.test(value);
}

function byLastChanged(a: PurchaseRequest, b: PurchaseRequest): number {
  return b.lastChanged.localeCompare(a.lastChanged);
}
