// In-memory implementation of PurchaseDataService for the preview and for the
// screens' tests. It keeps the same rules as SharePointDataService (the parts
// they share are in sharepoint/serviceRules.ts): employees see only their own
// requests, a request awaiting approval or submitted is locked, only site
// Owners approve and process, and packaging and the approval email are
// simulated.

import { toIsoDate, toLocalDateTime } from '../../domain/dates';
import { defaultPaidBy, latestDepartment } from '../../domain/defaults';
import { LineRef } from '../../domain/duplicates';
import { messages } from '../../domain/messages';
import { cleanFileName, requestNumber } from '../../domain/naming';
import { DEFAULT_BUYER, EMPTY_APPROVAL, findBuyer, groupsForApproved, matchesWhatWasSent } from '../../domain/purchaseRules';
import { checkReceiptFile } from '../../domain/receipts';
import { isEditable, mayBuy } from '../../domain/statuses';
import { computeTotals } from '../../domain/totals';
import { AttachedFile, BuyerId, CurrentUser, FileKind, PurchaseLine, PurchaseRequest, Submission } from '../../domain/types';
import { FlowConfig, FlowMode, LIVE_DESTINATION, TEST_FOLDERS } from '../../export/flowPackage';
import { PreparedSubmission, prepareApprovalRequest, prepareSubmission } from '../../export/submission';
import { fingerprintFile, uniqueName } from '../files';
import { ApproveOptions, CategoryChoice, LineChanges, PurchaseDataService, RequestChanges, RequestWithLines } from '../PurchaseDataService';
import { ListCheck, SetupStatus } from '../setup';
import { contentTypeFor } from '../sharepoint/mapping';
import { LISTS } from '../sharepoint/schema';
import {
  LineEditor,
  NotAllowedError,
  applyLineChanges,
  applyRequestChanges,
  approvalWhenApproved,
  approvalWhenReturned,
  buyerChangeEffects,
  buyerChangeRefusal,
  approvalWhenSent,
  buyRefusal,
  canConfirmCategories,
  categoryUpdates,
  changesAfterDelete,
  employeeCertification,
  holdsApproval,
  nextRowNumber,
  notAllowed,
  previousFolderName,
  retryRefusal,
  returnStageFor,
  rowsPhrase,
  rowsToReview,
  sortSubmissionsForRequest,
  staleUploading,
  statusAfterReturn
} from '../sharepoint/serviceRules';
import { SAMPLE_USERS, SampleStore, finishPendingWork, packagedFolderLink } from './sampleData';

export { NotAllowedError, finishPendingWork };

const LATENCY_MS = 120;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** The site the sample set-up and flow settings describe. */
const SAMPLE_SITE = 'https://contoso.sharepoint.com/sites/FormsAndApps';

/** Shared by every service made in this page, so two services on one store never make the same ID. */
let idCounter = 0;

/**
 * The files attached in this page, by file ID. The store is kept as plain data
 * when the preview switches person (which loads the page again), so a file
 * itself lives only as long as the page that attached it.
 */
const uploaded = new Map<string, Blob>();

export class MockDataService implements PurchaseDataService {
  /** Set to notSetUp() to show the set-up page in the preview. */
  public setupStatus: SetupStatus = readySetup();

  constructor(
    private readonly store: SampleStore,
    private readonly user: CurrentUser,
    /** Packaging steps in milliseconds. Calls take no longer than this either, so 0 makes the tests instant. */
    private readonly packagingDelayMs = 1500,
    /** Called after every change, so the preview can keep the store when it switches between people. */
    private readonly onChange: () => void = () => undefined,
    /** The clock; tests fix it. */
    private readonly now: () => Date = () => new Date()
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
      await this.pause(3);
    }
    this.setupStatus = readySetup();
    return this.setupStatus;
  }

  /**
   * A new address on every call, as the SharePoint service gives, because the
   * screen releases the address when it closes the file. A sample file is
   * served from /receipts; a file attached in this page is made into a new
   * blob address; a file attached before the page was loaded again cannot be
   * shown, which the screen says.
   */
  async filePreviewUrl(_lineId: string, file: AttachedFile): Promise<string> {
    const blob = uploaded.get(file.id);
    if (blob) return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : '';
    return file.url && !file.url.startsWith('blob:') ? file.url : '';
  }

  async listApprovers(): Promise<string[]> {
    return [SAMPLE_USERS.admin.displayName];
  }

  async getFlowSettings(mode: FlowMode, appPageUrl: string): Promise<FlowConfig> {
    this.requireAdmin();
    await this.pause();
    return {
      mode,
      siteUrl: SAMPLE_SITE,
      submissionsListId: this.setupStatus.lists[2].listId,
      destinationSiteUrl: mode === 'live' ? LIVE_DESTINATION.siteUrl : SAMPLE_SITE,
      libraryUrlName: 'Shared Documents',
      folders: mode === 'live' ? [...LIVE_DESTINATION.folders] : [...TEST_FOLDERS],
      adminEmail: this.user.email,
      // The sample site's Owners group is Max, as on the real site today (P-020).
      approverEmails: [SAMPLE_USERS.admin.email],
      approverSource: 'owners',
      // The preview runs on a local http address, which a flow package refuses: use a made-up SharePoint page then.
      appPageUrl: appPageUrl.startsWith('https://') ? appPageUrl : `${SAMPLE_SITE}/SitePages/Purchase-Requests.aspx`
    };
  }

  // ---- Employee -------------------------------------------------------

  async listMyRequests(): Promise<PurchaseRequest[]> {
    await this.pause();
    return clone(this.myRequests().sort(byLastChanged));
  }

  async getRequest(requestId: number): Promise<RequestWithLines> {
    await this.pause();
    const request = this.findRequestForRead(requestId);
    return { request: clone(request), lines: clone(this.linesOf(requestId)) };
  }

  async createRequest(): Promise<PurchaseRequest> {
    await this.pause();
    const id = this.store.nextRequestId++;
    const request: PurchaseRequest = {
      id,
      requestNumber: requestNumber(id),
      businessPurpose: '',
      department: latestDepartment(this.myRequests()),
      projectCode: '',
      buyer: DEFAULT_BUYER,
      status: 'Draft',
      returnNote: '',
      returnStage: '',
      ownerName: this.user.displayName,
      ownerEmail: this.email,
      submissionCount: 0,
      approvalRounds: 0,
      totalReimburseCents: 0,
      totalCompanyCents: 0,
      totalRequestCents: 0,
      sentForApprovalOn: '',
      boughtBeforeApproval: false,
      approval: clone(EMPTY_APPROVAL),
      approvalNote: '',
      approvedOn: '',
      approvedBy: '',
      approvedByEmail: '',
      submittedOn: '',
      processedOn: '',
      processedBy: '',
      lastChanged: this.stamp()
    };
    this.store.requests.push(request);
    this.changed();
    return clone(request);
  }

  async updateRequest(requestId: number, changes: RequestChanges): Promise<PurchaseRequest> {
    await this.pause();
    const request = this.requestForEdit(requestId);
    const buyerChanged = changes.buyer !== undefined && !!findBuyer(changes.buyer) && changes.buyer !== request.buyer;
    if (buyerChanged) {
      const refusal = buyerChangeRefusal(request.status);
      if (refusal) throw new NotAllowedError(refusal);
    }
    const effects = buyerChanged ? buyerChangeEffects(request, changes.buyer as BuyerId) : undefined;
    Object.assign(request, applyRequestChanges(request, changes), { lastChanged: this.stamp() });
    if (effects) {
      // An approval given for the other way of buying is taken back, and the request goes through approval again (P-037).
      if (effects.approval) request.approval = effects.approval;
      if (effects.clearApprover) Object.assign(request, { approvedOn: '', approvedBy: '', approvedByEmail: '', approvalNote: '' });
      if (effects.clearBoughtBefore) request.boughtBeforeApproval = false;
      // The company pays for everything the approver buys (P-037), so the totals follow the buyer; the rows keep what the employee chose.
      this.touch(requestId);
    }
    this.changed();
    return clone(request);
  }

  async deleteRequest(requestId: number): Promise<void> {
    await this.pause();
    const request = this.requestForEdit(requestId);
    if (request.status !== 'Draft') throw new NotAllowedError(notAllowed.draftsOnly);
    this.store.requests = this.store.requests.filter((r) => r.id !== requestId);
    this.store.lines = this.store.lines.filter((l) => l.requestId !== requestId);
    // A draft has no submissions except one that stopped part-way while being sent.
    for (const s of this.submissionsOf(requestId)) this.removeSubmission(s.id);
    this.changed();
  }

  async addLinesFromFiles(requestId: number, files: File[], kind: FileKind): Promise<PurchaseLine[]> {
    const { editor } = this.requestForChange(requestId);
    const added: PurchaseLine[] = [];
    for (const f of files) {
      if (!checkReceiptFile(f.name, f.size).ok) continue; // the screen reports refused files
      const line = this.newLine(requestId, { files: [await this.toAttachment(f, kind, [])] });
      this.store.lines.push(line);
      this.markAddedBy(line, editor);
      added.push(line);
    }
    this.touch(requestId);
    this.changed();
    return clone(added);
  }

  async addEmptyLine(requestId: number): Promise<PurchaseLine> {
    await this.pause();
    const { editor } = this.requestForChange(requestId);
    const line = this.newLine(requestId, {});
    this.store.lines.push(line);
    this.markAddedBy(line, editor);
    this.touch(requestId);
    this.changed();
    return clone(line);
  }

  async updateLine(lineId: string, changes: LineChanges): Promise<PurchaseLine> {
    await this.pause();
    const { line, editor } = this.lineForChange(lineId);
    Object.assign(line, applyLineChanges(line, changes, editor).line);
    this.touch(line.requestId);
    this.changed();
    return clone(line);
  }

  async deleteLine(lineId: string): Promise<void> {
    await this.pause();
    const { line } = this.lineForChange(lineId);
    this.store.lines = this.store.lines.filter((l) => l.id !== lineId);
    if (this.store.approverLineIds) this.store.approverLineIds = this.store.approverLineIds.filter((id) => id !== lineId);
    // Renumber the rows after it, and keep "same receipt as row" pointers correct.
    const remaining = this.linesOf(line.requestId);
    for (const [id, change] of changesAfterDelete(remaining, line.rowNumber)) Object.assign(remaining.find((l) => l.id === id)!, change);
    this.touch(line.requestId);
    this.changed();
  }

  async addFileToLine(lineId: string, f: File, kind: FileKind): Promise<PurchaseLine> {
    const { line } = this.lineForChange(lineId);
    if (!checkReceiptFile(f.name, f.size).ok) return clone(line);
    line.files.push(await this.toAttachment(f, kind, line.files));
    // A receipt of its own replaces "same receipt as row N"; a quote never does (P-021).
    if (kind === 'receipt') line.sameReceiptAsRow = null;
    this.touch(line.requestId);
    this.changed();
    return clone(line);
  }

  async removeFileFromLine(lineId: string, fileId: string): Promise<PurchaseLine> {
    await this.pause();
    const { line } = this.lineForChange(lineId);
    line.files = line.files.filter((f) => f.id !== fileId);
    this.touch(line.requestId);
    this.changed();
    return clone(line);
  }

  async getOwnerOtherLines(requestId: number): Promise<LineRef[]> {
    const request = this.findRequestForRead(requestId);
    return clone(
      this.store.lines
        .filter((l) => l.requestId !== requestId)
        .map((l) => ({ line: l, owner: this.store.requests.find((r) => r.id === l.requestId) }))
        .filter((x) => x.owner && x.owner.ownerEmail === request.ownerEmail)
        .map((x) => ({ line: x.line, requestNumber: x.owner!.requestNumber, ownerEmail: x.owner!.ownerEmail }))
    );
  }

  async sendForApproval(requestId: number, certificationText?: string): Promise<Submission> {
    await this.pause();
    const request = this.requestForEdit(requestId);
    const lines = this.linesOf(requestId);
    const round = request.approvalRounds + 1;
    // An earlier attempt that stopped part-way never reached the flow; remove it.
    for (const stale of staleUploading(this.submissionsOf(requestId), 'approval', round)) this.removeSubmission(stale.id);
    // The employee certifies now when the approver buys, because they will not submit anything (P-037).
    const certification = request.buyer === 'approver' ? { text: certificationText ?? '', email: this.email } : undefined;
    const prepared = prepareApprovalRequest(
      request,
      lines,
      await this.getOwnerOtherLines(requestId),
      this.now(),
      { name: this.user.displayName, email: this.email },
      round,
      certification
    );

    // 1. The approval request, marked Uploading so the flow ignores it for now.
    const submission: Submission = {
      ...prepared.submission,
      id: this.store.nextSubmissionId++,
      packageStatus: 'Uploading',
      folderLink: '',
      packagedAt: '',
      errorMessage: ''
    };
    this.store.submissions.push(submission);
    this.changed();
    // 2. Lock the request, recording what was sent, and keeping every approval so far as earlier (P-017).
    // As on SharePoint, an earlier approval or return is cleared only if there is one.
    const clearApproval = holdsApproval(request);
    const clearReturnStage = request.returnStage !== '';
    this.update(request, {
      status: 'Awaiting approval',
      approvalRounds: round,
      sentForApprovalOn: prepared.sentOn,
      boughtBeforeApproval: prepared.boughtBefore,
      approval: approvalWhenSent(request.approval, prepared.sentGroups, prepared.sentRows),
      returnNote: '',
      lastChanged: prepared.sentOn
    });
    if (clearApproval) this.update(request, { approvedOn: '', approvedBy: '', approvedByEmail: '', approvalNote: '' });
    if (clearReturnStage) this.update(request, { returnStage: '' });
    this.changed();
    // 3. Hand it to the flow.
    submission.packageStatus = 'Ready';
    this.changed();
    this.simulateFlow(submission.id);
    return clone(submission);
  }

  async submitRequest(requestId: number, certificationText: string): Promise<Submission> {
    await this.pause();
    const request = this.requestForEdit(requestId);
    // The approver buys it and marks it purchased; there is nothing for the employee to submit (P-037).
    if (request.buyer === 'approver') throw new NotAllowedError(notAllowed.approverBuys);
    const lines = this.linesOf(requestId);
    const number = request.submissionCount + 1;
    // An earlier attempt that stopped part-way never reached the flow; remove it.
    for (const stale of staleUploading(this.submissionsOf(requestId), 'package', number)) this.removeSubmission(stale.id);
    const prepared = prepareSubmission(
      request,
      lines,
      await this.getOwnerOtherLines(requestId),
      this.now(),
      previousFolderName(this.submissionsOf(requestId), number),
      { text: certificationText, email: this.email }
    );
    return this.createPackage(request, prepared);
  }

  async markPurchased(requestId: number): Promise<Submission> {
    this.requireAdmin();
    await this.pause();
    const request = this.mustFindRequest(requestId);
    const refusal = buyRefusal(request, this.user);
    if (refusal) throw new NotAllowedError(refusal);
    const lines = this.linesOf(requestId);
    // What the employee certified when they sent it (P-037): kept on the newest approval request.
    const certification = employeeCertification(this.submissionsOf(requestId), request);
    const number = request.submissionCount + 1;
    for (const stale of staleUploading(this.submissionsOf(requestId), 'package', number)) this.removeSubmission(stale.id);
    const prepared = prepareSubmission(
      request,
      lines,
      await this.getOwnerOtherLines(requestId),
      this.now(),
      previousFolderName(this.submissionsOf(requestId), number),
      certification,
      { name: this.user.displayName, email: this.email }
    );
    return this.createPackage(request, prepared);
  }

  /** Creates a processing package from what was prepared, locks the request and hands the package to the flow. */
  private createPackage(request: PurchaseRequest, prepared: PreparedSubmission): Submission {
    // 1. The submission, marked Uploading so the flow ignores it for now, with its files.
    const submission: Submission = {
      ...prepared.submission,
      id: this.store.nextSubmissionId++,
      packageStatus: 'Uploading',
      folderLink: '',
      packagedAt: '',
      errorMessage: ''
    };
    this.store.submissions.push(submission);
    this.store.csvBySubmission[submission.id] = prepared.csvContent;
    this.changed();
    // 2. Lock the request.
    const clearReturnStage = request.returnStage !== '';
    this.update(request, {
      status: 'Submitted',
      submissionCount: submission.submissionNumber,
      submittedOn: submission.submittedOn,
      returnNote: '',
      lastChanged: submission.submittedOn
    });
    if (clearReturnStage) this.update(request, { returnStage: '' });
    this.changed();
    // 3. Hand it to the flow.
    submission.packageStatus = 'Ready';
    this.changed();
    this.simulateFlow(submission.id);
    return clone(submission);
  }

  async listSubmissionsForRequest(requestId: number): Promise<Submission[]> {
    this.findRequestForRead(requestId);
    return clone(sortSubmissionsForRequest(this.submissionsOf(requestId)));
  }

  async getSubmissionCsv(submissionId: number): Promise<string> {
    const submission = this.mustFindSubmission(submissionId);
    this.findRequestForRead(submission.requestId);
    // SharePoint hands the file back without its byte-order mark.
    return (this.store.csvBySubmission[submissionId] ?? '').replace(/^\uFEFF/, '');
  }

  // ---- Approver and administrator -----------------------------------------

  async listAllRequests(): Promise<PurchaseRequest[]> {
    this.requireAdmin();
    await this.pause();
    return clone([...this.store.requests].sort(byLastChanged));
  }

  async listSubmissions(): Promise<Submission[]> {
    this.requireAdmin();
    return clone(this.store.submissions);
  }

  async listAllLineRefs(): Promise<LineRef[]> {
    this.requireAdmin();
    return clone(
      this.store.lines.map((l) => {
        const r = this.store.requests.find((x) => x.id === l.requestId)!;
        return { line: l, requestNumber: r.requestNumber, ownerEmail: r.ownerEmail };
      })
    );
  }

  async approveRequest(requestId: number, options: ApproveOptions): Promise<PurchaseRequest> {
    this.requireAdmin();
    await this.pause();
    const request = this.mustFindRequest(requestId);
    if (request.status !== 'Awaiting approval') throw new NotAllowedError(notAllowed.approveWhen);
    // The approver approves what was sent. A request changed since (an employee can edit their
    // own items directly in SharePoint, travel D-002) is refused before anything is written (P-019).
    if (!matchesWhatWasSent(this.linesOf(requestId), request.approval.sent, request.buyer)) throw new NotAllowedError(notAllowed.changedSinceSent);
    // Approving confirms every row's category as shown, with the changes given.
    const lines = this.confirmCategoriesOn(requestId, options.categories);
    const at = toLocalDateTime(this.now());
    // As on SharePoint, a return stage is cleared only if there is one.
    const clearReturnStage = request.returnStage !== '';
    this.update(request, {
      status: 'Approved',
      approval: approvalWhenApproved(request.approval, groupsForApproved(lines, request.approval.sent, request.buyer)),
      approvedOn: at,
      approvedBy: this.user.displayName,
      approvedByEmail: this.email,
      approvalNote: options.note,
      returnNote: '',
      lastChanged: at
    });
    if (clearReturnStage) this.update(request, { returnStage: '' });
    this.changed();
    return clone(request);
  }

  async returnRequest(requestId: number, note: string): Promise<PurchaseRequest> {
    this.requireAdmin();
    await this.pause();
    const request = this.mustFindRequest(requestId);
    const stage = returnStageFor(request.status, request.buyer);
    if (!stage) throw new NotAllowedError(notAllowed.returnWhen);
    if (request.status === 'Approved') {
      // Any administrator may send a request the approver was to buy back to the employee (P-037, P-042). Rows the
      // approver added would stop counting once the approval is taken back, so they must be deleted first.
      const added = this.linesOf(requestId).filter((l) => (this.store.approverLineIds ?? []).includes(l.id));
      if (added.length > 0) {
        const rows = rowsPhrase(added);
        throw new NotAllowedError(mayBuy(request, this.user) ? notAllowed.addedRowsFirst(rows) : notAllowed.addedRowsByApprover(request.approvedBy, rows));
      }
    }
    // As on SharePoint, the approver, time and note are cleared only if the request holds an approval.
    const clearApproval = holdsApproval(request);
    this.update(request, { status: statusAfterReturn(stage, request.buyer), returnNote: note, returnStage: stage, lastChanged: this.stamp() });
    // A return at the approval step takes the approval back, keeping the earlier ones; one at processing keeps it (P-027).
    if (stage === 'approval') {
      this.update(request, { approval: approvalWhenReturned(request.approval) });
      if (clearApproval) this.update(request, { approvedOn: '', approvedBy: '', approvedByEmail: '', approvalNote: '' });
    }
    this.changed();
    return clone(request);
  }

  async confirmCategories(requestId: number, changes: Record<string, CategoryChoice>): Promise<PurchaseLine[]> {
    this.requireAdmin();
    await this.pause();
    const request = this.mustFindRequest(requestId);
    if (!canConfirmCategories(request.status)) throw new NotAllowedError(notAllowed.confirmWhen);
    const lines = this.confirmCategoriesOn(requestId, changes);
    this.changed();
    return clone(lines);
  }

  async markProcessed(requestId: number): Promise<PurchaseRequest> {
    this.requireAdmin();
    await this.pause();
    const request = this.mustFindRequest(requestId);
    if (request.status !== 'Submitted') throw new NotAllowedError(notAllowed.processWhen);
    // A row whose account depends on a decision (Equipment, Other) must be confirmed first (P-038).
    const review = rowsToReview(this.linesOf(requestId));
    if (review.length > 0) throw new NotAllowedError(notAllowed.reviewFirst(rowsPhrase(review)));
    request.status = 'Processed';
    request.processedOn = this.stamp();
    request.processedBy = this.user.displayName;
    request.lastChanged = request.processedOn;
    this.changed();
    return clone(request);
  }

  async retryPackaging(submissionId: number): Promise<Submission> {
    this.requireAdmin();
    const submission = this.mustFindSubmission(submissionId);
    const request = this.mustFindRequest(submission.requestId);
    // Only a failed or stuck one, the newest of its kind, while its request is still at that step (P-030).
    const refusal = retryRefusal(submission, this.submissionsOf(request.id), request.status, this.now());
    if (refusal) throw new NotAllowedError(refusal);
    submission.packageStatus = 'Ready';
    submission.errorMessage = '';
    submission.lastChanged = this.stamp();
    this.changed();
    this.simulateFlow(submission.id);
    return clone(submission);
  }

  // ---- Helpers -------------------------------------------------------------

  private get email(): string {
    return this.user.email.toLowerCase();
  }

  /** The time a call takes, which is never more than a packaging step, so 0 makes everything instant. */
  private pause(times = 1): Promise<void> {
    return wait(Math.min(LATENCY_MS, this.packagingDelayMs) * times);
  }

  private changed(): void {
    this.onChange();
  }

  private stamp(): string {
    return toLocalDateTime(this.now());
  }

  /**
   * Changes a stored request. Only the type checks the change: it can name
   * only the request's own fields. The values are set as given, so the
   * callers pass values the shared rules have already checked.
   */
  private update(request: PurchaseRequest, changes: Partial<PurchaseRequest>): void {
    Object.assign(request, changes);
  }

  /**
   * The flow, simulated. An approval request is emailed and marked Packaged; a
   * package goes Processing, then Packaged with its folder (P-018).
   */
  private simulateFlow(submissionId: number): void {
    const step = (status: Submission['packageStatus'], after: number) =>
      setTimeout(() => {
        const s = this.store.submissions.find((x) => x.id === submissionId);
        if (!s) return;
        s.packageStatus = status;
        s.lastChanged = this.stamp();
        if (status === 'Packaged') {
          s.packagedAt = this.stamp();
          if (s.type === 'package') s.folderLink = packagedFolderLink(s.folderName);
        }
        this.changed();
      }, after);
    const submission = this.store.submissions.find((x) => x.id === submissionId);
    if (submission && submission.type === 'approval') {
      step('Packaged', this.packagingDelayMs);
    } else {
      step('Processing', this.packagingDelayMs);
      step('Packaged', this.packagingDelayMs * 2);
    }
  }

  /** A file as the row keeps it. The file itself is kept for this page only, for `filePreviewUrl`. */
  private async toAttachment(f: File, kind: FileKind, existing: readonly AttachedFile[]): Promise<AttachedFile> {
    idCounter += 1;
    const id = `upload-${Date.now()}-${idCounter}`;
    const name = uniqueName(cleanFileName(f.name), new Set(existing.map((x) => x.fileName.toLowerCase())));
    uploaded.set(id, f);
    return {
      id,
      fileName: name,
      sizeBytes: f.size,
      fingerprint: await fingerprintFile(f),
      contentType: contentTypeFor(name),
      kind
    };
  }

  private newLine(requestId: number, fields: Partial<PurchaseLine>): PurchaseLine {
    idCounter += 1;
    const existing = this.linesOf(requestId);
    // When the approver buys, the company pays, and the date starts as today, which the approver sets right when buying (P-037).
    const approverBuys = this.mustFindRequest(requestId).buyer === 'approver';
    return {
      id: `line-${Date.now()}-${idCounter}`,
      requestId,
      rowNumber: nextRowNumber(existing),
      date: approverBuys ? toIsoDate(this.now()) : '',
      vendor: '',
      description: '',
      category: '',
      categoryOther: '',
      categoryConfirmedBy: '',
      amountCents: null,
      paidBy: approverBuys ? 'company' : defaultPaidBy(existing),
      noQuoteReason: '',
      noReceiptReason: '',
      itemLink: '',
      noLinkReason: '',
      sameReceiptAsRow: null,
      files: [],
      suggested: [],
      ...fields
    };
  }

  private myRequests(): PurchaseRequest[] {
    return this.store.requests.filter((r) => r.ownerEmail.toLowerCase() === this.email);
  }

  private linesOf(requestId: number): PurchaseLine[] {
    return this.store.lines.filter((l) => l.requestId === requestId).sort((a, b) => a.rowNumber - b.rowNumber);
  }

  private submissionsOf(requestId: number): Submission[] {
    return this.store.submissions.filter((s) => s.requestId === requestId);
  }

  private removeSubmission(id: number): void {
    this.store.submissions = this.store.submissions.filter((s) => s.id !== id);
    delete this.store.csvBySubmission[id];
  }

  /** Records a change: the request's totals and last-changed time are kept current. */
  private touch(requestId: number): void {
    const request = this.store.requests.find((r) => r.id === requestId);
    if (!request) return;
    const totals = computeTotals(this.linesOf(requestId), request.buyer);
    request.totalReimburseCents = totals.reimburseCents;
    request.totalCompanyCents = totals.companyCents;
    request.totalRequestCents = totals.requestCents;
    request.lastChanged = this.stamp();
  }

  /** Confirms the categories of a request's rows as the approver or administrator chose (P-024). Every choice is checked first. */
  private confirmCategoriesOn(requestId: number, choices: Record<string, CategoryChoice>): PurchaseLine[] {
    const lines = this.linesOf(requestId);
    for (const [id, update] of categoryUpdates(lines, choices, this.user.displayName)) Object.assign(lines.find((l) => l.id === id)!, update);
    return lines;
  }

  /** A missing request and someone else's look the same to an employee, as on SharePoint (travel D-003). */
  private mustFindRequest(requestId: number): PurchaseRequest {
    const request = this.store.requests.find((r) => r.id === requestId);
    if (!request) throw new NotAllowedError(messages.spNotFound);
    return request;
  }

  private mustFindSubmission(submissionId: number): Submission {
    const submission = this.store.submissions.find((s) => s.id === submissionId);
    if (!submission) throw new NotAllowedError(messages.spNotFound);
    return submission;
  }

  private findRequestForRead(requestId: number): PurchaseRequest {
    const request = this.mustFindRequest(requestId);
    if (!this.user.isAdministrator && request.ownerEmail.toLowerCase() !== this.email) throw new NotAllowedError(messages.spNotFound);
    return request;
  }

  /** A request the signed-in employee may change: their own, and not locked (P-027). Not the approver's buying (`requestForChange`). */
  private requestForEdit(requestId: number): PurchaseRequest {
    const request = this.findRequestForRead(requestId);
    if (request.ownerEmail.toLowerCase() !== this.email) throw new NotAllowedError(notAllowed.notYours);
    if (!isEditable(request.status, request.buyer)) throw new NotAllowedError(notAllowed.locked);
    return request;
  }

  /**
   * A request whose rows and files the signed-in person may change: the approver
   * who approved a request the approver buys, while it is Approved (P-037,
   * P-040), or the owner as in `requestForEdit`. A category the approver chooses
   * is confirmed by them.
   */
  private requestForChange(requestId: number): { request: PurchaseRequest; editor: LineEditor } {
    const request = this.findRequestForRead(requestId);
    if (mayBuy(request, this.user)) return { request, editor: { buyer: 'approver', approverName: this.user.displayName } };
    if (request.ownerEmail.toLowerCase() !== this.email) {
      throw new NotAllowedError(this.user.isAdministrator && request.buyer === 'approver' ? notAllowed.buyerOnly : notAllowed.notYours);
    }
    if (!isEditable(request.status, request.buyer)) throw new NotAllowedError(notAllowed.locked);
    return { request, editor: { buyer: request.buyer } };
  }

  private lineForChange(lineId: string): { line: PurchaseLine; request: PurchaseRequest; editor: LineEditor } {
    const line = this.store.lines.find((l) => l.id === lineId);
    if (!line) throw new NotAllowedError(messages.spNotFound);
    return { line, ...this.requestForChange(line.requestId) };
  }

  /** Remembers that the approver added this row, because it is not the employee's (P-037). */
  private markAddedBy(line: PurchaseLine, editor: LineEditor): void {
    if (!editor.approverName) return;
    // A row the owner adds is theirs even when the owner is also the approver (self-approved), as on SharePoint.
    if (this.mustFindRequest(line.requestId).ownerEmail.toLowerCase() === this.email) return;
    this.store.approverLineIds = [...(this.store.approverLineIds ?? []), line.id];
  }

  private requireAdmin(): void {
    if (!this.user.isAdministrator) throw new NotAllowedError(notAllowed.administratorsOnly);
  }
}

function byLastChanged(a: PurchaseRequest, b: PurchaseRequest): number {
  return b.lastChanged.localeCompare(a.lastChanged);
}

/** The sample site's lists, from the same definitions the set-up page uses, with made-up list IDs. */
const SAMPLE_LISTS: [ListCheck['key'], string, string, string][] = Object.values(LISTS).map((def, i) => [
  def.key,
  def.title,
  `Lists/${def.urlName}`,
  `00000000-0000-0000-0000-00000000000${i + 1}`
]);

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

/** A new site before set-up, for the preview and tests. */
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
