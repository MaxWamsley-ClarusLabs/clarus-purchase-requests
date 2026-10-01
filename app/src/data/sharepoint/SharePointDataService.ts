// The SharePoint implementation of PurchaseDataService: the three lists on the
// Forms and Apps site (docs/DATA_MODEL.md), read and written as the signed-in
// user. It keeps the same rules as MockDataService. SharePoint itself enforces
// "own items only" for employees (travel D-003); the locking rules (P-027) and
// the approver rules (P-020) are enforced here, because employees may still
// edit their own items directly in SharePoint (travel D-002).
//
// A row or a submission names its request by RequestId, which anyone can type.
// It belongs to the request only if the request's owner (the request item's
// author) made it, or, for a request the approver buys, the approver recorded
// on the request (P-037, P-040); any other is ignored everywhere, so nobody
// can add a purchase to someone else's request.

import { toIsoDate } from '../../domain/dates';
import { defaultPaidBy, latestDepartment } from '../../domain/defaults';
import { LineRef } from '../../domain/duplicates';
import { messages } from '../../domain/messages';
import { cleanFileName, requestNumber } from '../../domain/naming';
import { DEFAULT_BUYER, EMPTY_APPROVAL, findBuyer, groupsForApproved, matchesWhatWasSent } from '../../domain/purchaseRules';
import { checkReceiptFile } from '../../domain/receipts';
import { isEditable, mayBuy } from '../../domain/statuses';
import { computeTotals } from '../../domain/totals';
import { AttachedFile, CurrentUser, FileKind, PurchaseLine, PurchaseRequest, Submission } from '../../domain/types';
import { FlowConfig, FlowMode, LIVE_DESTINATION, MAX_APPROVERS, TEST_FOLDERS, TEST_LIBRARY_URL_NAME, isSafeEmailAddress } from '../../export/flowPackage';
import { PreparedSubmission, prepareApprovalRequest, prepareSubmission } from '../../export/submission';
import { fingerprintFile, uniqueName } from '../files';
import { ApproveOptions, CategoryChoice, LineChanges, PurchaseDataService, RequestChanges, RequestWithLines } from '../PurchaseDataService';
import { SetupStatus } from '../setup';
import { SharePointRequestError, SpClient, odataString } from './http';
import {
  LineItem,
  RequestItem,
  RequestWrite,
  SubmissionItem,
  buyerFrom,
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
  LineEditor,
  NotAllowedError,
  applyLineChanges,
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
} from './serviceRules';
import { SiteSetup } from './SiteSetup';

export { NotAllowedError };

const REQUEST_SELECT =
  '$select=Id,Title,RequestNumber,Department,ProjectCode,Buyer,RequestStatus,ReturnNote,ReturnStage,TotalReimburse,TotalCompany,TotalRequest,SubmissionCount,ApprovalRounds,' +
  'SentForApprovalOn,BoughtBeforeApproval,ApprovalRecord,ApprovalNote,ApprovedOn,SubmittedOn,ProcessedOn,Modified,AuthorId,ApprovedById,Author/Title,Author/EMail,' +
  'ApprovedBy/Title,ApprovedBy/EMail,ProcessedBy/Title&$expand=Author,ApprovedBy,ProcessedBy';
const LINE_FIELDS =
  'Id,AuthorId,RequestId,RowNumber,PurchaseDate,Vendor,Description,Category,CategoryOther,CategoryConfirmedBy,Amount,PaidBy,NoQuoteReason,NoReceiptReason,' +
  'ItemLink,NoLinkReason,SameReceiptAsRow,FileFingerprints,SuggestedFields';
const LINE_SELECT = `$select=${LINE_FIELDS},AttachmentFiles&$expand=AttachmentFiles`;
const SUBMISSION_SELECT =
  '$select=Id,AuthorId,RequestId,SubmissionType,SubmissionNumber,PackageStatus,FolderName,PreviousFolderName,SubmitterName,SubmitterEmail,CertificationText,' +
  'BusinessPurpose,Department,ProjectCode,PurchaseDates,TotalReimburse,TotalCompany,TotalRequest,ReceiptCount,QuoteCount,RowsWithoutReceipt,BoughtBeforeApproval,' +
  'ApprovedBy,ApprovedOn,EmailSubject,EmailSummary,FolderLink,PackagedAt,ErrorMessage,Created,Modified,AttachmentFiles&$expand=AttachmentFiles';
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

/**
 * A request with the user ID of the person who created the item, its owner,
 * and of the approver recorded on it. The owner's rows and submissions belong
 * to the request. So do the approver's, but only for a request the approver
 * buys (P-037, P-040): a row made by anyone else that names the request is not
 * part of it.
 */
interface StoredRequest {
  request: PurchaseRequest;
  authorId: number;
  approverId: number;
}

/** The user ID of the person who created an item; 0 when SharePoint did not give one. */
function authorOf(item: { AuthorId?: number | null }): number {
  return typeof item.AuthorId === 'number' && item.AuthorId > 0 ? item.AuthorId : 0;
}

/** The people whose rows and submissions belong to a request. */
function authorsOf(stored: StoredRequest): ReadonlySet<number> {
  const authors = new Set<number>();
  if (stored.authorId > 0) authors.add(stored.authorId);
  if (stored.request.buyer === 'approver' && stored.approverId > 0) authors.add(stored.approverId);
  return authors;
}

/** Whether an item was made by one of these people. An item whose author is not known belongs to nobody. */
function madeBy(item: { AuthorId?: number | null }, authors: ReadonlySet<number>): boolean {
  const id = authorOf(item);
  return id > 0 && authors.has(id);
}

function storedFrom(item: RequestItem): StoredRequest {
  return { request: requestFromItem(item), authorId: authorOf(item), approverId: authorOf({ AuthorId: item.ApprovedById }) };
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
    const libraryUrlName = mode === 'live' ? LIVE_DESTINATION.libraryUrlName : TEST_LIBRARY_URL_NAME;
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
    // The approval email goes to the Owners, read now and fixed in the package (P-018). An address the
    // package could not carry safely is left out, and so is any beyond what the package allows.
    const owners = (await this.readOwners()).map((o) => o.email).filter(isSafeEmailAddress);
    const approverEmails = owners.filter((email, i) => owners.indexOf(email) === i).slice(0, MAX_APPROVERS);
    return {
      mode,
      siteUrl: this.sp.webUrl,
      submissionsListId: submissions.listId,
      destinationSiteUrl: destination.webUrl,
      libraryUrlName,
      folders: mode === 'live' ? [...LIVE_DESTINATION.folders] : [...TEST_FOLDERS],
      adminEmail: me.email,
      approverEmails: approverEmails.length > 0 ? approverEmails : [me.email].filter(isSafeEmailAddress),
      approverSource: approverEmails.length > 0 ? 'owners' : 'administrator',
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
    const stored = await this.readStored(requestId);
    return { request: stored.request, lines: await this.readLines(requestId, stored) };
  }

  async createRequest(): Promise<PurchaseRequest> {
    await this.currentUser();
    const department = latestDepartment(await this.listMyRequests());
    const created = await this.sp.post<{ Id: number }>(
      this.items('requests'),
      requestFields({
        businessPurpose: '',
        department,
        buyer: DEFAULT_BUYER,
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
    // For anyone viewing the list directly. The app makes the number from the item ID (mapping.ts).
    await this.sp.merge(this.item('requests', created.Id), { RequestNumber: requestNumber(created.Id) });
    return this.readRequest(created.Id);
  }

  async updateRequest(requestId: number, changes: RequestChanges): Promise<PurchaseRequest> {
    const stored = await this.requestForEdit(requestId);
    const buyer = changes.buyer !== undefined && findBuyer(changes.buyer) && changes.buyer !== stored.request.buyer ? changes.buyer : undefined;
    if (buyer) {
      const refusal = buyerChangeRefusal(stored.request.status);
      if (refusal) throw new NotAllowedError(refusal);
    }
    // Only the header fields and who buys can be changed here, whatever else is passed.
    const write: RequestWrite = { businessPurpose: changes.businessPurpose, department: changes.department, projectCode: changes.projectCode, buyer };
    if (buyer) {
      // An approval given for the other way of buying is taken back, and the request goes through approval again (P-037).
      const effects = buyerChangeEffects(stored.request, buyer);
      if (effects.approval) write.approval = effects.approval;
      if (effects.clearApprover) Object.assign(write, { approvedOn: null, approvedById: null, approvalNote: '' });
      if (effects.clearBoughtBefore) write.boughtBeforeApproval = false;
    }
    await this.sp.merge(this.item('requests', requestId), requestFields(write));
    // The company pays for everything the approver buys (P-037), so the totals follow the buyer; the rows keep what the employee chose.
    if (buyer) await this.updateTotals(requestId, { ...stored, request: { ...stored.request, buyer } });
    return this.readRequest(requestId);
  }

  async deleteRequest(requestId: number): Promise<void> {
    const stored = await this.requestForEdit(requestId);
    const { request } = stored;
    if (request.status !== 'Draft') throw new NotAllowedError(notAllowed.draftsOnly);
    // Moved to the site's recycle bin, so a mistake can be undone there. A draft
    // has no submissions except one that stopped part-way while being sent.
    for (const line of await this.readLines(requestId, stored)) await this.recycle('lines', Number(line.id));
    for (const submission of await this.readSubmissions(requestId, request.requestNumber, stored)) await this.recycle('submissions', submission.id);
    await this.recycle('requests', requestId);
  }

  async addLinesFromFiles(requestId: number, files: File[], kind: FileKind): Promise<PurchaseLine[]> {
    const { stored } = await this.requestForChange(requestId);
    const { request } = stored;
    const lines = await this.readLines(requestId, stored);
    const added: PurchaseLine[] = [];
    for (const file of files) {
      if (!checkReceiptFile(file.name, file.size).ok) continue; // the screen reports refused files
      const soFar = [...lines, ...added];
      const id = await this.createLine(request, nextRowNumber(soFar), this.newRowDefaults(request, soFar));
      try {
        await this.attach(id, [], file, kind);
      } catch (e) {
        // The row was made for this file only: take it away again rather than leave an empty row (best effort).
        await this.recycle('lines', id).catch(() => undefined);
        throw e;
      }
      added.push(await this.readLine(id));
    }
    return added;
  }

  async addEmptyLine(requestId: number): Promise<PurchaseLine> {
    const { stored } = await this.requestForChange(requestId);
    const lines = await this.readLines(requestId, stored);
    const id = await this.createLine(stored.request, nextRowNumber(lines), this.newRowDefaults(stored.request, lines));
    return this.readLine(id);
  }

  async updateLine(lineId: string, changes: LineChanges): Promise<PurchaseLine> {
    const { line, stored, editor } = await this.lineForChange(lineId);
    const applied = applyLineChanges(line, changes, editor);
    const columns = lineFields(applied.written);
    if (Object.keys(columns).length > 0) await this.sp.merge(this.item('lines', Number(lineId)), columns);
    if (applied.written.amountCents !== undefined || applied.written.paidBy !== undefined) await this.updateTotals(line.requestId, stored);
    return applied.line;
  }

  async deleteLine(lineId: string): Promise<void> {
    const { line, stored } = await this.lineForChange(lineId);
    await this.recycle('lines', Number(lineId));
    // Renumber the rows after it, and keep "same receipt as row" pointers correct.
    for (const [id, change] of changesAfterDelete(await this.readLines(line.requestId, stored), line.rowNumber)) {
      const columns = lineFields(change);
      if (change.rowNumber !== undefined) columns.Title = `${stored.request.requestNumber} row ${change.rowNumber}`;
      await this.sp.merge(this.item('lines', Number(id)), columns);
    }
    await this.updateTotals(line.requestId, stored);
  }

  async addFileToLine(lineId: string, file: File, kind: FileKind): Promise<PurchaseLine> {
    const { line } = await this.lineForChange(lineId);
    if (!checkReceiptFile(file.name, file.size).ok) return line;
    await this.attach(Number(lineId), line.files, file, kind);
    // A receipt of its own replaces "same receipt as row N"; a quote never does (P-021).
    if (kind === 'receipt' && line.sameReceiptAsRow !== null) await this.sp.merge(this.item('lines', Number(lineId)), lineFields({ sameReceiptAsRow: null }));
    return this.readLine(Number(lineId));
  }

  async removeFileFromLine(lineId: string, fileId: string): Promise<PurchaseLine> {
    const { line } = await this.lineForChange(lineId);
    const file = line.files.find((f) => f.id === fileId);
    if (!file) return line;
    await this.sp.remove(this.attachmentPath('lines', Number(lineId), file.fileName));
    const remaining = line.files.filter((f) => f.id !== fileId);
    await this.sp.merge(this.item('lines', Number(lineId)), { FileFingerprints: JSON.stringify(remaining.map(storedFingerprint)) });
    return this.readLine(Number(lineId));
  }

  async getOwnerOtherLines(requestId: number): Promise<LineRef[]> {
    const { request } = await this.readStored(requestId);
    const owned = new Map(
      (await this.readAllStored()).filter((s) => s.request.ownerEmail === request.ownerEmail && s.request.id !== requestId).map((s) => [s.request.id, s])
    );
    const items = await this.sp.getAll<LineItem>(`${this.items('lines')}?$select=${LINE_FIELDS}&${PAGE}`);
    return items
      .map((item) => ({ item, line: lineFromItem(item) }))
      .filter(({ item, line }) => {
        const owner = owned.get(line.requestId);
        return !!owner && madeBy(item, authorsOf(owner));
      })
      .map(({ line }) => ({ line, requestNumber: owned.get(line.requestId)!.request.requestNumber, ownerEmail: request.ownerEmail }));
  }

  async sendForApproval(requestId: number, certificationText?: string): Promise<Submission> {
    const me = await this.currentUser();
    const stored = await this.requestForEdit(requestId);
    const { request } = stored;
    const lines = await this.readLines(requestId, stored);
    const others = await this.getOwnerOtherLines(requestId);
    const earlier = await this.readSubmissions(requestId, request.requestNumber, stored);
    const round = request.approvalRounds + 1;
    // An earlier attempt that stopped part-way never reached the flow; remove it.
    for (const stale of staleUploading(earlier, 'approval', round)) await this.recycle('submissions', stale.id);
    const now = this.now();
    // The employee certifies now when the approver buys, because they will not submit anything (P-037).
    const certification = request.buyer === 'approver' ? { text: certificationText ?? '', email: me.email } : undefined;
    const prepared = prepareApprovalRequest(request, lines, others, now, { name: me.displayName, email: me.email }, round, certification);

    // 1. The approval request, marked Uploading so the flow ignores it for now. It has no files.
    const created = await this.sp.post<{ Id: number }>(this.items('submissions'), submissionFields(prepared.submission));
    if (!created) throw new Error(messages.spOther(500));
    // 2. Lock the request, recording what was sent, and keeping every approval so far as earlier
    // (P-017). Then 3. hand the approval request to the flow. If step 3 fails, the administrator
    // sees it under Needs attention and can retry.
    const write: RequestWrite = {
      status: 'Awaiting approval',
      approvalRounds: round,
      sentForApprovalOn: now.toISOString(),
      boughtBeforeApproval: prepared.boughtBefore,
      approval: approvalWhenSent(request.approval, prepared.sentGroups, prepared.sentRows),
      returnNote: ''
    };
    // An earlier approval or return is cleared only if there is one, so a first send never
    // writes the person, date or choice columns.
    if (holdsApproval(request)) Object.assign(write, { approvedOn: null, approvedById: null, approvalNote: '' });
    if (request.returnStage !== '') write.returnStage = '';
    await this.sp.merge(this.item('requests', requestId), requestFields(write));
    await this.sp.merge(this.item('submissions', created.Id), { PackageStatus: 'Ready' });
    return this.readSubmission(created.Id, request.requestNumber);
  }

  async submitRequest(requestId: number, certificationText: string): Promise<Submission> {
    const me = await this.currentUser();
    const stored = await this.requestForEdit(requestId);
    const { request } = stored;
    // The approver buys it and marks it purchased; there is nothing for the employee to submit (P-037).
    if (request.buyer === 'approver') throw new NotAllowedError(notAllowed.approverBuys);
    const lines = await this.readLines(requestId, stored);
    const others = await this.getOwnerOtherLines(requestId);
    const earlier = await this.readSubmissions(requestId, request.requestNumber, stored);
    const number = request.submissionCount + 1;
    // An earlier attempt that stopped part-way never reached the flow; remove it.
    for (const stale of staleUploading(earlier, 'package', number)) await this.recycle('submissions', stale.id);
    const now = this.now();
    const prepared = prepareSubmission(request, lines, others, now, previousFolderName(earlier, number), { text: certificationText, email: me.email });
    return this.createPackage(stored, lines, prepared, now);
  }

  async markPurchased(requestId: number): Promise<Submission> {
    const me = await this.requireAdmin();
    const stored = await this.readStored(requestId);
    const { request } = stored;
    const refusal = buyRefusal(request, me);
    if (refusal) throw new NotAllowedError(refusal);
    const lines = await this.readLines(requestId, stored);
    const others = await this.getOwnerOtherLines(requestId);
    const earlier = await this.readSubmissions(requestId, request.requestNumber, stored);
    // What the employee certified when they sent it (P-037): kept on the newest approval request.
    const certification = employeeCertification(earlier, request);
    const number = request.submissionCount + 1;
    for (const stale of staleUploading(earlier, 'package', number)) await this.recycle('submissions', stale.id);
    const now = this.now();
    const prepared = prepareSubmission(request, lines, others, now, previousFolderName(earlier, number), certification, {
      name: me.displayName,
      email: me.email
    });
    return this.createPackage(stored, lines, prepared, now);
  }

  /** Creates a processing package from what was prepared, locks the request and hands the package to the flow. */
  private async createPackage(stored: StoredRequest, lines: readonly PurchaseLine[], prepared: PreparedSubmission, now: Date): Promise<Submission> {
    const { request } = stored;
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
    const write: RequestWrite = { status: 'Submitted', submissionCount: prepared.submission.submissionNumber, submittedOn: now.toISOString(), returnNote: '' };
    if (request.returnStage !== '') write.returnStage = '';
    await this.sp.merge(this.item('requests', request.id), requestFields(write));
    await this.sp.merge(this.item('submissions', created.Id), { PackageStatus: 'Ready' });
    return this.readSubmission(created.Id, request.requestNumber);
  }

  async listSubmissionsForRequest(requestId: number): Promise<Submission[]> {
    const stored = await this.readStored(requestId);
    return sortSubmissionsForRequest(await this.readSubmissions(requestId, stored.request.requestNumber, stored));
  }

  async getSubmissionCsv(submissionId: number): Promise<string> {
    const item = await this.readSubmissionItem(submissionId);
    const csv = (item.AttachmentFiles ?? []).find((a) => /_Purchases\.csv$/i.test(a.FileName));
    return csv ? this.sp.getText(this.attachmentPath('submissions', submissionId, csv.FileName) + '/$value') : '';
  }

  // ---- Approver and administrator ---------------------------------------------------

  async listAllRequests(): Promise<PurchaseRequest[]> {
    await this.requireAdmin();
    return (await this.readAllStored()).map((s) => s.request).sort(byLastChanged);
  }

  async listSubmissions(): Promise<Submission[]> {
    await this.requireAdmin();
    const owners = await this.requestOwners();
    const items = await this.sp.getAll<SubmissionItem>(`${this.items('submissions')}?${SUBMISSION_SELECT}&${PAGE}`);
    return items
      .filter((i) => {
        const owner = owners.get(Number(i.RequestId));
        return !!owner && madeBy(i, owner);
      })
      .map((i) => submissionFromItem(i, requestNumber(Number(i.RequestId))));
  }

  async listAllLineRefs(): Promise<LineRef[]> {
    await this.requireAdmin();
    const requests = new Map((await this.readAllStored()).map((s) => [s.request.id, s]));
    const items = await this.sp.getAll<LineItem>(`${this.items('lines')}?$select=${LINE_FIELDS}&${PAGE}`);
    return items
      .map((item) => ({ item, line: lineFromItem(item) }))
      .filter(({ item, line }) => {
        const owner = requests.get(line.requestId);
        return !!owner && madeBy(item, authorsOf(owner));
      })
      .map(({ line }) => {
        const r = requests.get(line.requestId)!.request;
        return { line, requestNumber: r.requestNumber, ownerEmail: r.ownerEmail };
      });
  }

  async approveRequest(requestId: number, options: ApproveOptions): Promise<PurchaseRequest> {
    const me = await this.requireAdmin();
    const stored = await this.readStored(requestId);
    const { request } = stored;
    if (request.status !== 'Awaiting approval') throw new NotAllowedError(notAllowed.approveWhen);
    const lines = await this.readLines(requestId, stored);
    // The approver approves what was sent. A request changed since (directly in SharePoint, travel D-002)
    // is refused before anything is written (P-019).
    if (!matchesWhatWasSent(lines, request.approval.sent, request.buyer)) throw new NotAllowedError(notAllowed.changedSinceSent);
    // Approving confirms every row's category as shown, with the changes given.
    const confirmed = await this.confirmCategoriesOn(lines, options.categories, me.displayName);
    const approved = groupsForApproved(confirmed, request.approval.sent, request.buyer);
    const write: RequestWrite = {
      status: 'Approved',
      approval: approvalWhenApproved(request.approval, approved),
      approvedOn: this.now().toISOString(),
      approvedById: me.id,
      approvalNote: options.note,
      returnNote: ''
    };
    // A return stage is cleared only if there is one, as on a first send.
    if (request.returnStage !== '') write.returnStage = '';
    await this.sp.merge(this.item('requests', requestId), requestFields(write));
    return this.readRequest(requestId);
  }

  async returnRequest(requestId: number, note: string): Promise<PurchaseRequest> {
    const me = await this.requireAdmin();
    const stored = await this.readStored(requestId);
    const { request } = stored;
    const stage = returnStageFor(request.status, request.buyer);
    if (!stage) throw new NotAllowedError(notAllowed.returnWhen);
    if (request.status === 'Approved') {
      // The approver who was to buy it may send it back to the employee instead (P-037). Rows the approver
      // added are not the employee's and would stop counting once the approval is taken back, so they go first.
      const refusal = buyRefusal(request, me);
      if (refusal) throw new NotAllowedError(refusal);
      const added = (await this.readLinesMadeBy(requestId, stored)).filter((l) => l.madeByApprover);
      if (added.length > 0) throw new NotAllowedError(notAllowed.addedRowsFirst(rowsPhrase(added.map((a) => a.line))));
    }
    const write: RequestWrite = { status: statusAfterReturn(stage, request.buyer), returnNote: note, returnStage: stage };
    // A return at the approval step takes the approval back, keeping the earlier ones; one at processing
    // keeps it (P-027). The approver, time and note are cleared only if the request holds an approval.
    if (stage === 'approval') {
      write.approval = approvalWhenReturned(request.approval);
      if (holdsApproval(request)) Object.assign(write, { approvedOn: null, approvedById: null, approvalNote: '' });
    }
    await this.sp.merge(this.item('requests', requestId), requestFields(write));
    return this.readRequest(requestId);
  }

  async confirmCategories(requestId: number, changes: Record<string, CategoryChoice>): Promise<PurchaseLine[]> {
    const me = await this.requireAdmin();
    const stored = await this.readStored(requestId);
    if (!canConfirmCategories(stored.request.status)) throw new NotAllowedError(notAllowed.confirmWhen);
    return this.confirmCategoriesOn(await this.readLines(requestId, stored), changes, me.displayName);
  }

  async markProcessed(requestId: number): Promise<PurchaseRequest> {
    const me = await this.requireAdmin();
    const stored = await this.readStored(requestId);
    if (stored.request.status !== 'Submitted') throw new NotAllowedError(notAllowed.processWhen);
    // A row whose account depends on a decision (Equipment, Other) must be confirmed first (P-038).
    const review = rowsToReview(await this.readLines(requestId, stored));
    if (review.length > 0) throw new NotAllowedError(notAllowed.reviewFirst(rowsPhrase(review)));
    await this.sp.merge(this.item('requests', requestId), requestFields({ status: 'Processed', processedOn: this.now().toISOString(), processedById: me.id }));
    return this.readRequest(requestId);
  }

  async retryPackaging(submissionId: number): Promise<Submission> {
    await this.requireAdmin();
    const item = await this.readSubmissionItem(submissionId);
    const stored = await this.readStored(Number(item.RequestId));
    const { request } = stored;
    if (!madeBy(item, authorsOf(stored))) throw new NotAllowedError(messages.spNotFound);
    const all = await this.readSubmissions(request.id, request.requestNumber, stored);
    // Only a failed or stuck one, the newest of its kind, while its request is still at that step (P-030).
    const refusal = retryRefusal(submissionFromItem(item, request.requestNumber), all, request.status, this.now());
    if (refusal) throw new NotAllowedError(refusal);
    await this.sp.merge(this.item('submissions', submissionId), { PackageStatus: 'Ready', ErrorMessage: '' });
    return this.readSubmission(submissionId, request.requestNumber);
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

  private readStored(requestId: number): Promise<StoredRequest> {
    return this.notFoundAsNotAllowed(async () => storedFrom(await this.sp.getJson<RequestItem>(`${this.item('requests', requestId)}?${REQUEST_SELECT}`)));
  }

  private async readRequest(requestId: number): Promise<PurchaseRequest> {
    return (await this.readStored(requestId)).request;
  }

  private async readAllStored(): Promise<StoredRequest[]> {
    return (await this.sp.getAll<RequestItem>(`${this.items('requests')}?${REQUEST_SELECT}&${PAGE}`)).map(storedFrom);
  }

  /** The rows of a request: those its owner made, and the approver's for a request the approver buys, in row order. */
  private async readLines(requestId: number, stored: StoredRequest): Promise<PurchaseLine[]> {
    return (await this.readLinesMadeBy(requestId, stored)).map((l) => l.line);
  }

  /** The same, with whether the approver, and not the owner, made each row (P-037). */
  private async readLinesMadeBy(requestId: number, stored: StoredRequest): Promise<{ line: PurchaseLine; madeByApprover: boolean }[]> {
    const authors = authorsOf(stored);
    const items = await this.sp.getAll<LineItem>(`${this.items('lines')}?${LINE_SELECT}&$filter=RequestId eq ${requestId}&$orderby=RowNumber&${PAGE}`);
    return items
      .filter((i) => madeBy(i, authors))
      .map((i) => ({ line: lineFromItem(i), madeByApprover: stored.authorId !== authorOf(i) }))
      .sort((a, b) => a.line.rowNumber - b.line.rowNumber);
  }

  private readLineItem(lineId: number): Promise<LineItem> {
    return this.notFoundAsNotAllowed(() => this.sp.getJson<LineItem>(`${this.item('lines', lineId)}?${LINE_SELECT}`));
  }

  private async readLine(lineId: number): Promise<PurchaseLine> {
    return lineFromItem(await this.readLineItem(lineId));
  }

  private readSubmissionItem(submissionId: number): Promise<SubmissionItem> {
    return this.notFoundAsNotAllowed(() => this.sp.getJson<SubmissionItem>(`${this.item('submissions', submissionId)}?${SUBMISSION_SELECT}`));
  }

  private async readSubmission(id: number, requestNo: string): Promise<Submission> {
    return submissionFromItem(await this.readSubmissionItem(id), requestNo);
  }

  /** The submissions of a request: those its owner made, and the approver's for a request the approver buys. */
  private async readSubmissions(requestId: number, requestNo: string, stored: StoredRequest): Promise<Submission[]> {
    const authors = authorsOf(stored);
    const items = await this.sp.getAll<SubmissionItem>(`${this.items('submissions')}?${SUBMISSION_SELECT}&$filter=RequestId eq ${requestId}&${PAGE}`);
    return items.filter((i) => madeBy(i, authors)).map((i) => submissionFromItem(i, requestNo));
  }

  /** The people whose rows and submissions belong to each request, by request ID. */
  private async requestOwners(): Promise<Map<number, ReadonlySet<number>>> {
    const items = await this.sp.getAll<{ Id: number; AuthorId?: number | null; Buyer?: string | null; ApprovedById?: number | null }>(
      `${this.items('requests')}?$select=Id,AuthorId,Buyer,ApprovedById&${PAGE}`
    );
    return new Map(
      items.map((i) => {
        const authors = new Set<number>();
        if (authorOf(i) > 0) authors.add(authorOf(i));
        const approver = authorOf({ AuthorId: i.ApprovedById });
        if (buyerFrom(i.Buyer) === 'approver' && approver > 0) authors.add(approver);
        return [i.Id, authors];
      })
    );
  }

  /** A request the signed-in employee may change: their own, and not locked (P-027). Not the approver's buying (`requestForChange`). */
  private async requestForEdit(requestId: number): Promise<StoredRequest> {
    const me = await this.currentUser();
    const stored = await this.readStored(requestId);
    if (stored.request.ownerEmail !== me.email) throw new NotAllowedError(notAllowed.notYours);
    if (!isEditable(stored.request.status, stored.request.buyer)) throw new NotAllowedError(notAllowed.locked);
    return stored;
  }

  /**
   * A request whose rows and files the signed-in person may change: the approver
   * who approved a request the approver buys, while it is Approved (P-037,
   * P-040), or the owner as in `requestForEdit`. The approver's changes are
   * recorded as the approver's: a category they choose is confirmed by them.
   */
  private async requestForChange(requestId: number): Promise<{ stored: StoredRequest; editor: LineEditor }> {
    const me = await this.currentUser();
    const stored = await this.readStored(requestId);
    if (mayBuy(stored.request, me)) return { stored, editor: { buyer: 'approver', approverName: me.displayName } };
    if (stored.request.ownerEmail !== me.email) {
      throw new NotAllowedError(me.isAdministrator && stored.request.buyer === 'approver' ? notAllowed.buyerOnly : notAllowed.notYours);
    }
    if (!isEditable(stored.request.status, stored.request.buyer)) throw new NotAllowedError(notAllowed.locked);
    return { stored, editor: { buyer: stored.request.buyer } };
  }

  /** A row the signed-in person may change: a row of a request they may change (`requestForChange`), made by its owner or its approver, while the request allows it. */
  private async lineForChange(lineId: string): Promise<{ line: PurchaseLine; stored: StoredRequest; editor: LineEditor }> {
    // A row ID is a list item number; anything else is a row that does not exist.
    if (!/^[1-9]\d*$/.test(lineId)) throw new NotAllowedError(messages.spNotFound);
    const item = await this.readLineItem(Number(lineId));
    const line = lineFromItem(item);
    const { stored, editor } = await this.requestForChange(line.requestId);
    // A row someone else made that names this request is not part of it.
    if (!madeBy(item, authorsOf(stored))) throw new NotAllowedError(messages.spNotFound);
    return { line, stored, editor };
  }

  /** What a new row starts with: "who paid" and, when the approver buys, today as the date, which the approver sets right when buying (P-037). */
  private newRowDefaults(request: PurchaseRequest, existing: readonly PurchaseLine[]): { paidBy: PurchaseLine['paidBy']; date: string } {
    return request.buyer === 'approver' ? { paidBy: 'company', date: toIsoDate(this.now()) } : { paidBy: defaultPaidBy(existing), date: '' };
  }

  private async createLine(request: PurchaseRequest, rowNumber: number, start: { paidBy: PurchaseLine['paidBy']; date: string }): Promise<number> {
    const created = await this.sp.post<{ Id: number }>(this.items('lines'), {
      Title: `${request.requestNumber} row ${rowNumber}`,
      RequestId: request.id,
      RowNumber: rowNumber,
      ...lineFields({ paidBy: start.paidBy, ...(start.date ? { date: start.date } : {}) })
    });
    if (!created) throw new Error(messages.spOther(500));
    return created.Id;
  }

  /**
   * Stores a file exactly as uploaded, under a name SharePoint accepts, with its
   * fingerprint and kind. If the kind cannot be recorded, the file is taken off
   * again (best effort) and the error passed on: a file whose kind is not
   * recorded reads as a quote (mapping.ts), and must not be left behind.
   */
  private async attach(lineId: number, existing: readonly AttachedFile[], file: File, kind: FileKind): Promise<void> {
    const taken = new Set(existing.map((f) => f.fileName.toLowerCase()));
    const name = uniqueName(cleanFileName(file.name), taken);
    const prints = [...existing.map(storedFingerprint), { fileName: name, sizeBytes: file.size, fingerprint: await fingerprintFile(file), kind }];
    await this.sp.postBinary(this.addAttachmentPath('lines', lineId, name), file);
    try {
      await this.sp.merge(this.item('lines', lineId), { FileFingerprints: JSON.stringify(prints) });
    } catch (e) {
      await this.sp.remove(this.attachmentPath('lines', lineId, name)).catch(() => undefined);
      throw e;
    }
  }

  /**
   * Confirms the categories of a request's rows as the approver or administrator
   * chose (P-024). Every choice is checked before any row is written.
   */
  private async confirmCategoriesOn(lines: PurchaseLine[], choices: Record<string, CategoryChoice>, confirmedBy: string): Promise<PurchaseLine[]> {
    const updates = categoryUpdates(lines, choices, confirmedBy);
    for (const [id, update] of updates) await this.sp.merge(this.item('lines', Number(id)), lineFields(update));
    return lines.map((l) => ({ ...l, ...updates.get(l.id) }));
  }

  /** Keeps the request's stored totals current, for the request lists (docs/DATA_MODEL.md). */
  private async updateTotals(requestId: number, stored: StoredRequest): Promise<void> {
    // The stored fingerprints are enough for totals; the attachment list is not needed.
    const authors = authorsOf(stored);
    const items = await this.sp.getAll<LineItem>(`${this.items('lines')}?$select=${LINE_FIELDS}&$filter=RequestId eq ${requestId}&${PAGE}`);
    const totals = computeTotals(items.filter((i) => madeBy(i, authors)).map(lineFromItem), stored.request.buyer);
    await this.sp.merge(
      this.item('requests', requestId),
      requestFields({ totalReimburseCents: totals.reimburseCents, totalCompanyCents: totals.companyCents, totalRequestCents: totals.requestCents })
    );
  }
}

function byLastChanged(a: PurchaseRequest, b: PurchaseRequest): number {
  return b.lastChanged.localeCompare(a.lastChanged);
}
