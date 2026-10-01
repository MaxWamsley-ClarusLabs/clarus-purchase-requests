// The rules both data services must follow, written once and run against the
// SharePoint service (on the fake SharePoint) and the mock service, so the
// preview behaves like the real site. Each test file supplies a harness that
// makes a new site and signs people in; what only one of them can show (the
// stored columns, the REST calls, the simulated flow) is tested in its own file.
// Tests use global describe, it and expect only, so they also run under Jest.
//
// One file on purpose: both services run the same tests, so there is one place to read what "the same" means. It is longer than the lint rule's 2000 lines.

/* eslint-disable max-lines */
import { messages } from '../../domain/messages';
import { CERTIFICATION, isSelfApproved, vendorKey } from '../../domain/purchaseRules';
import { ApprovalGroup, CategoryId, PackageStatus, PaidById, PurchaseLine, RequestStatus, SubmissionType } from '../../domain/types';
import { ApprovalRequiredError, SubmissionBlockedError } from '../../export/submission';
import { ApproveOptions, PurchaseDataService, RequestChanges } from '../PurchaseDataService';
import { NotAllowedError, notAllowed } from '../sharepoint/serviceRules';

export interface Person {
  name: string;
  email: string;
  admin: boolean;
}

export const JANE: Person = { name: 'Jane Doe', email: 'jane.doe@example.com', admin: false };
export const SAM: Person = { name: 'Sam Lee', email: 'sam.lee@example.com', admin: false };
/** An administrator, who is also the approver (P-020). */
export const MAX: Person = { name: 'Max Wamsley', email: 'max.wamsley@example.com', admin: true };
/** A second site Owner, who is an administrator and approver too, but did not approve Max's requests (P-037). */
export const OLIVE: Person = { name: 'Olive Owner', email: 'olive.owner@example.com', admin: true };

/** A change made to a row directly in SharePoint, outside the app and its locks (travel D-002). */
export interface DirectLineEdit {
  amountCents?: number;
  vendor?: string;
  date?: string;
}

export interface Harness {
  /** The service, signed in as this person. `now` sets the clock for the times it writes. */
  as(person: Person, now?: Date): PurchaseDataService;
  /** Leaves a submission as the flow would, for the retry tests. `madeAt` sets when it was made. */
  setSubmissionState(id: number, status: PackageStatus, errorMessage?: string, madeAt?: Date): void;
  /** Changes a row as its owner can directly in SharePoint, whatever the request's status. */
  editLineDirectly(lineId: string, edit: DirectLineEdit): void;
  /** Adds an earlier attempt that stopped part-way, still Uploading, as the person's own item. Returns its ID. */
  addUploadingSubmission(owner: Person, request: { id: number; requestNumber: string }, type: SubmissionType, number: number): number;
  /** Leaves an approval on a request, as an edit made directly in SharePoint could (travel D-002). */
  leaveApproval(requestId: number, approver: Person, approved: ApprovalGroup[]): void;
}

const NOW = new Date(2026, 9, 16, 9, 30);
const APPROVED_AT = new Date(2026, 9, 17, 10, 5);
const SUBMITTED_AT = new Date(2026, 9, 18, 11, 15);

/** The vendor matching key of the request most tests use. */
const ACME_KEY = vendorKey('Acme Lab Supply');

const pdf = (name: string, content = `synthetic ${name}`): File => new File([content], name, { type: 'application/pdf' });
const png = (name: string, content = `synthetic ${name}`): File => new File([content], name, { type: 'image/png' });

/** One purchase for `fill`. Dates are after the day the request is sent, so nothing looks already bought. */
interface Row {
  vendor: string;
  amountCents: number;
  date?: string;
  description?: string;
  category?: CategoryId;
  paidBy?: PaidById;
  noQuoteReason?: string;
  noReceiptReason?: string;
  quotes?: string[];
  receipts?: string[];
  /** The item's web address; filled in for a request the approver buys when not given (P-039). */
  itemLink?: string;
}

/** A vendor total of $1,000.00, which needs approval and has a quote. */
const ACME: Row = {
  vendor: 'Acme Lab Supply',
  amountCents: 100000,
  date: '2026-10-20',
  description: 'Pipette tips and centrifuge tubes',
  category: 'rdMaterials',
  quotes: ['acme-quote.pdf']
};
/** Under the threshold, paid by the employee. */
const NORTHWIND: Row = {
  vendor: 'Northwind Office Supply',
  amountCents: 8645,
  date: '2026-10-20',
  description: 'Lab notebooks and labels',
  category: 'office',
  paidBy: 'employee'
};
/** Under the threshold, with a receipt, so a request of this row needs no approval and can be submitted. */
const POSTAGE: Row = {
  vendor: 'QuickShip Postage',
  amountCents: 12500,
  date: '2026-10-20',
  description: 'Postage for sample shipments',
  category: 'shipping',
  receipts: ['postage.pdf']
};

// The tests below are about a request the employee buys, as in the first build; the approver-buys tests say so (P-037).
const HEADER: RequestChanges = { businessPurpose: 'Lab supplies for the Phase 1 assay', department: 'R&D', buyer: 'self' };

/** A new request the employee buys (P-037): the tests of rows, files, totals and submitting are about that case. */
async function createOwn(svc: PurchaseDataService): Promise<{ id: number }> {
  const created = await svc.createRequest();
  await svc.updateRequest(created.id, { buyer: 'self' });
  return { id: created.id };
}

/** Makes a request with its header and rows, as an employee would, and returns it as saved. */
async function fill(svc: PurchaseDataService, rows: readonly Row[], header: RequestChanges = HEADER): Promise<{ id: number; lines: PurchaseLine[] }> {
  const created = await svc.createRequest();
  // The employee buys unless a test says the approver does.
  const asked: RequestChanges = { buyer: 'self', ...header };
  await svc.updateRequest(created.id, asked);
  // When the approver buys, every row needs the item's web address, or a reason there is none (P-039).
  const needsLink = asked.buyer === 'approver';
  for (const row of rows) {
    const line = await svc.addEmptyLine(created.id);
    await svc.updateLine(line.id, {
      date: row.date ?? '2026-10-20',
      vendor: row.vendor,
      description: row.description ?? 'Supplies',
      category: row.category ?? 'office',
      amountCents: row.amountCents,
      paidBy: row.paidBy ?? 'company',
      noQuoteReason: row.noQuoteReason ?? '',
      noReceiptReason: row.noReceiptReason ?? '',
      ...(row.itemLink !== undefined ? { itemLink: row.itemLink } : needsLink ? { itemLink: `https://www.example.com/${encodeURIComponent(row.vendor)}` } : {})
    });
    for (const name of row.quotes ?? []) await svc.addFileToLine(line.id, pdf(name), 'quote');
    for (const name of row.receipts ?? []) await svc.addFileToLine(line.id, pdf(name), 'receipt');
  }
  return { id: created.id, lines: (await svc.getRequest(created.id)).lines };
}

/** Jane's request with a vendor total that needs approval, sent for approval. */
async function sent(h: Harness, rows: readonly Row[] = [ACME, NORTHWIND]) {
  const jane = h.as(JANE, NOW);
  const made = await fill(jane, rows);
  return { ...made, submission: await jane.sendForApproval(made.id) };
}

/** Jane attaches a receipt to every row that has none, which she does after buying. */
async function attachReceipts(svc: PurchaseDataService, id: number): Promise<void> {
  for (const line of (await svc.getRequest(id)).lines) {
    if (line.files.every((f) => f.kind !== 'receipt')) await svc.addFileToLine(line.id, pdf(`receipt-row${line.rowNumber}.pdf`), 'receipt');
  }
}

/** Sent, approved by Max, and ready to submit: every row has a receipt. */
async function approvedAndReady(h: Harness, options: ApproveOptions = { note: 'OK, use the company card.', categories: {} }) {
  const made = await sent(h);
  await h.as(MAX, APPROVED_AT).approveRequest(made.id, options);
  await attachReceipts(h.as(JANE, SUBMITTED_AT), made.id);
  return { ...made, lines: (await h.as(JANE, SUBMITTED_AT).getRequest(made.id)).lines };
}

/** A request in each status, reached the way the app reaches it. */
async function requestInState(h: Harness, status: RequestStatus): Promise<number> {
  const jane = h.as(JANE, NOW);
  const max = h.as(MAX, APPROVED_AT);
  const submitted = async () => {
    const made = await fill(jane, [POSTAGE]);
    await jane.submitRequest(made.id, CERTIFICATION);
    return made.id;
  };
  switch (status) {
    case 'Draft':
      return (await fill(jane, [POSTAGE])).id;
    case 'Awaiting approval':
      return (await sent(h)).id;
    case 'Approved':
      return (await approvedAndReady(h)).id;
    case 'Submitted':
      return submitted();
    case 'Returned': {
      const id = await submitted();
      await max.returnRequest(id, 'Please attach the itemized invoice.');
      return id;
    }
    case 'Processed': {
      const id = await submitted();
      await max.markProcessed(id);
      return id;
    }
  }
}

const STATUSES: RequestStatus[] = ['Draft', 'Awaiting approval', 'Approved', 'Submitted', 'Returned', 'Processed'];

/** Lets the mock's simulated flow finish the steps it runs on timers, so a test can then set a submission's state itself. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 5));
}

/** Resolves to the error a call was refused with, which must be a NotAllowedError. */
async function refusal(call: Promise<unknown>): Promise<Error> {
  try {
    await call;
  } catch (e) {
    expect(e).toBeInstanceOf(NotAllowedError);
    return e as Error;
  }
  throw new Error('The call was allowed, but it should have been refused.');
}

export function describeDataServiceRules(label: string, makeHarness: () => Promise<Harness>): void {
  describe(`${label}: who may do what`, () => {
    it('knows who is signed in and whether they are an administrator', async () => {
      const h = await makeHarness();
      expect(await h.as(JANE).getCurrentUser()).toEqual({ displayName: 'Jane Doe', email: 'jane.doe@example.com', isAdministrator: false });
      expect(await h.as(MAX).getCurrentUser()).toEqual({ displayName: 'Max Wamsley', email: 'max.wamsley@example.com', isAdministrator: true });
    });

    it('shows employees only their own requests, and everything to an administrator', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const sam = h.as(SAM, NOW);
      const max = h.as(MAX, NOW);
      const first = await fill(jane, [POSTAGE]);
      await jane.createRequest();
      await sam.createRequest();
      expect((await jane.listMyRequests()).map((r) => r.ownerEmail)).toEqual([JANE.email, JANE.email]);
      expect((await sam.listMyRequests()).map((r) => r.ownerEmail)).toEqual([SAM.email]);
      await refusal(sam.getRequest(first.id));
      await refusal(sam.listSubmissionsForRequest(first.id));
      await refusal(sam.getOwnerOtherLines(first.id));
      expect((await max.listAllRequests()).length).toBe(3);
      // An administrator's own list is only their own requests; they can still read anyone's.
      expect(await max.listMyRequests()).toEqual([]);
      expect((await max.getRequest(first.id)).request.ownerEmail).toBe(JANE.email);
    });

    it("answers a request, row or submission that does not exist as not allowed, as an employee cannot tell it from someone else's", async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const max = h.as(MAX, NOW);
      const calls: Record<string, () => Promise<unknown>> = {
        getRequest: () => jane.getRequest(999),
        getRequestAsAdministrator: () => max.getRequest(999),
        updateRequest: () => jane.updateRequest(999, { department: 'R&D' }),
        deleteRequest: () => jane.deleteRequest(999),
        addLinesFromFiles: () => jane.addLinesFromFiles(999, [pdf('a.pdf')], 'receipt'),
        addEmptyLine: () => jane.addEmptyLine(999),
        getOwnerOtherLines: () => jane.getOwnerOtherLines(999),
        sendForApproval: () => jane.sendForApproval(999),
        submitRequest: () => jane.submitRequest(999, CERTIFICATION),
        listSubmissionsForRequest: () => jane.listSubmissionsForRequest(999),
        updateLine: () => jane.updateLine('999', { vendor: 'x' }),
        updateLineWithAWord: () => jane.updateLine('no-such-line', { vendor: 'x' }),
        deleteLine: () => jane.deleteLine('999'),
        addFileToLine: () => jane.addFileToLine('999', pdf('a.pdf'), 'quote'),
        removeFileFromLine: () => jane.removeFileFromLine('999', 'a.pdf'),
        getSubmissionCsv: () => jane.getSubmissionCsv(999),
        approveRequest: () => max.approveRequest(999, { note: '', categories: {} }),
        returnRequest: () => max.returnRequest(999, 'No'),
        confirmCategories: () => max.confirmCategories(999, {}),
        markProcessed: () => max.markProcessed(999),
        retryPackaging: () => max.retryPackaging(999)
      };
      for (const [name, call] of Object.entries(calls)) expect([name, (await refusal(call())).message]).toEqual([name, messages.spNotFound]);
    });

    it("keeps employee changes for the request's owner, even for an administrator", async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id, lines } = await fill(jane, [POSTAGE]);
      for (const other of [h.as(SAM, NOW), h.as(MAX, NOW)]) {
        await refusal(other.updateRequest(id, { department: 'Ops' }));
        await refusal(other.addEmptyLine(id));
        await refusal(other.addLinesFromFiles(id, [pdf('a.pdf')], 'receipt'));
        await refusal(other.updateLine(lines[0].id, { vendor: 'Changed' }));
        await refusal(other.deleteLine(lines[0].id));
        await refusal(other.addFileToLine(lines[0].id, pdf('a.pdf'), 'quote'));
        await refusal(other.removeFileFromLine(lines[0].id, lines[0].files[0].id));
        await refusal(other.sendForApproval(id));
        await refusal(other.submitRequest(id, CERTIFICATION));
        await refusal(other.deleteRequest(id));
      }
      expect((await jane.getRequest(id)).lines[0].vendor).toBe(POSTAGE.vendor);
    });

    it('keeps approver and administrator actions for administrators', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id, submission } = await sent(h);
      await refusal(jane.listAllRequests());
      await refusal(jane.listSubmissions());
      await refusal(jane.listAllLineRefs());
      await refusal(jane.approveRequest(id, { note: '', categories: {} }));
      await refusal(jane.returnRequest(id, 'No'));
      await refusal(jane.confirmCategories(id, {}));
      await refusal(jane.markProcessed(id));
      await refusal(jane.retryPackaging(submission.id));
      await refusal(jane.getFlowSettings('test', 'https://contoso.sharepoint.com/sites/FormsAndApps/SitePages/Purchase-Requests.aspx'));
      await refusal(jane.runSetup(() => undefined));
      expect((await refusal(jane.approveRequest(id, { note: '', categories: {} }))).message).toBe(notAllowed.administratorsOnly);
      // Nothing changed.
      expect((await jane.getRequest(id)).request.status).toBe('Awaiting approval');
    });
  });

  describe(`${label}: creating and editing a request`, () => {
    it('creates a numbered Draft with zero totals and an empty approval', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const created = await jane.createRequest();
      expect(created).toMatchObject({
        requestNumber: 'PR-0001',
        status: 'Draft',
        businessPurpose: '',
        department: '',
        projectCode: '',
        ownerName: 'Jane Doe',
        ownerEmail: 'jane.doe@example.com',
        submissionCount: 0,
        approvalRounds: 0,
        totalReimburseCents: 0,
        totalCompanyCents: 0,
        totalRequestCents: 0,
        boughtBeforeApproval: false,
        returnNote: '',
        returnStage: '',
        approval: { sent: [], approved: [], earlier: [] },
        approvalNote: '',
        approvedOn: '',
        approvedBy: '',
        approvedByEmail: '',
        sentForApprovalOn: '',
        submittedOn: '',
        processedOn: '',
        processedBy: ''
      });
      expect(await jane.getRequest(created.id)).toMatchObject({ request: { id: created.id, requestNumber: 'PR-0001' }, lines: [] });
      expect((await jane.createRequest()).requestNumber).toBe('PR-0002');
    });

    it("fills in the department from the employee's latest request, never from someone else's (P-022)", async () => {
      const h = await makeHarness();
      const first = await h.as(JANE, new Date(2026, 9, 10, 9, 0)).createRequest();
      expect(first.department).toBe('');
      await h.as(JANE, new Date(2026, 9, 10, 9, 5)).updateRequest(first.id, { department: 'R&D' });
      const second = await h.as(JANE, new Date(2026, 9, 11, 9, 0)).createRequest();
      expect(second.department).toBe('R&D');
      await h.as(JANE, new Date(2026, 9, 12, 9, 0)).updateRequest(second.id, { department: 'Operations' });
      expect((await h.as(JANE, new Date(2026, 9, 13, 9, 0)).createRequest()).department).toBe('Operations');
      expect((await h.as(SAM, NOW).createRequest()).department).toBe('');
    });

    it('saves the business purpose, department and project code', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await jane.createRequest();
      const header = { businessPurpose: 'Lab supplies for the Phase 1 assay', department: 'R&D', projectCode: 'NSF SBIR Phase 1 (Award # 2528301)' };
      expect(await jane.updateRequest(id, header)).toMatchObject(header);
      expect((await jane.getRequest(id)).request).toMatchObject(header);
      // Fields not given are left alone.
      await jane.updateRequest(id, { department: 'Operations' });
      expect((await jane.getRequest(id)).request).toMatchObject({ ...header, department: 'Operations' });
    });

    it('cuts one-line header text to 255 characters', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await jane.createRequest();
      await jane.updateRequest(id, { businessPurpose: 'p'.repeat(300), department: 'd'.repeat(300), projectCode: 'c'.repeat(300) });
      const { request } = await jane.getRequest(id);
      expect([request.businessPurpose.length, request.department.length, request.projectCode.length]).toEqual([255, 255, 255]);
    });

    it('lets the employee edit a request only while it is Draft, Returned or Approved, and refuses it as locked in the others (P-027)', async () => {
      const h = await makeHarness();
      for (const status of STATUSES) {
        const id = await requestInState(h, status);
        const jane = h.as(JANE, SUBMITTED_AT);
        const { request, lines } = await jane.getRequest(id);
        expect(request.status).toBe(status);
        const attempts: Record<string, () => Promise<unknown>> = {
          updateRequest: () => jane.updateRequest(id, { department: 'Operations' }),
          addEmptyLine: () => jane.addEmptyLine(id),
          addLinesFromFiles: () => jane.addLinesFromFiles(id, [pdf('new.pdf')], 'receipt'),
          updateLine: () => jane.updateLine(lines[0].id, { description: 'Changed' }),
          addFileToLine: () => jane.addFileToLine(lines[0].id, pdf('extra.pdf'), 'quote'),
          removeFileFromLine: () => jane.removeFileFromLine(lines[0].id, lines[0].files[0].id),
          deleteLine: () => jane.deleteLine(lines[0].id)
        };
        const editable = status === 'Draft' || status === 'Returned' || status === 'Approved';
        for (const [name, attempt] of Object.entries(attempts)) {
          if (editable) await attempt();
          else expect([name, (await refusal(attempt())).message]).toEqual([name, notAllowed.locked]);
        }
        const after = (await jane.getRequest(id)).request;
        expect(after.department).toBe(editable ? 'Operations' : 'R&D');
      }
    });

    it('deletes only a Draft, with its rows, and leaves the other requests alone', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const keep = await fill(jane, [POSTAGE]);
      const draft = await fill(jane, [POSTAGE, NORTHWIND]);
      await jane.deleteRequest(draft.id);
      await refusal(jane.getRequest(draft.id));
      expect((await jane.listMyRequests()).map((r) => r.id)).toEqual([keep.id]);
      expect((await jane.getRequest(keep.id)).lines).toHaveLength(1);
      expect(await h.as(MAX).listAllLineRefs()).toHaveLength(1);

      for (const status of ['Awaiting approval', 'Approved', 'Submitted', 'Returned', 'Processed'] as const) {
        const id = await requestInState(h, status);
        const message = (await refusal(h.as(JANE, NOW).deleteRequest(id))).message;
        expect([status, message]).toEqual([status, status === 'Approved' || status === 'Returned' ? notAllowed.draftsOnly : notAllowed.locked]);
        expect((await h.as(JANE, NOW).getRequest(id)).request.status).toBe(status);
      }
    });

    it('also removes an approval attempt that stopped part-way when a Draft is deleted', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const draft = await fill(jane, [ACME]);
      const stale = h.addUploadingSubmission(JANE, { id: draft.id, requestNumber: 'PR-0001' }, 'approval', 1);
      expect((await h.as(MAX).listSubmissions()).map((s) => s.id)).toEqual([stale]);
      await jane.deleteRequest(draft.id);
      expect(await h.as(MAX).listSubmissions()).toEqual([]);
    });
  });

  describe(`${label}: rows and their files`, () => {
    it('makes one row per file that passes the checks, with the kind, the fingerprint and who paid (P-021, P-023)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await createOwn(jane);
      const tooBig = new File([new Uint8Array(15 * 1024 * 1024 + 1)], 'huge.pdf', { type: 'application/pdf' });
      const added = await jane.addLinesFromFiles(
        id,
        [pdf('invoice.pdf'), new File(['x'], 'notes.txt'), pdf('empty.pdf', ''), tooBig, png('slip.png')],
        'receipt'
      );
      expect(added.map((l) => [l.rowNumber, l.files.map((f) => [f.fileName, f.kind])])).toEqual([
        [1, [['invoice.pdf', 'receipt']]],
        [2, [['slip.png', 'receipt']]]
      ]);
      expect(added[0].files[0].fingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(added[0].files[0].fingerprint).not.toBe(added[1].files[0].fingerprint);
      expect(added[0].files[0]).toMatchObject({ sizeBytes: 'synthetic invoice.pdf'.length, contentType: 'application/pdf' });
      expect(added[1].files[0].contentType).toBe('image/png');
      // The first row of a request starts as paid by the company; each new row copies the row above.
      expect(added.map((l) => l.paidBy)).toEqual(['company', 'company']);
      expect(added[0]).toMatchObject({
        requestId: id,
        date: '',
        vendor: '',
        category: '',
        amountCents: null,
        categoryConfirmedBy: '',
        sameReceiptAsRow: null,
        suggested: []
      });

      await jane.updateLine(added[1].id, { paidBy: 'employee' });
      const quotes = await jane.addLinesFromFiles(id, [pdf('quote.pdf')], 'quote');
      expect(quotes[0]).toMatchObject({ rowNumber: 3, paidBy: 'employee' });
      expect(quotes[0].files.map((f) => [f.fileName, f.kind])).toEqual([['quote.pdf', 'quote']]);
      expect((await jane.getRequest(id)).lines.map((l) => l.rowNumber)).toEqual([1, 2, 3]);
    });

    it("adds an empty row with the next number and the row above's way of paying", async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await createOwn(jane);
      const one = await jane.addEmptyLine(id);
      expect(one).toMatchObject({ rowNumber: 1, paidBy: 'company', files: [], amountCents: null });
      await jane.updateLine(one.id, { paidBy: 'employee' });
      expect(await jane.addEmptyLine(id)).toMatchObject({ rowNumber: 2, paidBy: 'employee' });
    });

    it('saves every field of a row, and keeps the request totals current', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await createOwn(jane);
      const a = await jane.addEmptyLine(id);
      const b = await jane.addEmptyLine(id);
      const saved = await jane.updateLine(a.id, {
        date: '2026-10-20',
        vendor: 'Acme Lab Supply',
        description: 'Pipette tips',
        category: 'other',
        categoryOther: 'Lab safety audit',
        amountCents: 12500,
        paidBy: 'company',
        noQuoteReason: 'Sole supplier',
        noReceiptReason: 'Receipt lost',
        suggested: ['paidBy', 'date']
      });
      expect(saved).toMatchObject({
        date: '2026-10-20',
        vendor: 'Acme Lab Supply',
        description: 'Pipette tips',
        category: 'other',
        categoryOther: 'Lab safety audit',
        amountCents: 12500,
        paidBy: 'company',
        noQuoteReason: 'Sole supplier',
        noReceiptReason: 'Receipt lost',
        suggested: ['date', 'paidBy']
      });
      expect((await jane.getRequest(id)).lines[0]).toMatchObject({ ...saved, files: [] });
      await jane.updateLine(b.id, { amountCents: 2500, paidBy: 'employee' });
      expect((await jane.getRequest(id)).request).toMatchObject({ totalReimburseCents: 2500, totalCompanyCents: 12500, totalRequestCents: 15000 });
      // A row that nobody has said who paid for counts only in the request total.
      await jane.updateLine(b.id, { paidBy: '' });
      expect((await jane.getRequest(id)).request).toMatchObject({ totalReimburseCents: 0, totalCompanyCents: 12500, totalRequestCents: 15000 });
      await jane.updateLine(b.id, { paidBy: 'company', amountCents: null });
      expect((await jane.getRequest(id)).request).toMatchObject({ totalReimburseCents: 0, totalCompanyCents: 12500, totalRequestCents: 12500 });
    });

    it('ignores an undefined field, and a category or way of paying that is not a choice', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id, lines } = await fill(jane, [NORTHWIND]);
      const odd = await jane.updateLine(lines[0].id, { vendor: undefined, category: 'snacks' as CategoryId, paidBy: 'somebody' as PaidById });
      expect(odd).toMatchObject({ vendor: NORTHWIND.vendor, category: '', paidBy: '' });
      expect((await jane.getRequest(id)).lines[0]).toMatchObject({ vendor: NORTHWIND.vendor, category: '', paidBy: '' });
    });

    it('cuts one-line row text to 255 characters', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { lines } = await fill(jane, [NORTHWIND]);
      const long = 'x'.repeat(300);
      const saved = await jane.updateLine(lines[0].id, {
        vendor: long,
        description: long,
        category: 'other',
        categoryOther: long,
        noQuoteReason: long,
        noReceiptReason: long
      });
      for (const value of [saved.vendor, saved.description, saved.categoryOther, saved.noQuoteReason, saved.noReceiptReason]) expect(value.length).toBe(255);
    });

    it('clears who confirmed a category when the employee changes it, but not when something else changes (P-024)', async () => {
      const h = await makeHarness();
      const { id, lines } = await approvedAndReady(h);
      const jane = h.as(JANE, SUBMITTED_AT);
      const confirmed = (await jane.getRequest(id)).lines;
      expect(confirmed.map((l) => l.categoryConfirmedBy)).toEqual(['Max Wamsley', 'Max Wamsley']);
      // Something else changing, or the same category sent again, keeps the confirmation.
      await jane.updateLine(lines[0].id, { description: 'Pipette tips, second box' });
      await jane.updateLine(lines[0].id, { category: 'rdMaterials' });
      expect((await jane.getRequest(id)).lines[0].categoryConfirmedBy).toBe('Max Wamsley');
      // A different category is the employee's suggestion again.
      expect((await jane.updateLine(lines[0].id, { category: 'computer' })).categoryConfirmedBy).toBe('');
      expect((await jane.getRequest(id)).lines.map((l) => l.categoryConfirmedBy)).toEqual(['', 'Max Wamsley']);
      // So is a different description of Other.
      await jane.updateLine(lines[1].id, { category: 'other', categoryOther: 'Lab safety audit' });
      await jane.updateLine(lines[1].id, { categoryConfirmedBy: 'Max Wamsley' } as never);
      expect((await jane.getRequest(id)).lines[1].categoryConfirmedBy).toBe('');
    });

    it('renumbers the rows after a deletion, keeps same-receipt pointers right, and recomputes totals', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await createOwn(jane);
      const [a, b] = await jane.addLinesFromFiles(id, [pdf('a.pdf'), pdf('b.pdf')], 'receipt');
      // Row 3 uses row 2's receipt, so it holds none of its own.
      const c = await jane.addEmptyLine(id);
      await jane.updateLine(a.id, { amountCents: 1000, paidBy: 'company' });
      await jane.updateLine(b.id, { amountCents: 2000, paidBy: 'employee' });
      await jane.updateLine(c.id, { amountCents: 3000, paidBy: 'company', sameReceiptAsRow: 2 });
      await jane.deleteLine(a.id);
      const after = await jane.getRequest(id);
      expect(after.lines.map((l) => [l.id, l.rowNumber, l.sameReceiptAsRow])).toEqual([
        [b.id, 1, null],
        [c.id, 2, 1]
      ]);
      expect(after.request).toMatchObject({ totalReimburseCents: 2000, totalCompanyCents: 3000, totalRequestCents: 5000 });
      // Deleting the row a pointer names takes the pointer away.
      await jane.deleteLine(b.id);
      const last = await jane.getRequest(id);
      expect(last.lines.map((l) => [l.id, l.rowNumber, l.sameReceiptAsRow])).toEqual([[c.id, 1, null]]);
      expect(last.request).toMatchObject({ totalReimburseCents: 0, totalCompanyCents: 3000, totalRequestCents: 3000 });
      // A new row takes the next number, not one that is in use.
      expect((await jane.addEmptyLine(id)).rowNumber).toBe(2);
    });

    it('attaches files by kind, under names that stay unique on a row, and removes them', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await createOwn(jane);
      const [line] = await jane.addLinesFromFiles(id, [pdf('receipt.pdf')], 'receipt');
      const two = await jane.addFileToLine(line.id, pdf('receipt.pdf', 'the card slip'), 'receipt');
      expect(two.files.map((f) => [f.fileName, f.kind])).toEqual([
        ['receipt.pdf', 'receipt'],
        ['receipt (2).pdf', 'receipt']
      ]);
      const withQuote = await jane.addFileToLine(line.id, pdf('receipt.pdf', 'a quote'), 'quote');
      expect(withQuote.files.map((f) => [f.fileName, f.kind])).toEqual([
        ['receipt.pdf', 'receipt'],
        ['receipt (2).pdf', 'receipt'],
        ['receipt (3).pdf', 'quote']
      ]);
      expect(new Set(withQuote.files.map((f) => f.fingerprint)).size).toBe(3);
      expect((await jane.getRequest(id)).lines[0].files.map((f) => f.kind)).toEqual(['receipt', 'receipt', 'quote']);

      const one = await jane.removeFileFromLine(line.id, withQuote.files[0].id);
      expect(one.files.map((f) => f.fileName)).toEqual(['receipt (2).pdf', 'receipt (3).pdf']);
      expect(one.files.map((f) => f.kind)).toEqual(['receipt', 'quote']);
      expect(one.files[0].fingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect((await jane.getRequest(id)).lines[0].files.map((f) => f.fileName)).toEqual(['receipt (2).pdf', 'receipt (3).pdf']);
      // A file that is not on the row changes nothing.
      expect((await jane.removeFileFromLine(line.id, 'no-such-file')).files).toHaveLength(2);
    });

    it('does not add a file that is the wrong type, empty or too large', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { lines } = await fill(jane, [NORTHWIND]);
      for (const refused of [
        new File(['x'], 'notes.txt'),
        pdf('empty.pdf', ''),
        new File([new Uint8Array(15 * 1024 * 1024 + 1)], 'huge.pdf', { type: 'application/pdf' })
      ]) {
        expect((await jane.addFileToLine(lines[0].id, refused, 'receipt')).files).toEqual([]);
      }
      expect((await jane.getRequest(lines[0].requestId)).lines[0].files).toEqual([]);
    });

    it('replaces "same receipt as row N" when a receipt is attached, but not when a quote is (P-021)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await createOwn(jane);
      const [one, two] = await jane.addLinesFromFiles(id, [pdf('a.pdf'), pdf('b.pdf')], 'receipt');
      await jane.removeFileFromLine(two.id, two.files[0].id);
      await jane.updateLine(two.id, { sameReceiptAsRow: 1 });
      expect(one.rowNumber).toBe(1);
      const withQuote = await jane.addFileToLine(two.id, pdf('quote.pdf'), 'quote');
      expect(withQuote.sameReceiptAsRow).toBe(1);
      expect((await jane.getRequest(id)).lines[1]).toMatchObject({ sameReceiptAsRow: 1 });
      const withReceipt = await jane.addFileToLine(two.id, pdf('own.pdf'), 'receipt');
      expect(withReceipt.sameReceiptAsRow).toBeNull();
      expect((await jane.getRequest(id)).lines[1].sameReceiptAsRow).toBeNull();
    });

    it('refuses to point a row that holds a receipt of its own at another row, until that receipt is removed (travel D-038)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await createOwn(jane);
      const [, two] = await jane.addLinesFromFiles(id, [pdf('a.pdf'), pdf('b.pdf')], 'receipt');
      const refused = await refusal(jane.updateLine(two.id, { description: 'Centrifuge tubes', sameReceiptAsRow: 1 }));
      expect(refused.message).toBe(notAllowed.sharedReceiptHasOwn);
      // Nothing in the refused change was saved.
      expect((await jane.getRequest(id)).lines[1]).toMatchObject({ description: '', sameReceiptAsRow: null });
      expect((await jane.getRequest(id)).lines[1].files.map((f) => f.fileName)).toEqual(['b.pdf']);
      // A quote is not a receipt: once the row holds only a quote, it can use row 1's receipt.
      await jane.removeFileFromLine(two.id, two.files[0].id);
      await jane.addFileToLine(two.id, pdf('quote.pdf'), 'quote');
      expect((await jane.updateLine(two.id, { sameReceiptAsRow: 1 })).sameReceiptAsRow).toBe(1);
      expect((await jane.getRequest(id)).lines[1].sameReceiptAsRow).toBe(1);
      // Taking the pointer away is always allowed.
      expect((await jane.updateLine(two.id, { sameReceiptAsRow: null })).sameReceiptAsRow).toBeNull();
    });

    it('keeps a description of the category only for Other: choosing another category clears it (P-024)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id, lines } = await fill(jane, [NORTHWIND]);
      await jane.updateLine(lines[0].id, { category: 'other', categoryOther: 'Lab safety audit' });
      expect((await jane.getRequest(id)).lines[0]).toMatchObject({ category: 'other', categoryOther: 'Lab safety audit' });
      expect(await jane.updateLine(lines[0].id, { category: 'office' })).toMatchObject({ category: 'office', categoryOther: '' });
      expect((await jane.getRequest(id)).lines[0]).toMatchObject({ category: 'office', categoryOther: '' });
      // A description sent for a category that needs none is not kept.
      expect(await jane.updateLine(lines[0].id, { categoryOther: 'Left over' })).toMatchObject({ category: 'office', categoryOther: '' });
      expect((await jane.getRequest(id)).lines[0].categoryOther).toBe('');
    });

    it("stores unconfirmed suggestions in the grid's order, and will not submit until they are confirmed (travel D-078)", async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id, lines } = await fill(jane, [POSTAGE]);
      await jane.updateLine(lines[0].id, { suggested: ['paidBy', 'amount', 'amount'] });
      expect((await jane.getRequest(id)).lines[0].suggested).toEqual(['amount', 'paidBy']);
      await expect(jane.submitRequest(id, CERTIFICATION)).rejects.toBeInstanceOf(SubmissionBlockedError);
      expect(await jane.listSubmissionsForRequest(id)).toEqual([]);
      await jane.updateLine(lines[0].id, { suggested: [] });
      expect((await jane.submitRequest(id, CERTIFICATION)).type).toBe('package');
    });
  });

  describe(`${label}: sending for approval`, () => {
    it('refuses a request whose vendor totals are all under the threshold (P-005)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await fill(jane, [POSTAGE, NORTHWIND]);
      await expect(jane.sendForApproval(id)).rejects.toThrow(messages.approvalNotNeeded);
      expect(await jane.listSubmissionsForRequest(id)).toEqual([]);
      expect((await jane.getRequest(id)).request.status).toBe('Draft');
    });

    it('counts a vendor across rows, so a purchase cannot be split to stay under the threshold (P-016)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const split = [
        { ...ACME, amountCents: 30000, vendor: 'Acme Lab Supply', quotes: ['acme-quote.pdf'] },
        { ...ACME, amountCents: 30000, vendor: 'ACME LAB SUPPLY.', quotes: [] }
      ];
      const { id } = await fill(jane, split);
      const submission = await jane.sendForApproval(id);
      expect(submission.emailSummary).toContain('- Acme Lab Supply: $600.00 (quote attached)');
      expect((await jane.getRequest(id)).request.approval.sent).toEqual([{ key: ACME_KEY, vendor: 'Acme Lab Supply', cents: 60000, bought: false }]);
    });

    it('counts the spellings of one vendor together: $300 at "Digi-Key" and $300 at "DigiKey" need approval and a quote (P-016)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id, lines } = await fill(jane, [
        { ...ACME, vendor: 'Digi-Key', amountCents: 30000, quotes: [] },
        { ...ACME, vendor: 'DigiKey', amountCents: 30000, quotes: [] }
      ]);
      await expect(jane.submitRequest(id, CERTIFICATION)).rejects.toBeInstanceOf(ApprovalRequiredError);
      const error = await jane.sendForApproval(id).then(
        () => undefined,
        (e: unknown) => e
      );
      expect(error).toBeInstanceOf(SubmissionBlockedError);
      expect((error as SubmissionBlockedError).issues.map((i) => [i.rowNumber, i.field])).toEqual([[1, 'quote']]);
      await jane.updateLine(lines[0].id, { noQuoteReason: 'Catalog price' });
      const submission = await jane.sendForApproval(id);
      expect(submission.emailSummary).toContain('- Digi-Key: $600.00 (no quote: Catalog price)');
      expect((await jane.getRequest(id)).request.approval.sent).toEqual([{ key: 'digikey', vendor: 'Digi-Key', cents: 60000, bought: false }]);
    });

    it('refuses a vendor total at the threshold with no quote and no reason (P-015), and allows it with a reason', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id, lines } = await fill(jane, [{ ...ACME, amountCents: 50000, quotes: [] }]);
      const error = await jane.sendForApproval(id).then(
        () => undefined,
        (e: unknown) => e
      );
      expect(error).toBeInstanceOf(SubmissionBlockedError);
      expect((error as SubmissionBlockedError).issues.map((i) => i.field)).toEqual(['quote']);
      expect((await jane.getRequest(id)).request.status).toBe('Draft');
      expect(await jane.listSubmissionsForRequest(id)).toEqual([]);

      await jane.updateLine(lines[0].id, { noQuoteReason: 'Sole supplier' });
      expect((await jane.sendForApproval(id)).type).toBe('approval');
      // A vendor total one cent under the threshold needs neither approval nor a quote.
      const under = await fill(jane, [{ ...ACME, amountCents: 49999, quotes: [] }]);
      await expect(jane.sendForApproval(under.id)).rejects.toThrow(messages.approvalNotNeeded);
    });

    it('also refuses a request with something else to fix, naming what', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await fill(jane, [ACME], { businessPurpose: '', department: '' });
      const error = await jane.sendForApproval(id).then(
        () => undefined,
        (e: unknown) => e
      );
      expect(error).toBeInstanceOf(SubmissionBlockedError);
      expect((error as SubmissionBlockedError).issues.map((i) => i.field).sort()).toEqual(['businessPurpose', 'department']);
    });

    it('locks the request, records what was sent, and makes an approval request with no files (P-018)', async () => {
      const h = await makeHarness();
      const { id, submission } = await sent(h);
      expect(submission).toMatchObject({
        requestId: id,
        requestNumber: 'PR-0001',
        type: 'approval',
        submissionNumber: 1,
        packageStatus: 'Ready',
        folderName: '',
        previousFolderName: '',
        certificationText: '',
        submitterName: 'Jane Doe',
        submitterEmail: 'jane.doe@example.com',
        businessPurpose: 'Lab supplies for the Phase 1 assay',
        department: 'R&D',
        purchaseDates: '2026-10-20',
        totalReimburseCents: 8645,
        totalCompanyCents: 100000,
        totalRequestCents: 108645,
        receiptCount: 0,
        quoteCount: 1,
        rowsWithoutReceipt: 0,
        boughtBeforeApproval: false,
        approvedBy: '',
        approvedOn: '',
        emailSubject: 'Purchase approval needed: Jane Doe, Lab supplies for the Phase 1 assay (PR-0001)',
        folderLink: '',
        errorMessage: '',
        packageFileNames: []
      });
      expect(submission.emailSummary).toContain('Needs your approval (vendor totals of $500 or more):');
      expect(submission.emailSummary).toContain('- Acme Lab Supply: $1,000.00 (quote attached)');
      expect(submission.emailSummary).not.toContain('Northwind Office Supply: $86.45 (');

      const jane = h.as(JANE, NOW);
      const { request } = await jane.getRequest(id);
      expect(request).toMatchObject({
        status: 'Awaiting approval',
        approvalRounds: 1,
        sentForApprovalOn: '2026-10-16 09:30',
        boughtBeforeApproval: false,
        returnNote: '',
        returnStage: '',
        approvedOn: '',
        approvedBy: '',
        approvalNote: '',
        approval: { sent: [{ key: ACME_KEY, vendor: 'Acme Lab Supply', cents: 100000, bought: false }], approved: [], earlier: [] }
      });
      expect((await jane.listSubmissionsForRequest(id)).map((s) => [s.type, s.submissionNumber, s.id])).toEqual([['approval', 1, submission.id]]);
      expect(await jane.getSubmissionCsv(submission.id)).toBe('');
    });

    it('is locked while it awaits approval, and cannot be sent or submitted again (P-027)', async () => {
      const h = await makeHarness();
      const { id } = await sent(h);
      const jane = h.as(JANE, NOW);
      expect((await refusal(jane.updateRequest(id, { department: 'Operations' }))).message).toBe(notAllowed.locked);
      expect((await refusal(jane.sendForApproval(id))).message).toBe(notAllowed.locked);
      expect((await refusal(jane.submitRequest(id, CERTIFICATION))).message).toBe(notAllowed.locked);
      expect(await jane.listSubmissionsForRequest(id)).toHaveLength(1);
    });

    it('flags a purchase dated before the day it is sent as bought before approval (P-017)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await fill(jane, [{ ...ACME, date: '2026-10-10' }, NORTHWIND]);
      const submission = await jane.sendForApproval(id);
      expect(submission.boughtBeforeApproval).toBe(true);
      expect(submission.emailSummary).toContain('FLAG, bought before approval: Acme Lab Supply ($1,000.00).');
      const { request } = await jane.getRequest(id);
      expect(request.boughtBeforeApproval).toBe(true);
      expect(request.approval.sent).toEqual([{ key: ACME_KEY, vendor: 'Acme Lab Supply', cents: 100000, bought: true }]);
      // The day it is sent is not before it.
      const today = await fill(jane, [{ ...ACME, date: '2026-10-16' }]);
      expect((await jane.sendForApproval(today.id)).boughtBeforeApproval).toBe(false);
    });

    it('flags a purchase that already has a receipt attached as bought before approval, whatever its date (P-017)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await fill(jane, [{ ...ACME, quotes: [], receipts: ['acme-invoice.pdf'], noQuoteReason: 'Already purchased' }]);
      const submission = await jane.sendForApproval(id);
      expect(submission.boughtBeforeApproval).toBe(true);
      expect((await jane.getRequest(id)).request).toMatchObject({ boughtBeforeApproval: true, status: 'Awaiting approval' });
      // A quote alone does not.
      const quoted = await fill(jane, [ACME]);
      expect((await jane.sendForApproval(quoted.id)).boughtBeforeApproval).toBe(false);
    });

    it('keeps the bought-before-approval flag of an earlier round, even after the date is moved to the future (P-017)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id, lines } = await fill(jane, [{ ...ACME, date: '2026-10-10' }]);
      expect((await jane.sendForApproval(id)).boughtBeforeApproval).toBe(true);
      await h.as(MAX, APPROVED_AT).returnRequest(id, 'Please check the date.');
      const later = h.as(JANE, SUBMITTED_AT);
      await later.updateLine(lines[0].id, { date: '2026-12-01' });
      const again = await later.sendForApproval(id);
      expect(again).toMatchObject({ submissionNumber: 2, boughtBeforeApproval: true });
      expect(again.emailSummary).toContain('FLAG, bought before approval: Acme Lab Supply ($1,000.00).');
      expect(again.emailSummary).toContain('(round 2, sent again)');
      expect((await later.getRequest(id)).request).toMatchObject({
        boughtBeforeApproval: true,
        approval: { sent: [{ key: ACME_KEY, vendor: 'Acme Lab Supply', cents: 100000, bought: true }], approved: [], earlier: [] }
      });
    });

    it('sent again after a rise, flags only the vendor total that rose past its approval, and the emails and the CSV agree (P-017, P-019)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const borealis: Row = {
        vendor: 'Borealis Optics',
        amountCents: 80000,
        date: '2026-10-20',
        description: 'Optical bench parts',
        category: 'rdMaterials',
        quotes: ['borealis-quote.pdf']
      };
      const { id, lines } = await fill(jane, [ACME, borealis]);
      await jane.sendForApproval(id);
      await h.as(MAX, APPROVED_AT).approveRequest(id, { note: '', categories: {} });
      // Both are bought after the approval; Acme cost $1,150.00, more than 10% over the $1,000.00 approved.
      const later = h.as(JANE, SUBMITTED_AT);
      await attachReceipts(later, id);
      await later.updateLine(lines[0].id, { amountCents: 115000 });
      await expect(later.submitRequest(id, CERTIFICATION)).rejects.toBeInstanceOf(ApprovalRequiredError);
      const again = await later.sendForApproval(id);
      expect(again.boughtBeforeApproval).toBe(true);
      expect(again.emailSummary).toContain('FLAG, bought before approval: Acme Lab Supply ($1,150.00).');
      expect(again.emailSummary).not.toMatch(/FLAG.*Borealis/);
      expect((await later.getRequest(id)).request.approval.sent.map((g) => [g.vendor, g.cents, g.bought])).toEqual([
        ['Acme Lab Supply', 115000, true],
        ['Borealis Optics', 80000, false]
      ]);

      const at = new Date(2026, 9, 19, 9, 0);
      await h.as(MAX, at).approveRequest(id, { note: '', categories: {} });
      const submission = await h.as(JANE, at).submitRequest(id, CERTIFICATION);
      expect(submission.boughtBeforeApproval).toBe(true);
      expect(submission.emailSummary).toContain('FLAG, bought before approval: Acme Lab Supply ($1,150.00).');
      expect(submission.emailSummary).not.toMatch(/FLAG.*Borealis/);
      const rows = (await h.as(JANE, at).getSubmissionCsv(submission.id)).split('\r\n');
      expect(rows[1]).toContain('Acme Lab Supply');
      expect(rows[1]).toContain('Approved,Yes,Max Wamsley');
      expect(rows[2]).toContain('Borealis Optics');
      expect(rows[2]).toContain('Approved,No,Max Wamsley');
    });

    it('remembers an approval through later rounds that are returned, so a vendor bought after its approval is never flagged (P-017)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const max = h.as(MAX, SUBMITTED_AT);
      const { id } = await fill(jane, [{ ...ACME, amountCents: 60000 }]);
      await jane.sendForApproval(id);
      await h.as(MAX, APPROVED_AT).approveRequest(id, { note: '', categories: {} });
      // Jane buys Acme after the approval and attaches the receipt, then adds a second vendor of $550.00.
      const later = h.as(JANE, SUBMITTED_AT);
      await attachReceipts(later, id);
      const added = await later.addEmptyLine(id);
      await later.updateLine(added.id, {
        date: '2026-10-25',
        vendor: 'Beta Instruments',
        description: 'Flow meter',
        category: 'rdMaterials',
        amountCents: 55000,
        paidBy: 'company',
        noQuoteReason: 'Sole supplier'
      });
      const acme = { key: ACME_KEY, vendor: 'Acme Lab Supply', cents: 60000, bought: false };
      const beta = { key: vendorKey('Beta Instruments'), vendor: 'Beta Instruments', cents: 55000, bought: false };

      // Round 2 does not flag Acme, which its approval covers. The approval is kept as an earlier one.
      expect((await later.sendForApproval(id)).boughtBeforeApproval).toBe(false);
      expect((await later.getRequest(id)).request.approval).toEqual({ sent: [acme, beta], approved: [], earlier: [acme] });
      // The approver returns round 2: nothing is approved now, and the earlier approval is still kept.
      expect((await max.returnRequest(id, 'Please attach a quote for Beta Instruments.')).approval).toEqual({
        sent: [acme, beta],
        approved: [],
        earlier: [acme]
      });
      await expect(later.submitRequest(id, CERTIFICATION)).rejects.toBeInstanceOf(ApprovalRequiredError);

      // Round 3: Acme is still not flagged, although its receipt is attached and nothing is approved now.
      const round3 = await later.sendForApproval(id);
      expect(round3.boughtBeforeApproval).toBe(false);
      expect(round3.emailSummary).not.toContain('FLAG');
      expect((await later.getRequest(id)).request).toMatchObject({
        boughtBeforeApproval: false,
        approval: { sent: [acme, beta], approved: [], earlier: [acme] }
      });

      // Returned again; this time Jane buys Beta before it is approved. Round 4 flags Beta, and only Beta.
      await max.returnRequest(id, 'Please confirm the price.');
      await attachReceipts(later, id);
      const round4 = await later.sendForApproval(id);
      expect(round4.boughtBeforeApproval).toBe(true);
      expect(round4.emailSummary).toContain('FLAG, bought before approval: Beta Instruments ($550.00).');

      // Approving keeps the earlier approval as it was, and a return at processing changes nothing in the record.
      const approved = await max.approveRequest(id, { note: '', categories: {} });
      const record = { sent: [acme, { ...beta, bought: true }], approved: [acme, { ...beta, bought: true }], earlier: [acme] };
      expect(approved.approval).toEqual(record);
      const submitted = await later.submitRequest(id, CERTIFICATION);
      expect(submitted.emailSummary).toContain('FLAG, bought before approval: Beta Instruments ($550.00).');
      expect(submitted.emailSummary).not.toMatch(/FLAG.*Acme/);
      expect((await max.returnRequest(id, 'Please attach the itemized invoice.')).approval).toEqual(record);
    });

    it('removes an earlier approval attempt that stopped part-way, but nothing else', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const made = await fill(jane, [ACME, NORTHWIND]);
      const request = { id: made.id, requestNumber: 'PR-0001' };
      const stale = h.addUploadingSubmission(JANE, request, 'approval', 1);
      const otherType = h.addUploadingSubmission(JANE, request, 'package', 1);
      const otherRound = h.addUploadingSubmission(JANE, request, 'approval', 2);
      const fresh = await jane.sendForApproval(made.id);
      const all = await jane.listSubmissionsForRequest(made.id);
      expect(all.map((s) => s.id)).not.toContain(stale);
      expect(all.map((s) => s.id).sort()).toEqual([fresh.id, otherType, otherRound].sort());
      expect(fresh.id).not.toBe(stale);
    });
  });

  describe(`${label}: the approver`, () => {
    it('lets only an administrator approve, and only a request that is awaiting approval', async () => {
      const h = await makeHarness();
      const max = h.as(MAX, APPROVED_AT);
      const draft = await requestInState(h, 'Draft');
      expect((await refusal(max.approveRequest(draft, { note: '', categories: {} }))).message).toBe(notAllowed.approveWhen);
      const { id } = await sent(h);
      await max.approveRequest(id, { note: '', categories: {} });
      expect((await refusal(max.approveRequest(id, { note: '', categories: {} }))).message).toBe(notAllowed.approveWhen);
      await refusal(max.approveRequest(999, { note: '', categories: {} }));
    });

    it("approves: every row's category is confirmed, changes are applied, and the approved totals, approver and time are recorded (P-006, P-024)", async () => {
      const h = await makeHarness();
      const { id, lines } = await sent(h);
      const max = h.as(MAX, APPROVED_AT);
      const approved = await max.approveRequest(id, {
        note: 'OK, use the company card.',
        categories: { [lines[1].id]: { category: 'other', categoryOther: ' Lab furniture ' } }
      });
      expect(approved).toMatchObject({
        status: 'Approved',
        approvedBy: 'Max Wamsley',
        approvedByEmail: 'max.wamsley@example.com',
        approvedOn: '2026-10-17 10:05',
        approvalNote: 'OK, use the company card.',
        returnNote: '',
        returnStage: '',
        approvalRounds: 1,
        sentForApprovalOn: '2026-10-16 09:30'
      });
      expect(approved.approval).toEqual({
        sent: [{ key: ACME_KEY, vendor: 'Acme Lab Supply', cents: 100000, bought: false }],
        approved: [{ key: ACME_KEY, vendor: 'Acme Lab Supply', cents: 100000, bought: false }],
        earlier: []
      });
      const after = (await h.as(JANE, NOW).getRequest(id)).lines;
      expect(after[0]).toMatchObject({ category: 'rdMaterials', categoryOther: '', categoryConfirmedBy: 'Max Wamsley' });
      expect(after[1]).toMatchObject({ category: 'other', categoryOther: 'Lab furniture', categoryConfirmedBy: 'Max Wamsley' });
      // What the employee typed is otherwise untouched.
      expect(after.map((l) => [l.vendor, l.amountCents])).toEqual([
        ['Acme Lab Supply', 100000],
        ['Northwind Office Supply', 8645]
      ]);
      // The employee can edit and submit it now.
      const jane = h.as(JANE, NOW);
      expect((await jane.updateRequest(id, { projectCode: 'NSF SBIR Phase 1 (Award # 2528301)' })).projectCode).toContain('NSF');
    });

    it('refuses to approve a request changed after it was sent, for example directly in SharePoint, and writes nothing (P-019)', async () => {
      const h = await makeHarness();
      const { id, lines } = await sent(h);
      // Jane raises the amount in SharePoint itself, past the app's lock (travel D-002).
      h.editLineDirectly(lines[0].id, { amountCents: 150000 });
      const max = h.as(MAX, APPROVED_AT);
      const changedCategory = { [lines[1].id]: { category: 'other' as CategoryId, categoryOther: 'Lab furniture' } };
      expect((await refusal(max.approveRequest(id, { note: 'OK', categories: changedCategory }))).message).toBe(notAllowed.changedSinceSent);
      const after = await max.getRequest(id);
      expect(after.request).toMatchObject({ status: 'Awaiting approval', approvedBy: '', approvedByEmail: '', approvedOn: '', approvalNote: '' });
      expect(after.request.approval).toEqual({ sent: [{ key: ACME_KEY, vendor: 'Acme Lab Supply', cents: 100000, bought: false }], approved: [], earlier: [] });
      expect(after.lines.map((l) => [l.category, l.categoryOther, l.categoryConfirmedBy])).toEqual([
        ['rdMaterials', '', ''],
        ['office', '', '']
      ]);
      // The approver returns it; sent again as it now stands, it can be approved.
      await max.returnRequest(id, 'The amount changed after you sent it. Please send it again.');
      await h.as(JANE, SUBMITTED_AT).sendForApproval(id);
      const approved = await h.as(MAX, SUBMITTED_AT).approveRequest(id, { note: '', categories: {} });
      expect(approved.approval.approved).toEqual([{ key: ACME_KEY, vendor: 'Acme Lab Supply', cents: 150000, bought: false }]);
    });

    it('approves a request whose vendor was only spelt another way since it was sent, and refuses one where a vendor total came or went', async () => {
      const h = await makeHarness();
      const cases: [string, number, DirectLineEdit, boolean][] = [
        ['the same vendor, spelt another way', 0, { vendor: 'ACME LAB SUPPLY.' }, true],
        ['another vendor name', 0, { vendor: 'Acme Labs' }, false],
        ['a total that fell under the threshold', 0, { amountCents: 40000 }, false],
        ['a new total of $500 or more', 1, { amountCents: 60000 }, false],
        ['a lower amount', 0, { amountCents: 90000 }, false]
      ];
      for (const [name, row, edit, allowed] of cases) {
        const { id, lines } = await sent(h);
        h.editLineDirectly(lines[row].id, edit);
        const max = h.as(MAX, APPROVED_AT);
        const outcome = await max.approveRequest(id, { note: '', categories: {} }).then(
          (r) => r.status as string,
          (e: unknown) => (e instanceof NotAllowedError ? e.message : 'unexpected error')
        );
        expect([name, outcome]).toEqual([name, allowed ? 'Approved' : notAllowed.changedSinceSent]);
      }
    });

    it('records the approved total of a vendor that has several rows, and carries the bought flag over', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await fill(jane, [{ ...ACME, amountCents: 40000, date: '2026-10-10' }, { ...ACME, amountCents: 35000, quotes: [] }, NORTHWIND]);
      await jane.sendForApproval(id);
      const approved = await h.as(MAX, APPROVED_AT).approveRequest(id, { note: '', categories: {} });
      expect(approved.approval.approved).toEqual([{ key: ACME_KEY, vendor: 'Acme Lab Supply', cents: 75000, bought: true }]);
      expect(approved.boughtBeforeApproval).toBe(true);
    });

    it("records a self-approval by the requester's email (P-020)", async () => {
      const h = await makeHarness();
      const max = h.as(MAX, NOW);
      const made = await fill(max, [ACME, NORTHWIND]);
      await max.sendForApproval(made.id);
      const approved = await h.as(MAX, APPROVED_AT).approveRequest(made.id, { note: '', categories: {} });
      expect(approved.ownerEmail).toBe(MAX.email);
      expect(approved.approvedByEmail).toBe(MAX.email);
      expect(isSelfApproved(approved.ownerEmail, approved.approvedByEmail)).toBe(true);
      // Someone else's request is not self-approved.
      const { id } = await sent(h);
      const other = await h.as(MAX, APPROVED_AT).approveRequest(id, { note: '', categories: {} });
      expect(isSelfApproved(other.ownerEmail, other.approvedByEmail)).toBe(false);
    });

    it('refuses a category that is not a choice, or Other with no description, and changes nothing', async () => {
      const h = await makeHarness();
      const { id, lines } = await sent(h);
      const max = h.as(MAX, APPROVED_AT);
      const invalid: Record<string, { category: CategoryId; categoryOther: string }>[] = [
        { [lines[0].id]: { category: 'snacks' as CategoryId, categoryOther: '' } },
        { [lines[1].id]: { category: 'other', categoryOther: '  ' } },
        { [lines[0].id]: { category: 'office', categoryOther: '' }, [lines[1].id]: { category: 'other', categoryOther: '' } },
        { 'no-such-row': { category: 'office', categoryOther: '' } }
      ];
      const messagesSeen: string[] = [];
      for (const categories of invalid) {
        const error = await max.approveRequest(id, { note: '', categories }).then(
          () => undefined,
          (e: unknown) => e
        );
        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(NotAllowedError);
        messagesSeen.push((error as Error).message);
        await expect(max.confirmCategories(id, categories)).rejects.not.toBeInstanceOf(NotAllowedError);
      }
      expect(messagesSeen[0]).toBe(`Row 1: ${messages.categoryRequired}`);
      expect(messagesSeen[1]).toBe(`Row 2: ${messages.categoryOtherRequired}`);
      expect(messagesSeen[2]).toBe(`Row 2: ${messages.categoryOtherRequired}`);
      expect(messagesSeen[3]).toBe(messages.spNotFound);
      const after = await h.as(JANE, NOW).getRequest(id);
      expect(after.request.status).toBe('Awaiting approval');
      expect(after.lines.map((l) => [l.category, l.categoryOther, l.categoryConfirmedBy])).toEqual([
        ['rdMaterials', '', ''],
        ['office', '', '']
      ]);
    });

    it('returns a request awaiting approval to the employee, who then has to send it again (P-006)', async () => {
      const h = await makeHarness();
      const { id } = await sent(h);
      const max = h.as(MAX, APPROVED_AT);
      const returned = await max.returnRequest(id, 'Please add a quote for the second vendor.');
      expect(returned).toMatchObject({
        status: 'Returned',
        returnNote: 'Please add a quote for the second vendor.',
        returnStage: 'approval',
        approvedOn: '',
        approvedBy: '',
        approvedByEmail: '',
        approvalNote: ''
      });
      // What was sent stays on record; nothing is approved.
      expect(returned.approval.approved).toEqual([]);
      expect(returned.approval.sent).toHaveLength(1);

      const jane = h.as(JANE, SUBMITTED_AT);
      await jane.updateRequest(id, { projectCode: 'NSF SBIR Phase 1 (Award # 2528301)' });
      await expect(jane.submitRequest(id, CERTIFICATION)).rejects.toBeInstanceOf(ApprovalRequiredError);
      const again = await jane.sendForApproval(id);
      expect(again).toMatchObject({ type: 'approval', submissionNumber: 2 });
      expect(again.emailSubject).toBe('Purchase approval needed again: Jane Doe, Lab supplies for the Phase 1 assay (PR-0001, round 2)');
      const { request } = await jane.getRequest(id);
      expect(request).toMatchObject({ status: 'Awaiting approval', approvalRounds: 2, returnNote: '', returnStage: '', sentForApprovalOn: '2026-10-18 11:15' });
      expect((await jane.listSubmissionsForRequest(id)).map((s) => s.submissionNumber)).toEqual([2, 1]);
    });

    it('takes a return at the approval step back to the approver: approved again after it is sent again', async () => {
      const h = await makeHarness();
      const { id } = await sent(h);
      const max = h.as(MAX, APPROVED_AT);
      await max.returnRequest(id, 'Please add a quote for the second vendor.');
      const jane = h.as(JANE, SUBMITTED_AT);
      await jane.sendForApproval(id);
      const approved = await h.as(MAX, SUBMITTED_AT).approveRequest(id, { note: '', categories: {} });
      expect(approved).toMatchObject({ status: 'Approved', returnNote: '', returnStage: '', approvalRounds: 2 });
      expect(approved.approval.approved).toHaveLength(1);
    });

    it('takes away an approval left on a request that is awaiting approval, for example by an edit in SharePoint, when it is returned', async () => {
      const h = await makeHarness();
      const { id } = await sent(h);
      h.leaveApproval(id, MAX, [{ key: ACME_KEY, vendor: 'Acme Lab Supply', cents: 100000, bought: false }]);
      const before = (await h.as(MAX).getRequest(id)).request;
      expect(before).toMatchObject({ status: 'Awaiting approval', approvedBy: 'Max Wamsley', approvedByEmail: MAX.email, approvalNote: 'Left by an edit' });
      expect(before.approvedOn).not.toBe('');
      expect(before.approval.approved).toHaveLength(1);
      const returned = await h.as(MAX, APPROVED_AT).returnRequest(id, 'Please add a quote.');
      expect(returned).toMatchObject({ status: 'Returned', returnStage: 'approval', approvedOn: '', approvedBy: '', approvedByEmail: '', approvalNote: '' });
      expect(returned.approval.approved).toEqual([]);
      expect(returned.approval.sent).toHaveLength(1);
    });

    it('can return only a request that is awaiting approval or submitted', async () => {
      const h = await makeHarness();
      const max = h.as(MAX, APPROVED_AT);
      for (const status of ['Draft', 'Approved', 'Returned', 'Processed'] as const) {
        const id = await requestInState(h, status);
        expect([status, (await refusal(max.returnRequest(id, 'No'))).message]).toEqual([status, notAllowed.returnWhen]);
        expect((await max.getRequest(id)).request.status).toBe(status);
      }
    });
  });

  describe(`${label}: approval covers what the approver saw (P-019)`, () => {
    it('lets a vendor total rise by up to 10% after approval, and asks for approval again beyond that', async () => {
      const h = await makeHarness();
      const { id, lines } = await approvedAndReady(h);
      const jane = h.as(JANE, SUBMITTED_AT);
      await jane.updateLine(lines[0].id, { amountCents: 110001 });
      await expect(jane.submitRequest(id, CERTIFICATION)).rejects.toBeInstanceOf(ApprovalRequiredError);
      expect(await jane.listSubmissionsForRequest(id)).toHaveLength(1);
      await jane.updateLine(lines[0].id, { amountCents: 110000 });
      const submission = await jane.submitRequest(id, CERTIFICATION);
      expect(submission).toMatchObject({ type: 'package', submissionNumber: 1, totalCompanyCents: 110000 });
    });

    it('lets an amount fall, and asks for approval again for a new vendor total of $500 or more', async () => {
      const h = await makeHarness();
      const { id, lines } = await approvedAndReady(h);
      const jane = h.as(JANE, SUBMITTED_AT);
      const added = await jane.addEmptyLine(id);
      await jane.updateLine(added.id, {
        date: '2026-10-20',
        vendor: 'Harbor Software',
        description: 'Annual license',
        category: 'computer',
        amountCents: 50000,
        paidBy: 'company',
        noQuoteReason: 'Sole supplier'
      });
      await jane.addFileToLine(added.id, pdf('harbor-invoice.pdf'), 'receipt');
      await expect(jane.submitRequest(id, CERTIFICATION)).rejects.toBeInstanceOf(ApprovalRequiredError);
      // At $499.99 it is under the threshold, so it needs no approval; a lower amount for the approved vendor never does.
      await jane.updateLine(added.id, { amountCents: 49999 });
      await jane.updateLine(lines[0].id, { amountCents: 50000 });
      expect((await jane.submitRequest(id, CERTIFICATION)).type).toBe('package');
    });

    it('lets the employee send it for approval again when a vendor total rose past the allowance', async () => {
      const h = await makeHarness();
      const { id, lines } = await approvedAndReady(h);
      const jane = h.as(JANE, SUBMITTED_AT);
      await jane.updateLine(lines[0].id, { amountCents: 120000 });
      const again = await jane.sendForApproval(id);
      expect(again).toMatchObject({ type: 'approval', submissionNumber: 2 });
      const { request } = await jane.getRequest(id);
      expect(request).toMatchObject({ status: 'Awaiting approval', approvalRounds: 2, approvedBy: '', approvedOn: '', approvalNote: '' });
      expect(request.approval.sent[0].cents).toBe(120000);
      expect(request.approval.approved).toEqual([]);
      const approved = await h.as(MAX, SUBMITTED_AT).approveRequest(id, { note: '', categories: {} });
      expect(approved.approval.approved[0].cents).toBe(120000);
    });

    it('does not let a vendor spelt another way get round the allowance: "Thorlabs" adds to the "Thor Labs" total (P-016, P-019)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await fill(jane, [{ ...ACME, vendor: 'Thor Labs', quotes: ['thor-labs-quote.pdf'] }]);
      await jane.sendForApproval(id);
      await h.as(MAX, APPROVED_AT).approveRequest(id, { note: '', categories: {} });
      const later = h.as(JANE, SUBMITTED_AT);
      await attachReceipts(later, id);
      const added = await later.addEmptyLine(id);
      await later.updateLine(added.id, {
        date: '2026-10-20',
        vendor: 'Thorlabs',
        description: 'Lens mounts',
        category: 'rdMaterials',
        amountCents: 49900,
        paidBy: 'company'
      });
      await later.addFileToLine(added.id, pdf('thorlabs-invoice.pdf'), 'receipt');
      await expect(later.submitRequest(id, CERTIFICATION)).rejects.toBeInstanceOf(ApprovalRequiredError);
      const again = await later.sendForApproval(id);
      expect(again.emailSummary).toContain('- Thor Labs: $1,499.00 (quote attached)');
    });

    it('does not ask for approval again when nothing changed', async () => {
      const h = await makeHarness();
      const { id } = await approvedAndReady(h);
      await expect(h.as(JANE, SUBMITTED_AT).sendForApproval(id)).rejects.toBeInstanceOf(Error);
      expect((await h.as(JANE, SUBMITTED_AT).getRequest(id)).request.status).toBe('Approved');
    });
  });

  describe(`${label}: submitting`, () => {
    it('will not submit without the certification, or with a different sentence (P-010)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await fill(jane, [POSTAGE]);
      await expect(jane.submitRequest(id, '')).rejects.toThrow(messages.certificationRequired);
      await expect(jane.submitRequest(id, 'I agree.')).rejects.toThrow(messages.certificationRequired);
      expect(await jane.listSubmissionsForRequest(id)).toEqual([]);
      expect((await jane.getRequest(id)).request.status).toBe('Draft');
    });

    it('will not submit while approval is still to come (P-006)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await fill(jane, [ACME, NORTHWIND]);
      await expect(jane.submitRequest(id, CERTIFICATION)).rejects.toBeInstanceOf(ApprovalRequiredError);
      expect((await jane.getRequest(id)).request.status).toBe('Draft');
    });

    it('never counts a quote as the receipt: submitting waits for a receipt or a reason (P-021)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id, lines } = await fill(jane, [{ ...NORTHWIND, quotes: ['northwind-quote.pdf'] }]);
      const error = await jane.submitRequest(id, CERTIFICATION).then(
        () => undefined,
        (e: unknown) => e
      );
      expect(error).toBeInstanceOf(SubmissionBlockedError);
      expect((error as SubmissionBlockedError).issues.map((i) => i.field)).toEqual(['receipt']);
      await jane.addFileToLine(lines[0].id, pdf('northwind-receipt.pdf'), 'receipt');
      expect((await jane.submitRequest(id, CERTIFICATION)).receiptCount).toBe(1);
      // A reason is enough when there is no receipt at all.
      const other = await fill(jane, [{ ...NORTHWIND, noReceiptReason: 'Receipt lost' }]);
      expect((await jane.submitRequest(other.id, CERTIFICATION)).rowsWithoutReceipt).toBe(1);
    });

    it('makes the package with the receipts and the quotes under their package names, and the CSV (P-021, P-026)', async () => {
      const h = await makeHarness();
      const { id } = await approvedAndReady(h);
      const jane = h.as(JANE, SUBMITTED_AT);
      const submission = await jane.submitRequest(id, CERTIFICATION);
      expect(submission).toMatchObject({
        requestId: id,
        requestNumber: 'PR-0001',
        type: 'package',
        submissionNumber: 1,
        packageStatus: 'Ready',
        folderName: '2026-10-20_Jane-Doe_Lab-supplies-for-the-Phase-1-assay_PR-0001',
        previousFolderName: '',
        submitterName: 'Jane Doe',
        submitterEmail: 'jane.doe@example.com',
        certificationText: CERTIFICATION,
        receiptCount: 2,
        quoteCount: 1,
        rowsWithoutReceipt: 0,
        boughtBeforeApproval: false,
        approvedBy: 'Max Wamsley',
        approvedOn: '2026-10-17 10:05',
        emailSubject: 'Purchase request submitted: Jane Doe, Lab supplies for the Phase 1 assay (PR-0001)'
      });
      expect([...submission.packageFileNames].sort()).toEqual(['PR-0001_Purchases.csv', 'Q01_acme-quote.pdf', 'R01_receipt-row1.pdf', 'R02_receipt-row2.pdf']);
      expect(submission.emailSummary).toContain('Approval: approved by Max Wamsley on 2026-10-17 10:05. Note: OK, use the company card.');
      expect(submission.emailSummary).toContain(CERTIFICATION);
      expect(submission.emailSummary).toContain('Receipt files: 2. Quote files: 1.');

      const csv = await jane.getSubmissionCsv(submission.id);
      expect(csv).toContain('Request,Row,Date,Vendor');
      expect(csv).toContain('Jane Doe (jane.doe@example.com)');
      expect(csv).toContain('Max Wamsley');
      expect(csv).toContain('Q01_acme-quote.pdf');
      expect(csv).toContain('R01_receipt-row1.pdf');
      expect(csv.startsWith('\uFEFF')).toBe(false);
      expect(await h.as(MAX, SUBMITTED_AT).getSubmissionCsv(submission.id)).toBe(csv);
      await refusal(h.as(SAM, NOW).getSubmissionCsv(submission.id));

      const { request } = await jane.getRequest(id);
      expect(request).toMatchObject({ status: 'Submitted', submissionCount: 1, submittedOn: '2026-10-18 11:15', returnNote: '', returnStage: '' });
      expect((await refusal(jane.updateRequest(id, { department: 'Operations' }))).message).toBe(notAllowed.locked);
      expect((await refusal(jane.submitRequest(id, CERTIFICATION))).message).toBe(notAllowed.locked);
    });

    it('submits a request that needs no approval, with no approval named in the package', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, SUBMITTED_AT);
      const { id } = await fill(jane, [POSTAGE, NORTHWIND]);
      await jane.addFileToLine((await jane.getRequest(id)).lines[1].id, png('northwind.png'), 'receipt');
      const submission = await jane.submitRequest(id, CERTIFICATION);
      expect(submission).toMatchObject({
        approvedBy: '',
        approvedOn: '',
        boughtBeforeApproval: false,
        receiptCount: 2,
        quoteCount: 0,
        totalReimburseCents: 8645,
        totalCompanyCents: 12500
      });
      expect(submission.emailSummary).toContain('Approval: not needed');
      expect([...submission.packageFileNames].sort()).toEqual(['PR-0001_Purchases.csv', 'R01_postage.pdf', 'R02_northwind.png']);
    });

    it('copies a receipt shared by several rows once, under the row that holds it', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, SUBMITTED_AT);
      const { id, lines } = await fill(jane, [POSTAGE, { ...NORTHWIND, date: '2026-10-20' }]);
      await jane.updateLine(lines[1].id, { sameReceiptAsRow: 1 });
      const submission = await jane.submitRequest(id, CERTIFICATION);
      expect([...submission.packageFileNames].sort()).toEqual(['PR-0001_Purchases.csv', 'R01_postage.pdf']);
      expect(submission.receiptCount).toBe(1);
      expect(submission.rowsWithoutReceipt).toBe(0);
    });

    it('carries the bought-before-approval flag into the package (P-017)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await fill(jane, [{ ...ACME, date: '2026-10-10' }, NORTHWIND]);
      await jane.sendForApproval(id);
      await h.as(MAX, APPROVED_AT).approveRequest(id, { note: '', categories: {} });
      await attachReceipts(h.as(JANE, SUBMITTED_AT), id);
      const submission = await h.as(JANE, SUBMITTED_AT).submitRequest(id, CERTIFICATION);
      expect(submission.boughtBeforeApproval).toBe(true);
      expect(submission.emailSummary).toContain('FLAG, bought before approval: Acme Lab Supply ($1,000.00).');
    });

    it('removes an earlier package attempt that stopped part-way, but not an earlier folder or another type', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, SUBMITTED_AT);
      const { id } = await fill(jane, [POSTAGE]);
      const request = { id, requestNumber: 'PR-0001' };
      const stale = h.addUploadingSubmission(JANE, request, 'package', 1);
      const approval = h.addUploadingSubmission(JANE, request, 'approval', 1);
      const fresh = await jane.submitRequest(id, CERTIFICATION);
      const all = await jane.listSubmissionsForRequest(id);
      expect(all.map((s) => s.id)).not.toContain(stale);
      expect(all.map((s) => s.id).sort()).toEqual([approval, fresh.id].sort());
    });

    it('resubmits a returned request as R2, naming the folder it replaces (travel D-042)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, SUBMITTED_AT);
      const { id } = await fill(jane, [POSTAGE]);
      const first = await jane.submitRequest(id, CERTIFICATION);
      const max = h.as(MAX, APPROVED_AT);
      const returned = await max.returnRequest(id, 'Please attach the itemized invoice.');
      expect(returned).toMatchObject({ status: 'Returned', returnNote: 'Please attach the itemized invoice.', returnStage: 'processing', submissionCount: 1 });

      const later = h.as(JANE, new Date(2026, 9, 19, 8, 0));
      await later.updateRequest(id, { businessPurpose: 'Postage for sample shipments' });
      const second = await later.submitRequest(id, CERTIFICATION);
      expect(second).toMatchObject({ type: 'package', submissionNumber: 2, previousFolderName: first.folderName });
      expect(second.folderName.endsWith('_PR-0001_R2')).toBe(true);
      expect([...second.packageFileNames].sort()).toEqual(['PR-0001_R2_Purchases.csv', 'R01_postage.pdf']);
      expect(second.emailSubject).toContain('resubmitted');
      expect((await later.getRequest(id)).request).toMatchObject({ status: 'Submitted', submissionCount: 2, returnNote: '', returnStage: '' });
      expect((await later.listSubmissionsForRequest(id)).map((s) => s.submissionNumber)).toEqual([2, 1]);
      expect((await max.listSubmissions()).map((s) => s.requestNumber)).toEqual(['PR-0001', 'PR-0001']);
    });

    it('names the folder an R3 replaces as the R2 folder, not the first one', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, SUBMITTED_AT);
      const max = h.as(MAX, APPROVED_AT);
      const { id } = await fill(jane, [POSTAGE]);
      const first = await jane.submitRequest(id, CERTIFICATION);
      await max.returnRequest(id, 'Once more.');
      const second = await jane.submitRequest(id, CERTIFICATION);
      await max.returnRequest(id, 'And again.');
      const third = await jane.submitRequest(id, CERTIFICATION);
      expect([first.previousFolderName, second.previousFolderName, third.previousFolderName]).toEqual(['', first.folderName, second.folderName]);
      expect(third.folderName.endsWith('_PR-0001_R3')).toBe(true);
      expect(third.packageFileNames).toContain('PR-0001_R3_Purchases.csv');
      expect(third.emailSubject).toContain('R3');
      expect((await jane.listSubmissionsForRequest(id)).map((s) => s.submissionNumber)).toEqual([3, 2, 1]);
    });

    it('keeps the approval when a request is returned at processing, so it can be resubmitted without asking again (P-027)', async () => {
      const h = await makeHarness();
      const { id } = await approvedAndReady(h);
      const jane = h.as(JANE, SUBMITTED_AT);
      await jane.submitRequest(id, CERTIFICATION);
      const returned = await h.as(MAX, APPROVED_AT).returnRequest(id, 'Row 1: please attach the itemized invoice.');
      expect(returned).toMatchObject({ status: 'Returned', returnStage: 'processing', approvedBy: 'Max Wamsley', approvalNote: 'OK, use the company card.' });
      expect(returned.approval.approved).toEqual([{ key: ACME_KEY, vendor: 'Acme Lab Supply', cents: 100000, bought: false }]);
      const second = await jane.submitRequest(id, CERTIFICATION);
      expect(second).toMatchObject({ submissionNumber: 2, approvedBy: 'Max Wamsley' });
      expect((await jane.listSubmissionsForRequest(id)).map((s) => [s.type, s.submissionNumber])).toEqual([
        ['approval', 1],
        ['package', 2],
        ['package', 1]
      ]);
    });
  });

  describe(`${label}: processing, categories and retries`, () => {
    it('lets an administrator mark a submitted request processed, and nothing else', async () => {
      const h = await makeHarness();
      const max = h.as(MAX, new Date(2026, 9, 20, 14, 20));
      for (const status of ['Draft', 'Awaiting approval', 'Approved', 'Returned', 'Processed'] as const) {
        const id = await requestInState(h, status);
        expect([status, (await refusal(max.markProcessed(id))).message]).toEqual([status, notAllowed.processWhen]);
      }
      const id = await requestInState(h, 'Submitted');
      const processed = await max.markProcessed(id);
      expect(processed).toMatchObject({ status: 'Processed', processedBy: 'Max Wamsley', processedOn: '2026-10-20 14:20' });
      expect((await h.as(JANE, NOW).getRequest(id)).request).toMatchObject({ status: 'Processed', processedBy: 'Max Wamsley' });
      expect((await refusal(h.as(JANE, NOW).updateRequest(id, { department: 'Operations' }))).message).toBe(notAllowed.locked);
    });

    it('lets an administrator confirm or change categories while a request is awaiting approval, approved or submitted (P-024)', async () => {
      const h = await makeHarness();
      const max = h.as(MAX, new Date(2026, 9, 20, 14, 20));
      for (const status of ['Awaiting approval', 'Approved', 'Submitted'] as const) {
        const id = await requestInState(h, status);
        const before = (await max.getRequest(id)).lines;
        const lines = await max.confirmCategories(id, { [before[0].id]: { category: 'other', categoryOther: 'Lab safety audit' } });
        expect(lines.map((l) => [l.id, l.rowNumber])).toEqual(before.map((l) => [l.id, l.rowNumber]));
        expect(lines[0]).toMatchObject({ category: 'other', categoryOther: 'Lab safety audit', categoryConfirmedBy: 'Max Wamsley' });
        expect(lines.every((l) => l.categoryConfirmedBy === 'Max Wamsley')).toBe(true);
        const stored = (await max.getRequest(id)).lines;
        expect(stored.map((l) => [l.category, l.categoryOther, l.categoryConfirmedBy])).toEqual(
          lines.map((l) => [l.category, l.categoryOther, l.categoryConfirmedBy])
        );
        // It confirms categories only: the status does not change.
        expect((await max.getRequest(id)).request.status).toBe(status);
      }
    });

    it('refuses to confirm categories of a Draft, a Returned or a Processed request', async () => {
      const h = await makeHarness();
      const max = h.as(MAX, APPROVED_AT);
      for (const status of ['Draft', 'Returned', 'Processed'] as const) {
        const id = await requestInState(h, status);
        expect([status, (await refusal(max.confirmCategories(id, {}))).message]).toEqual([status, notAllowed.confirmWhen]);
        expect((await max.getRequest(id)).lines.every((l) => l.categoryConfirmedBy === '')).toBe(true);
      }
    });

    it('confirms every row as shown when no change is given, and is a no-op for rows already confirmed by the same person', async () => {
      const h = await makeHarness();
      const { id } = await sent(h);
      const max = h.as(MAX, APPROVED_AT);
      const first = await max.confirmCategories(id, {});
      expect(first.map((l) => [l.category, l.categoryConfirmedBy])).toEqual([
        ['rdMaterials', 'Max Wamsley'],
        ['office', 'Max Wamsley']
      ]);
      expect(await max.confirmCategories(id, {})).toEqual(first);
    });

    it('sets a failed or stuck submission of either type back to Ready, and clears its error (P-030)', async () => {
      const h = await makeHarness();
      const max = h.as(MAX, APPROVED_AT);
      const approval = (await sent(h)).submission;
      const packageId = await requestInState(h, 'Submitted');
      const pkg = (await max.listSubmissions()).find((s) => s.requestId === packageId)!;
      for (const target of [approval, pkg]) {
        h.setSubmissionState(target.id, 'Failed', 'The SharePoint connection in the flow needs to be signed in again.');
        const retried = await max.retryPackaging(target.id);
        expect(retried).toMatchObject({ id: target.id, type: target.type, packageStatus: 'Ready', errorMessage: '', requestNumber: target.requestNumber });
        expect((await max.listSubmissions()).find((s) => s.id === target.id)).toMatchObject({ packageStatus: 'Ready', errorMessage: '' });
      }
      await refusal(max.retryPackaging(999));
    });

    it('retries only a failed or stuck submission, the newest of its kind, while its request is still at that step (P-030)', async () => {
      const h = await makeHarness();
      const max = (at: Date = APPROVED_AT) => h.as(MAX, at);
      const statusOf = async (id: number) => (await max().listSubmissions()).find((s) => s.id === id)!.packageStatus;

      // An approval email that went out, for a request since approved, is left as it is.
      const approvedOne = await sent(h);
      await max().approveRequest(approvedOne.id, { note: '', categories: {} });
      await settle();
      h.setSubmissionState(approvedOne.submission.id, 'Packaged');
      expect((await refusal(max().retryPackaging(approvedOne.submission.id))).message).toBe(notAllowed.retryMovedOn);
      expect(await statusOf(approvedOne.submission.id)).toBe('Packaged');

      // A failed package of a request since returned is not sent again.
      const returnedId = await requestInState(h, 'Returned');
      const failedPackage = (await max().listSubmissions()).find((s) => s.requestId === returnedId)!;
      await settle();
      h.setSubmissionState(failedPackage.id, 'Failed', 'The flow failed.');
      expect((await refusal(max().retryPackaging(failedPackage.id))).message).toBe(notAllowed.retryMovedOn);
      expect(await statusOf(failedPackage.id)).toBe('Failed');

      // Of two approval rounds, only the newest can be tried again.
      const twice = await sent(h);
      await max().returnRequest(twice.id, 'Please add a quote.');
      const second = await h.as(JANE, SUBMITTED_AT).sendForApproval(twice.id);
      await settle();
      h.setSubmissionState(twice.submission.id, 'Failed', 'The flow failed.');
      h.setSubmissionState(second.id, 'Failed', 'The flow failed.');
      expect((await refusal(max().retryPackaging(twice.submission.id))).message).toBe(notAllowed.retryMovedOn);
      expect(await max().retryPackaging(second.id)).toMatchObject({ id: second.id, packageStatus: 'Ready', errorMessage: '' });

      // One still waiting for the flow is tried again only once it is more than 30 minutes old; one that went out, never.
      const waiting = await sent(h);
      await settle();
      const madeAt = new Date(2026, 9, 16, 9, 30);
      h.setSubmissionState(waiting.submission.id, 'Ready', '', madeAt);
      expect((await refusal(max(new Date(2026, 9, 16, 9, 35)).retryPackaging(waiting.submission.id))).message).toBe(notAllowed.retryNotStuck);
      expect(await max(new Date(2026, 9, 16, 10, 1)).retryPackaging(waiting.submission.id)).toMatchObject({ packageStatus: 'Ready' });
      await settle();
      h.setSubmissionState(waiting.submission.id, 'Packaged', '', madeAt);
      expect((await refusal(max(new Date(2026, 9, 16, 11, 0)).retryPackaging(waiting.submission.id))).message).toBe(notAllowed.retryNotStuck);
    });

    it("lists a request's submissions with approval requests first and each type newest first", async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const first = await sent(h);
      await h.as(MAX, APPROVED_AT).returnRequest(first.id, 'Please add a quote.');
      await jane.sendForApproval(first.id);
      await h.as(MAX, APPROVED_AT).approveRequest(first.id, { note: '', categories: {} });
      await attachReceipts(h.as(JANE, SUBMITTED_AT), first.id);
      await h.as(JANE, SUBMITTED_AT).submitRequest(first.id, CERTIFICATION);
      await h.as(MAX, APPROVED_AT).returnRequest(first.id, 'Please attach the itemized invoice.');
      await h.as(JANE, SUBMITTED_AT).submitRequest(first.id, CERTIFICATION);
      const list = await jane.listSubmissionsForRequest(first.id);
      expect(list.map((s) => [s.type, s.submissionNumber])).toEqual([
        ['approval', 2],
        ['approval', 1],
        ['package', 2],
        ['package', 1]
      ]);
      expect(list.every((s) => s.requestNumber === 'PR-0001')).toBe(true);
    });

    it('lists every submission for an administrator, with the request number of each', async () => {
      const h = await makeHarness();
      await sent(h);
      const submitted = await requestInState(h, 'Submitted');
      const all = await h.as(MAX, NOW).listSubmissions();
      expect(all.map((s) => [s.type, s.requestNumber])).toEqual([
        ['approval', 'PR-0001'],
        ['package', `PR-000${submitted}`]
      ]);
    });

    it("lists the rows of the owner's other requests for the duplicate checks, and every row for an administrator", async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const a = await fill(jane, [POSTAGE]);
      const b = await fill(jane, [NORTHWIND, ACME]);
      await fill(h.as(SAM, NOW), [{ ...NORTHWIND, vendor: "Sam's Vendor" }]);
      const others = await jane.getOwnerOtherLines(a.id);
      expect(others.map((o) => [o.requestNumber, o.line.vendor, o.ownerEmail])).toEqual([
        ['PR-0002', 'Northwind Office Supply', JANE.email],
        ['PR-0002', 'Acme Lab Supply', JANE.email]
      ]);
      expect(others[1].line.files.map((f) => [f.fileName, f.kind])).toEqual([['acme-quote.pdf', 'quote']]);
      expect(others[1].line.files[0].fingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect((await jane.getOwnerOtherLines(b.id)).map((o) => o.requestNumber)).toEqual(['PR-0001']);
      const everything = await h.as(MAX, NOW).listAllLineRefs();
      expect(everything.map((r) => [r.requestNumber, r.line.vendor, r.ownerEmail])).toEqual([
        ['PR-0001', 'QuickShip Postage', JANE.email],
        ['PR-0002', 'Northwind Office Supply', JANE.email],
        ['PR-0002', 'Acme Lab Supply', JANE.email],
        ['PR-0003', "Sam's Vendor", SAM.email]
      ]);
      // An administrator asking for one request's other rows gets the owner's, not their own.
      expect((await h.as(MAX, NOW).getOwnerOtherLines(a.id)).map((o) => o.requestNumber)).toEqual(['PR-0002', 'PR-0002']);
    });
  });

  describe(`${label}: when the approver buys (P-037, P-039, P-040)`, () => {
    /** Jane's request the approver buys, with the item link on every row, sent with her certification. */
    async function askedAndSent(h: Harness, rows: readonly Row[] = [ACME, NORTHWIND]) {
      const jane = h.as(JANE, NOW);
      const made = await fill(jane, rows, { ...HEADER, buyer: 'approver' });
      return { ...made, submission: await jane.sendForApproval(made.id, CERTIFICATION) };
    }

    /** Asked, sent, and approved by Max, so it is Max's to buy. */
    async function approvedForMax(h: Harness, rows: readonly Row[] = [ACME, NORTHWIND]) {
      const made = await askedAndSent(h, rows);
      await h.as(MAX, APPROVED_AT).approveRequest(made.id, { note: 'I will order it.', categories: {} });
      return made;
    }

    /** Max, as the buyer, attaches a receipt to every row that has none. */
    async function attachAll(svc: PurchaseDataService, id: number): Promise<void> {
      for (const line of (await svc.getRequest(id)).lines) {
        if (line.files.every((f) => f.kind !== 'receipt')) await svc.addFileToLine(line.id, pdf(`invoice-row${line.rowNumber}.pdf`), 'receipt');
      }
    }

    it('starts with the approver as the buyer, and rows the company pays for, dated today', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const created = await jane.createRequest();
      expect(created.buyer).toBe('approver');
      const row = await jane.addEmptyLine(created.id);
      expect(row).toMatchObject({ paidBy: 'company', date: '2026-10-16' });
      // Nobody is asked who paid, and what is sent is ignored: the company pays for what the approver buys.
      const saved = await jane.updateLine(row.id, { paidBy: 'employee', amountCents: 2500 });
      expect(saved.paidBy).toBe('company');
      expect((await jane.getRequest(created.id)).request).toMatchObject({ totalReimburseCents: 0, totalCompanyCents: 2500, totalRequestCents: 2500 });
    });

    it('lets the employee choose to buy it themselves and who paid; while the approver buys, the company pays and the choice comes back with the buyer', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await jane.createRequest();
      const row = await jane.addEmptyLine(id);
      await jane.updateLine(row.id, { amountCents: 2500 });
      expect((await jane.updateRequest(id, { buyer: 'self' })).buyer).toBe('self');
      expect((await jane.addEmptyLine(id)).date).toBe('');
      await jane.updateLine(row.id, { paidBy: 'employee' });
      expect((await jane.getRequest(id)).request).toMatchObject({ totalReimburseCents: 2500, totalCompanyCents: 0 });
      expect((await jane.updateRequest(id, { buyer: 'approver' })).buyer).toBe('approver');
      // The company pays for what the approver buys, so the totals say so; the row keeps what the employee chose.
      expect((await jane.getRequest(id)).request).toMatchObject({ totalReimburseCents: 0, totalCompanyCents: 2500 });
      expect((await jane.getRequest(id)).lines[0].paidBy).toBe('employee');
      // Back to buying it themselves: the reimbursement is back, nothing was lost.
      expect((await jane.updateRequest(id, { buyer: 'self' })).buyer).toBe('self');
      expect((await jane.getRequest(id)).request).toMatchObject({ totalReimburseCents: 2500, totalCompanyCents: 0 });
      // A buyer that is not one of the two changes nothing.
      expect((await jane.updateRequest(id, { buyer: 'someone' as never })).buyer).toBe('self');
    });

    it('does not let the buyer change once the request has been approved or submitted (P-037)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await approvedAndReady(h);
      const refusal = await jane.updateRequest(id, { buyer: 'approver' }).then(
        () => undefined,
        (e: unknown) => e
      );
      expect(refusal).toBeInstanceOf(NotAllowedError);
      expect((refusal as Error).message).toBe(notAllowed.buyerLocked);
      expect((await jane.getRequest(id)).request).toMatchObject({ buyer: 'self', status: 'Approved' });
      // The same buyer is not a change.
      expect((await jane.updateRequest(id, { buyer: 'self', department: 'Testing' })).department).toBe('Testing');
      await jane.submitRequest(id, CERTIFICATION);
      await expect(jane.updateRequest(id, { buyer: 'approver' })).rejects.toBeInstanceOf(NotAllowedError);
    });

    it('takes an approval back when the buyer changes on a request returned at processing, so it can be sent to the approver (P-037)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const max = h.as(MAX, APPROVED_AT);
      const { id } = await approvedAndReady(h);
      await h.as(JANE, SUBMITTED_AT).submitRequest(id, CERTIFICATION);
      await max.returnRequest(id, 'Please add the invoice.');
      expect((await jane.getRequest(id)).request).toMatchObject({ status: 'Returned', returnStage: 'processing', approvedBy: 'Max Wamsley' });
      await jane.updateRequest(id, { buyer: 'approver' });
      const { request } = await jane.getRequest(id);
      expect(request).toMatchObject({
        buyer: 'approver',
        status: 'Returned',
        approvedBy: '',
        approvedByEmail: '',
        approvedOn: '',
        approvalNote: '',
        boughtBeforeApproval: false
      });
      expect(request.approval.approved).toEqual([]);
      // It now needs approval, and can be sent with the certification (it was a dead end: it read as approved).
      // The approver needs the web address of each item, or a reason, so the employee adds them first.
      const rows = (await jane.getRequest(id)).lines;
      await expect(jane.sendForApproval(id, CERTIFICATION)).rejects.toBeInstanceOf(SubmissionBlockedError);
      for (const row of rows) await jane.updateLine(row.id, { itemLink: `https://www.example.com/item-${row.rowNumber}` });
      const sent = await jane.sendForApproval(id, CERTIFICATION);
      expect(sent).toMatchObject({ type: 'approval', certificationText: CERTIFICATION });
      expect((await jane.getRequest(id)).request.status).toBe('Awaiting approval');
    });

    it('lets an approver who is also the requester return the request after adding a row of their own, as the owner (P-042)', async () => {
      const h = await makeHarness();
      const max = h.as(MAX, NOW);
      const made = await fill(max, [NORTHWIND], { ...HEADER, buyer: 'approver' });
      await max.sendForApproval(made.id, CERTIFICATION);
      const approver = h.as(MAX, APPROVED_AT);
      await approver.approveRequest(made.id, { note: '', categories: {} });
      await approver.addEmptyLine(made.id);
      // The row is the owner's own, so it does not stop the return (the approver is the owner).
      await approver.returnRequest(made.id, 'I cannot buy it today.');
      expect((await max.getRequest(made.id)).request.status).toBe('Returned');
      expect((await max.getRequest(made.id)).lines).toHaveLength(2);
    });

    it('sends every request to the approver, however small, and asks for the web address of each item or a reason (P-039)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await fill(jane, [{ ...NORTHWIND, itemLink: '' }], { ...HEADER, buyer: 'approver' });
      const error = await jane.sendForApproval(id, CERTIFICATION).then(
        () => undefined,
        (e: unknown) => e
      );
      expect(error).toBeInstanceOf(SubmissionBlockedError);
      expect((error as SubmissionBlockedError).issues.map((i) => [i.field, i.message])).toEqual([['link', messages.linkOrReason]]);
      const [line] = (await jane.getRequest(id)).lines;
      await jane.updateLine(line.id, { noLinkReason: 'Not sold online' });
      const submission = await jane.sendForApproval(id, CERTIFICATION);
      expect(submission).toMatchObject({ type: 'approval', certificationText: CERTIFICATION, totalReimburseCents: 0, totalCompanyCents: 8645 });
      expect((await jane.getRequest(id)).request).toMatchObject({ status: 'Awaiting approval', approvalRounds: 1, boughtBeforeApproval: false });
    });

    it('never keeps "who paid" as an unconfirmed suggestion when the approver buys, but keeps the others', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id, lines } = await fill(jane, [NORTHWIND], { ...HEADER, buyer: 'approver' });
      await jane.updateLine(lines[0].id, { paidBy: 'employee', suggested: ['paidBy', 'amount'] });
      expect((await jane.getRequest(id)).lines[0]).toMatchObject({ paidBy: 'company', suggested: ['amount'] });
      await jane.updateLine(lines[0].id, { suggested: [] });
      await jane.updateLine(lines[0].id, { suggested: ['paidBy'] });
      expect((await jane.getRequest(id)).lines[0].suggested).toEqual([]);
      // When the employee buys, the mark stays.
      const own = await fill(jane, [POSTAGE]);
      await jane.updateLine(own.lines[0].id, { suggested: ['paidBy'] });
      expect((await jane.getRequest(own.id)).lines[0].suggested).toEqual(['paidBy']);
    });

    it('refuses an address that is not a web address, and keeps a long one whole', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id, lines } = await fill(jane, [NORTHWIND], { ...HEADER, buyer: 'approver' });
      await jane.updateLine(lines[0].id, { itemLink: 'javascript:alert(1)' });
      await expect(jane.sendForApproval(id, CERTIFICATION)).rejects.toMatchObject({
        issues: [expect.objectContaining({ field: 'link', message: messages.linkNotAddress })]
      });
      const long = `https://www.example.com/${'a'.repeat(1500)}`;
      expect((await jane.updateLine(lines[0].id, { itemLink: long })).itemLink).toBe(long);
      expect((await jane.getRequest(id)).lines[0].itemLink).toBe(long);
      // One past the longest allowed is kept, so the check can refuse it, rather than cut to an address that opens another page.
      const tooLong = `https://www.example.com/${'a'.repeat(2100)}`;
      expect((await jane.updateLine(lines[0].id, { itemLink: tooLong })).itemLink).toHaveLength(2001);
      await expect(jane.sendForApproval(id, CERTIFICATION)).rejects.toMatchObject({
        issues: [expect.objectContaining({ field: 'link', message: messages.linkTooLong(2000) })]
      });
    });

    it('refuses to send without the certification, or with another sentence, and sends nothing (P-037)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await fill(jane, [NORTHWIND], { ...HEADER, buyer: 'approver' });
      await expect(jane.sendForApproval(id)).rejects.toThrow(messages.certificationRequiredToSend);
      await expect(jane.sendForApproval(id, 'I agree.')).rejects.toThrow(messages.certificationRequiredToSend);
      expect((await jane.getRequest(id)).request.status).toBe('Draft');
      expect(await jane.listSubmissionsForRequest(id)).toEqual([]);
    });

    it('records the certification on the approval request, and the rows and vendor totals as sent', async () => {
      const h = await makeHarness();
      const { id, submission } = await askedAndSent(h);
      expect(submission).toMatchObject({ type: 'approval', certificationText: CERTIFICATION, submitterEmail: JANE.email });
      expect(submission.emailSummary).toContain('The approver buys this request.');
      const { request } = await h.as(MAX, NOW).getRequest(id);
      expect(request.approval.sent.map((g) => [g.vendor, g.cents, g.bought])).toEqual([
        ['Acme Lab Supply', 100000, false],
        ['Northwind Office Supply', 8645, false]
      ]);
      expect(request.approval.rows?.map((r) => [r.rowNumber, r.vendor, r.amountCents, r.category])).toEqual([
        [1, 'Acme Lab Supply', 100000, 'R&D Materials & Supplies'],
        [2, 'Northwind Office Supply', 8645, 'Office Supplies']
      ]);
    });

    it('does not flag a purchase as bought before approval, whatever the date or receipt', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await fill(jane, [{ ...POSTAGE, date: '2026-09-01' }], { ...HEADER, buyer: 'approver' });
      const submission = await jane.sendForApproval(id, CERTIFICATION);
      expect(submission.boughtBeforeApproval).toBe(false);
      expect((await jane.getRequest(id)).request).toMatchObject({ boughtBeforeApproval: false });
    });

    it('is not submitted by the employee, who has nothing to submit', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const { id } = await fill(jane, [POSTAGE], { ...HEADER, buyer: 'approver' });
      expect((await refusal(jane.submitRequest(id, CERTIFICATION))).message).toBe(notAllowed.approverBuys);
    });

    it('goes to the approver as Awaiting approval, which only the approver can approve, with every vendor total approved', async () => {
      const h = await makeHarness();
      const { id } = await askedAndSent(h);
      const max = h.as(MAX, APPROVED_AT);
      const approved = await max.approveRequest(id, { note: 'I will order it.', categories: {} });
      expect(approved).toMatchObject({ status: 'Approved', approvedBy: 'Max Wamsley', approvedByEmail: MAX.email, approvalNote: 'I will order it.' });
      expect(approved.approval.approved.map((g) => [g.vendor, g.cents, g.bought])).toEqual([
        ['Acme Lab Supply', 100000, false],
        ['Northwind Office Supply', 8645, false]
      ]);
      expect(approved.approval.rows).toHaveLength(2);
      // Approving confirms every row's category.
      expect((await max.getRequest(id)).lines.map((l) => l.categoryConfirmedBy)).toEqual(['Max Wamsley', 'Max Wamsley']);
    });

    it("is locked to the employee once approved: it is the approver's to change", async () => {
      const h = await makeHarness();
      const { id, lines } = await approvedForMax(h);
      const jane = h.as(JANE, NOW);
      expect((await refusal(jane.updateLine(lines[0].id, { vendor: 'Changed' }))).message).toBe(notAllowed.locked);
      expect((await refusal(jane.addEmptyLine(id))).message).toBe(notAllowed.locked);
      expect((await refusal(jane.addFileToLine(lines[0].id, pdf('r.pdf'), 'receipt'))).message).toBe(notAllowed.locked);
      expect((await refusal(jane.deleteLine(lines[0].id))).message).toBe(notAllowed.locked);
      expect((await refusal(jane.updateRequest(id, { department: 'Changed' }))).message).toBe(notAllowed.locked);
      expect((await refusal(jane.submitRequest(id, CERTIFICATION))).message).toBe(notAllowed.locked);
      // She can still read it.
      expect((await jane.getRequest(id)).request.status).toBe('Approved');
    });

    it('lets only the approver who approved it change it, attach files to it or mark it purchased', async () => {
      const h = await makeHarness();
      const { id, lines } = await approvedForMax(h);
      const olive = h.as(OLIVE, APPROVED_AT);
      expect((await refusal(olive.updateLine(lines[0].id, { vendor: 'Changed' }))).message).toBe(notAllowed.buyerOnly);
      expect((await refusal(olive.addEmptyLine(id))).message).toBe(notAllowed.buyerOnly);
      expect((await refusal(olive.deleteLine(lines[0].id))).message).toBe(notAllowed.buyerOnly);
      expect((await refusal(olive.addFileToLine(lines[0].id, pdf('r.pdf'), 'receipt'))).message).toBe(notAllowed.buyerOnly);
      expect((await refusal(olive.markPurchased(id))).message).toBe(notAllowed.buyerOnly);
      expect((await refusal(olive.returnRequest(id, 'No'))).message).toBe(notAllowed.buyerOnly);
      // Another employee cannot reach it at all.
      expect((await refusal(h.as(SAM, NOW).updateLine(lines[0].id, { vendor: 'Changed' }))).message).toBe(messages.spNotFound);
      expect((await h.as(MAX, APPROVED_AT).updateLine(lines[0].id, { vendor: 'Acme Lab Supply Inc.' })).vendor).toBe('Acme Lab Supply Inc.');
    });

    it('is refused to anyone but an administrator, and only while it is approved and the approver buys it', async () => {
      const h = await makeHarness();
      const { id } = await askedAndSent(h);
      expect((await refusal(h.as(JANE, NOW).markPurchased(id))).message).toBe(notAllowed.administratorsOnly);
      expect((await refusal(h.as(MAX, APPROVED_AT).markPurchased(id))).message).toBe(notAllowed.buyWhen);
      const own = await fill(h.as(JANE, NOW), [POSTAGE]);
      expect((await refusal(h.as(MAX, APPROVED_AT).markPurchased(own.id))).message).toBe(notAllowed.employeeBuys);
    });

    it('lets the approver correct the amounts, change and add rows, attach the receipt and mark it purchased', async () => {
      const h = await makeHarness();
      const { id, lines } = await approvedForMax(h);
      const max = h.as(MAX, SUBMITTED_AT);
      // Max paid far more than was approved, with no new approval (the employee's 10% rule does not apply to him).
      await max.updateLine(lines[0].id, { amountCents: 150000, vendor: 'Acme Lab Supply Inc.', description: 'Pipette tips, shipped' });
      // A category he chooses is confirmed by him, not left as Jane's suggestion.
      const changed = await max.updateLine(lines[1].id, { category: 'shipping' });
      expect(changed).toMatchObject({ category: 'shipping', categoryConfirmedBy: 'Max Wamsley' });
      const extra = await max.addEmptyLine(id);
      expect(extra).toMatchObject({ rowNumber: 3, paidBy: 'company', date: '2026-10-18' });
      await max.updateLine(extra.id, { vendor: 'Courier Co', description: 'Courier', category: 'shipping', amountCents: 1500 });
      await attachAll(max, id);
      const submission = await max.markPurchased(id);
      expect(submission).toMatchObject({
        type: 'package',
        submissionNumber: 1,
        submitterName: 'Max Wamsley',
        submitterEmail: MAX.email,
        certificationText: CERTIFICATION,
        approvedBy: 'Max Wamsley',
        totalReimburseCents: 0,
        totalCompanyCents: 150000 + 8645 + 1500,
        boughtBeforeApproval: false
      });
      expect(submission.emailSubject).toBe('Purchase request bought: Jane Doe, Lab supplies for the Phase 1 assay (PR-0001)');
      expect(submission.emailSummary).toContain('Bought by the approver: Max Wamsley (max.wamsley@example.com)');
      expect(submission.emailSummary).toContain('Certified by Jane Doe (jane.doe@example.com) when the request was sent, ');
      // The administrator is told the approver changed the rows the employee sent.
      expect(submission.emailSummary).toContain('The approver changed the rows after the employee sent the request.');
      const request = (await max.getRequest(id)).request;
      expect(request).toMatchObject({ status: 'Submitted', submissionCount: 1 });
      // What Jane sent is kept as it was.
      expect(request.approval.rows?.map((r) => [r.vendor, r.amountCents])).toEqual([
        ['Acme Lab Supply', 100000],
        ['Northwind Office Supply', 8645]
      ]);
      const csv = await max.getSubmissionCsv(submission.id);
      expect(csv).toContain('Approver,Company,No');
      expect(csv).toContain('Jane Doe (jane.doe@example.com)');
      expect(csv).toContain('https://www.example.com/');
    });

    it('checks the receipts when the approver marks it purchased, and writes nothing if something is missing', async () => {
      const h = await makeHarness();
      const { id } = await approvedForMax(h);
      const max = h.as(MAX, SUBMITTED_AT);
      const error = await max.markPurchased(id).then(
        () => undefined,
        (e: unknown) => e
      );
      expect(error).toBeInstanceOf(SubmissionBlockedError);
      expect((error as SubmissionBlockedError).issues.map((i) => i.field)).toEqual(['receipt', 'receipt']);
      expect((await max.getRequest(id)).request.status).toBe('Approved');
      expect((await max.listSubmissionsForRequest(id)).filter((s) => s.type === 'package')).toEqual([]);
    });

    it('lets the approver return an approved request to the employee, after deleting the rows the approver added', async () => {
      const h = await makeHarness();
      const { id } = await approvedForMax(h);
      const max = h.as(MAX, SUBMITTED_AT);
      const extra = await max.addEmptyLine(id);
      expect((await refusal(max.returnRequest(id, 'The item is out of stock.'))).message).toBe(notAllowed.addedRowsFirst('row 3'));
      await max.deleteLine(extra.id);
      const returned = await max.returnRequest(id, 'The item is out of stock. Please choose another.');
      expect(returned).toMatchObject({
        status: 'Returned',
        returnStage: 'approval',
        returnNote: 'The item is out of stock. Please choose another.',
        approvedBy: ''
      });
      expect(returned.approval.approved).toEqual([]);
      // The employee can change it again and send it again, certifying again; the approver approves the second round.
      const jane = h.as(JANE, SUBMITTED_AT);
      const rows = (await jane.getRequest(id)).lines;
      await jane.updateLine(rows[0].id, { vendor: 'Thorlabs' });
      expect(await jane.sendForApproval(id, CERTIFICATION)).toMatchObject({ submissionNumber: 2, type: 'approval' });
      expect((await max.approveRequest(id, { note: '', categories: {} })).status).toBe('Approved');
    });

    it('refuses to return an approved request that the employee buys, or one that is not approved, as the approver (P-037)', async () => {
      const h = await makeHarness();
      const own = await approvedAndReady(h);
      // Returning an approved request is only for the approver who buys it.
      expect((await refusal(h.as(MAX, APPROVED_AT).returnRequest(own.id, 'No'))).message).toBe(notAllowed.returnWhen);
      const draft = await fill(h.as(JANE, NOW), [POSTAGE], { ...HEADER, buyer: 'approver' });
      expect((await refusal(h.as(MAX, APPROVED_AT).returnRequest(draft.id, 'No'))).message).toBe(notAllowed.returnWhen);
    });

    it('sends a request the administrator returns at processing back to the approver, who buys it again as R2', async () => {
      const h = await makeHarness();
      const { id } = await approvedForMax(h);
      const max = h.as(MAX, SUBMITTED_AT);
      await attachAll(max, id);
      const first = await max.markPurchased(id);
      const olive = h.as(OLIVE, new Date(2026, 9, 19, 9, 0));
      const returned = await olive.returnRequest(id, 'Row 2: please attach the itemized invoice.');
      // It goes back to the approver, as Approved, not to the employee, who cannot fix an approver's purchase.
      expect(returned).toMatchObject({
        status: 'Approved',
        returnStage: 'processing',
        returnNote: 'Row 2: please attach the itemized invoice.',
        approvedBy: 'Max Wamsley'
      });
      expect(returned.approval.approved).toHaveLength(2);
      const jane = h.as(JANE, NOW);
      expect((await refusal(jane.updateLine((await jane.getRequest(id)).lines[0].id, { vendor: 'x' }))).message).toBe(notAllowed.locked);
      const again = await h.as(MAX, new Date(2026, 9, 19, 10, 0)).markPurchased(id);
      expect(again).toMatchObject({ submissionNumber: 2, previousFolderName: first.folderName });
      expect(again.folderName.endsWith('_R2')).toBe(true);
      expect((await max.getRequest(id)).request).toMatchObject({ status: 'Submitted', submissionCount: 2, returnNote: '', returnStage: '' });
    });

    it('will not mark a row processed while its account depends on a decision nobody has made (P-038)', async () => {
      const h = await makeHarness();
      const jane = h.as(JANE, NOW);
      const made = await fill(jane, [
        { ...POSTAGE, category: 'equipment' },
        { ...POSTAGE, vendor: 'Other Vendor', category: 'other' }
      ]);
      const other = (await jane.getRequest(made.id)).lines[1];
      await jane.updateLine(other.id, { categoryOther: 'Lab safety audit' });
      await jane.submitRequest(made.id, CERTIFICATION);
      const max = h.as(MAX, APPROVED_AT);
      expect((await refusal(max.markProcessed(made.id))).message).toBe(notAllowed.reviewFirst('rows 1 and 2'));
      // Confirming one is not enough, and confirming both is.
      await max.confirmCategories(made.id, {});
      const lines = (await max.getRequest(made.id)).lines;
      expect(lines.map((l) => l.categoryConfirmedBy)).toEqual(['Max Wamsley', 'Max Wamsley']);
      expect((await max.markProcessed(made.id)).status).toBe('Processed');
    });

    it('does not hold up a row that is not for review, or a request the approver approved and confirmed', async () => {
      const h = await makeHarness();
      const { id } = await approvedForMax(h, [{ ...POSTAGE, category: 'equipment' }]);
      const max = h.as(MAX, SUBMITTED_AT);
      await attachAll(max, id);
      await max.markPurchased(id);
      // Approving confirmed the category (P-024), so the approver's own decision is on record.
      expect((await max.markProcessed(id)).status).toBe('Processed');
    });
  });
}
