// The mock service and the sample data the preview and the screens' tests use.
// The rules it shares with the SharePoint service are in dataServiceContract.ts
// and run here too; this file covers what only the mock does: the sample
// store, saving after every change, the simulated flow, and the preview's
// switching between people.

import { toLocalDateTime } from '../../domain/dates';
import { findCrossEmployeeDuplicates, findDuplicates } from '../../domain/duplicates';
import { messages } from '../../domain/messages';
import { CERTIFICATION, EMPTY_APPROVAL, approvalCoverage, groupsForApproval, vendorGroups } from '../../domain/purchaseRules';
import { submissionStatusDisplay } from '../../domain/statuses';
import { computeTotals } from '../../domain/totals';
import { ApprovalRecord, CurrentUser, PackageStatus, Submission } from '../../domain/types';
import { approvalStateOf } from '../../domain/validation';
import { checkFlowConfig } from '../../export/flowPackage';
import { LISTS } from '../sharepoint/schema';
import { NotAllowedError, notAllowed } from '../sharepoint/serviceRules';
import { Harness, JANE, Person, describeDataServiceRules } from './dataServiceContract';
import { MockDataService, NotAllowedError as MockNotAllowedError, finishPendingWork, notSetUp, readySetup } from './MockDataService';
import { SAMPLE_USERS, SampleStore, createEmptyStore, createSampleStore, packagedFolderLink } from './sampleData';

const NOW = new Date(2026, 9, 16, 9, 30);
const LATER = new Date(2026, 9, 17, 10, 5);
/** Before the draft's purchase date of 2026-10-14, so nothing in it looks already bought. */
const EARLY = new Date(2026, 9, 12, 9, 30);

const user = (p: Person): CurrentUser => ({ displayName: p.name, email: p.email, isAdministrator: p.admin });
const pdf = (name: string, content = `synthetic ${name}`): File => new File([content], name, { type: 'application/pdf' });
const png = (name: string, content = `synthetic ${name}`): File => new File([content], name, { type: 'image/png' });
const tick = (ms = 5) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function blankSubmission(overrides: Partial<Submission>): Submission {
  return {
    id: 0,
    requestId: 0,
    requestNumber: '',
    type: 'package',
    submissionNumber: 1,
    packageStatus: 'Uploading',
    folderName: '',
    previousFolderName: '',
    submitterName: '',
    submitterEmail: '',
    submittedOn: '2026-10-16 09:30',
    certificationText: '',
    businessPurpose: '',
    department: '',
    projectCode: '',
    purchaseDates: '',
    totalReimburseCents: 0,
    totalCompanyCents: 0,
    totalRequestCents: 0,
    receiptCount: 0,
    quoteCount: 0,
    rowsWithoutReceipt: 0,
    boughtBeforeApproval: false,
    approvedBy: '',
    approvedOn: '',
    emailSubject: '',
    emailSummary: '',
    folderLink: '',
    packagedAt: '',
    errorMessage: '',
    packageFileNames: [],
    ...overrides
  };
}

async function harness(): Promise<Harness & { store: SampleStore }> {
  const store = createEmptyStore();
  return {
    store,
    as: (person: Person, now: Date = NOW) => new MockDataService(store, user(person), 0, undefined, () => now),
    setSubmissionState: (id, status, errorMessage = '', madeAt) => {
      const submission = store.submissions.find((s) => s.id === id)!;
      submission.packageStatus = status;
      submission.errorMessage = errorMessage;
      if (madeAt) {
        submission.submittedOn = toLocalDateTime(madeAt);
        submission.lastChanged = toLocalDateTime(madeAt);
      }
    },
    editLineDirectly: (lineId, edit) => {
      const line = store.lines.find((l) => l.id === lineId)!;
      if (edit.amountCents !== undefined) line.amountCents = edit.amountCents;
      if (edit.vendor !== undefined) line.vendor = edit.vendor;
      if (edit.date !== undefined) line.date = edit.date;
    },
    addUploadingSubmission: (owner, request, type, number) => {
      const id = store.nextSubmissionId++;
      store.submissions.push(
        blankSubmission({ id, requestId: request.id, requestNumber: request.requestNumber, type, submissionNumber: number, submitterEmail: owner.email })
      );
      return id;
    },
    leaveApproval: (requestId, approver, approved) => {
      const request = store.requests.find((r) => r.id === requestId)!;
      request.approval = { ...request.approval, approved };
      request.approvedOn = '2026-10-14 10:05';
      request.approvedBy = approver.name;
      request.approvedByEmail = approver.email;
      request.approvalNote = 'Left by an edit';
    }
  };
}

describeDataServiceRules('MockDataService', harness);

/** What the preview does when it switches person: the store is saved as plain data, restored, and the flow's unfinished work is finished. */
function reload(store: SampleStore): SampleStore {
  const restored = JSON.parse(JSON.stringify(store)) as SampleStore;
  finishPendingWork(restored);
  return restored;
}

const asJane = (store: SampleStore, now = NOW) => new MockDataService(store, SAMPLE_USERS.jane, 0, undefined, () => now);
const asSam = (store: SampleStore, now = NOW) => new MockDataService(store, SAMPLE_USERS.sam, 0, undefined, () => now);
const asMax = (store: SampleStore, now = LATER) => new MockDataService(store, SAMPLE_USERS.admin, 0, undefined, () => now);

describe('the sample people', () => {
  it('are Jane Doe and Sam Lee, who are employees, and Max Wamsley, the administrator and approver, at example.com', () => {
    expect(SAMPLE_USERS).toEqual({
      jane: { displayName: 'Jane Doe', email: 'jane.doe@example.com', isAdministrator: false },
      sam: { displayName: 'Sam Lee', email: 'sam.lee@example.com', isAdministrator: false },
      admin: { displayName: 'Max Wamsley', email: 'max.wamsley@example.com', isAdministrator: true }
    });
  });
});

describe('the sample data (P-031)', () => {
  const store = createSampleStore();
  const request = (n: number) => store.requests.find((r) => r.id === n)!;
  const linesOf = (n: number) => store.lines.filter((l) => l.requestId === n).sort((a, b) => a.rowNumber - b.rowNumber);

  it("has ten requests, six of Jane's in R&D with the grant code and four of Sam's in Operations without one", () => {
    const grant = 'NSF SBIR Phase 1 (Award # 2528301)';
    expect(store.requests.map((r) => [r.requestNumber, r.ownerName, r.department, r.projectCode, r.status, r.buyer])).toEqual([
      ['PR-0041', 'Jane Doe', 'R&D', grant, 'Draft', 'approver'],
      ['PR-0040', 'Jane Doe', 'R&D', grant, 'Awaiting approval', 'approver'],
      ['PR-0039', 'Jane Doe', 'R&D', grant, 'Submitted', 'approver'],
      ['PR-0038', 'Jane Doe', 'R&D', grant, 'Approved', 'approver'],
      ['PR-0037', 'Jane Doe', 'R&D', grant, 'Submitted', 'self'],
      ['PR-0036', 'Jane Doe', 'R&D', grant, 'Processed', 'self'],
      ['PR-0035', 'Sam Lee', 'Operations', '', 'Submitted', 'self'],
      ['PR-0034', 'Sam Lee', 'Operations', '', 'Returned', 'self'],
      ['PR-0033', 'Sam Lee', 'Operations', '', 'Returned', 'approver'],
      ['PR-0032', 'Sam Lee', 'Operations', '', 'Awaiting approval', 'self']
    ]);
    expect(store.requests.every((r) => r.ownerEmail === (r.ownerName === 'Jane Doe' ? 'jane.doe@example.com' : 'sam.lee@example.com'))).toBe(true);
    expect(store.requests.map((r) => r.businessPurpose)).toEqual([
      'Lab supplies for the Phase 1 assay',
      'Software license for the analysis pipeline',
      'Cell culture supplies for the Phase 1 assay',
      'Sensor kit for the Phase 1 prototype',
      'Website hosting and marketing',
      'Office supplies and postage',
      'Office supplies for the new hire',
      'Training course',
      'Workbench for the new lab space',
      'Conference booth materials'
    ]);
    expect(store.nextRequestId).toBe(42);
  });

  it('has the purchases the story needs, with their files by kind', () => {
    const rows = store.lines.map((l) => [
      `PR-00${l.requestId}`,
      l.rowNumber,
      l.vendor,
      l.amountCents,
      l.category,
      l.paidBy,
      l.files.map((f) => `${f.kind}:${f.fileName}`)
    ]);
    expect(rows).toEqual([
      ['PR-0041', 1, 'Acme Lab Supply', 64000, 'rdMaterials', 'company', ['quote:acme-lab-supply-quote.pdf']],
      ['PR-0041', 2, 'Northwind Office Supply', 8645, 'office', 'company', []],
      ['PR-0040', 1, 'Harbor Software', 87000, 'computer', 'company', ['quote:harbor-software-quote.pdf']],
      ['PR-0040', 2, 'Blue Fern Web Co.', 12900, 'advertising', 'company', []],
      ['PR-0038', 1, 'Kestrel Instruments', 115000, 'rdMaterials', 'company', ['quote:kestrel-instruments-quote.pdf']],
      ['PR-0039', 1, 'Cobalt Biosupply', 21550, 'rdMaterials', 'company', ['receipt:cobalt-biosupply-invoice.pdf']],
      ['PR-0039', 2, 'Cobalt Biosupply', 1850, 'shipping', 'company', []],
      ['PR-0037', 1, 'Blue Fern Web Co.', 62000, 'advertising', 'company', ['receipt:blue-fern-web-invoice.pdf']],
      ['PR-0037', 2, 'Blue Fern Web Co.', 52000, 'advertising', 'company', []],
      ['PR-0036', 1, 'Northwind Office Supply', 8645, 'office', 'employee', ['receipt:northwind-office-receipt.png']],
      ['PR-0036', 2, 'QuickShip Postage', 2460, 'shipping', 'company', ['receipt:quickship-postage-receipt.png']],
      ['PR-0035', 1, 'Northwind Office Supply', 8645, 'office', 'employee', ['receipt:northwind-office-receipt.png']],
      ['PR-0034', 1, 'Summit Training Institute', 45000, 'training', 'employee', ['receipt:summit-training-receipt.pdf']],
      ['PR-0034', 2, 'Lakeview Bookshop', 3820, 'training', 'employee', []],
      ['PR-0033', 1, 'Northwind Office Supply', 6430, 'office', 'company', []],
      ['PR-0033', 2, 'Redwood Fabrication', 90000, 'other', 'company', []],
      ['PR-0032', 1, 'Ridgeline Displays', 130000, 'advertising', 'company', []]
    ]);
    expect(linesOf(41)[0].description).toBe('Pipette tips and centrifuge tubes for the assay');
    expect(linesOf(41)[1].description).toBe('Lab notebooks and labels');
    expect(linesOf(33)[1]).toMatchObject({ categoryOther: 'Lab furniture' });
    expect(linesOf(37)[1].sameReceiptAsRow).toBe(1);
    expect(linesOf(37)[0].noQuoteReason).toBe('Already purchased');
    expect(linesOf(34)[1].noReceiptReason).not.toBe('');
    expect(linesOf(32)[0].noQuoteReason).not.toBe('');
  });

  it('shows the confirmed categories of the approved and submitted requests, and only those', () => {
    const confirmed = store.lines.filter((l) => l.categoryConfirmedBy !== '').map((l) => [`PR-00${l.requestId}`, l.rowNumber, l.categoryConfirmedBy]);
    expect(confirmed).toEqual([
      ['PR-0038', 1, 'Max Wamsley'],
      ['PR-0039', 1, 'Max Wamsley'],
      ['PR-0039', 2, 'Max Wamsley'],
      ['PR-0037', 1, 'Max Wamsley'],
      ['PR-0037', 2, 'Max Wamsley']
    ]);
  });

  it('has the dates, times and totals of each request, kept current', () => {
    for (const r of store.requests) {
      const t = computeTotals(linesOf(r.id), r.buyer);
      expect([r.totalReimburseCents, r.totalCompanyCents, r.totalRequestCents]).toEqual([t.reimburseCents, t.companyCents, t.requestCents]);
    }
    // The company pays for everything the approver buys, so nothing in those requests is to reimburse (P-037).
    expect(store.requests.map((r) => [r.requestNumber, r.totalReimburseCents, r.totalCompanyCents, r.totalRequestCents])).toEqual([
      ['PR-0041', 0, 72645, 72645],
      ['PR-0040', 0, 99900, 99900],
      ['PR-0039', 0, 23400, 23400],
      ['PR-0038', 0, 115000, 115000],
      ['PR-0037', 0, 114000, 114000],
      ['PR-0036', 8645, 2460, 11105],
      ['PR-0035', 8645, 0, 8645],
      ['PR-0034', 48820, 0, 48820],
      ['PR-0033', 0, 96430, 96430],
      ['PR-0032', 0, 130000, 130000]
    ]);
    const month = /^2026-(09|10)-\d\d( \d\d:\d\d)?$/;
    for (const l of store.lines) expect(l.date).toMatch(month);
    for (const r of store.requests) {
      for (const time of [r.lastChanged, r.sentForApprovalOn, r.approvedOn, r.submittedOn, r.processedOn]) if (time) expect(time).toMatch(month);
    }
    for (const s of store.submissions) for (const time of [s.submittedOn, s.packagedAt]) if (time) expect(time).toMatch(month);
  });

  it('has each request at the stage the story says', () => {
    expect(request(40)).toMatchObject({ approvalRounds: 1, sentForApprovalOn: '2026-09-29 09:12', approvedBy: '', submissionCount: 0 });
    expect(request(38)).toMatchObject({
      approvalRounds: 1,
      approvedOn: '2026-09-25 10:05',
      approvedBy: 'Max Wamsley',
      approvedByEmail: 'max.wamsley@example.com',
      approvalNote: 'OK, use the company card.',
      submissionCount: 0
    });
    expect(request(39)).toMatchObject({
      approvalRounds: 1,
      approvedOn: '2026-10-08 13:10',
      approvedBy: 'Max Wamsley',
      submittedOn: '2026-10-10 14:20',
      submissionCount: 1,
      boughtBeforeApproval: false
    });
    expect(request(37)).toMatchObject({ boughtBeforeApproval: true, approvedOn: '2026-09-22 14:30', approvedBy: 'Max Wamsley', submissionCount: 1 });
    expect(request(36)).toMatchObject({ processedBy: 'Max Wamsley', submissionCount: 1, approvalRounds: 0 });
    expect(request(35)).toMatchObject({ submissionCount: 1, approvalRounds: 0 });
    expect(request(34)).toMatchObject({
      returnStage: 'processing',
      returnNote: 'Row 2: please attach the itemized invoice, not the card slip.',
      approvalRounds: 0,
      submissionCount: 1
    });
    expect(request(33)).toMatchObject({
      returnStage: 'approval',
      returnNote: 'Please add a quote for the second vendor, or say why there is none.',
      approvalRounds: 1,
      submissionCount: 0
    });
    expect(request(32)).toMatchObject({ approvalRounds: 1, submissionCount: 0 });
    expect(linesOf(33).map((l) => vendorGroups([l], 'approver')[0].totalCents)).toContain(90000);
    expect(request(41)).toMatchObject({ approvalRounds: 0, sentForApprovalOn: '', returnStage: '', returnNote: '' });
  });

  it('records, for each request, an approval that agrees with its status: no request shows the wrong state', () => {
    const expected: Record<number, ReturnType<typeof approvalStateOf>> = {
      41: 'needed',
      40: 'pending',
      39: 'approved',
      38: 'approved',
      37: 'approved',
      36: 'notRequired',
      35: 'notRequired',
      34: 'notRequired',
      33: 'needed',
      32: 'pending'
    };
    for (const r of store.requests) expect([r.requestNumber, approvalStateOf(r, linesOf(r.id))]).toEqual([r.requestNumber, expected[r.id]]);
    // Approved means every approved vendor total still covers the request; nothing is approved before it is approved.
    // The approver who buys may change the amounts after approving (P-040), so only a request the employee buys is held to what was approved.
    for (const r of store.requests) {
      const groups = vendorGroups(linesOf(r.id), r.buyer);
      if (r.approval.approved.length > 0) {
        expect(['Approved', 'Submitted']).toContain(r.status);
        if (r.buyer === 'self') expect(approvalCoverage(groups, r.approval.approved).every((c) => c.covered)).toBe(true);
      }
      if (['Draft', 'Awaiting approval', 'Returned', 'Processed'].includes(r.status)) expect(r.approval.approved).toEqual([]);
    }
  });

  it('records what was sent for approval by the real rule, with the bought-before-approval flag', () => {
    // PR-0039 is left out: its rows were changed when it was bought, and what was sent is checked below.
    for (const r of store.requests.filter((x) => x.sentForApprovalOn && x.id !== 39)) {
      const lines = linesOf(r.id);
      const sentOn = r.sentForApprovalOn.slice(0, 10);
      const wanted = groupsForApproval(
        lines.map((l) => ({
          id: l.id,
          vendor: l.vendor,
          amountCents: l.amountCents,
          date: l.date,
          hasReceipt: l.files.some((f) => f.kind === 'receipt') || l.sameReceiptAsRow !== null
        })),
        sentOn,
        EMPTY_APPROVAL,
        r.buyer
      );
      expect([r.requestNumber, r.approval.sent]).toEqual([r.requestNumber, wanted]);
    }
    // The approver buys PR-0040: every vendor total goes to the approver, and the rows as sent are kept (P-037, P-040).
    expect(request(40).approval.sent).toEqual([
      { key: 'harborsoftware', vendor: 'Harbor Software', cents: 87000, bought: false },
      { key: 'bluefernwebco', vendor: 'Blue Fern Web Co.', cents: 12900, bought: false }
    ]);
    expect(request(40).approval.rows?.map((r) => [r.rowNumber, r.vendor, r.amountCents, r.itemLink !== ''])).toEqual([
      [1, 'Harbor Software', 87000, true],
      [2, 'Blue Fern Web Co.', 12900, true]
    ]);
    expect(request(38).approval).toMatchObject({
      sent: [{ key: 'kestrelinstruments', vendor: 'Kestrel Instruments', cents: 115000, bought: false }],
      approved: [{ key: 'kestrelinstruments', vendor: 'Kestrel Instruments', cents: 115000, bought: false }],
      earlier: []
    });
    // Jane asked for $200.00 of Cobalt Biosupply; Max paid $215.50 and added $18.50 of shipping.
    expect(request(39).approval.sent).toEqual([{ key: 'cobaltbiosupply', vendor: 'Cobalt Biosupply', cents: 20000, bought: false }]);
    expect(request(39).approval.approved).toEqual([{ key: 'cobaltbiosupply', vendor: 'Cobalt Biosupply', cents: 20000, bought: false }]);
    expect(request(39).approval.rows?.map((r) => [r.rowNumber, r.amountCents])).toEqual([[1, 20000]]);
    expect(request(37).approval).toEqual({
      sent: [{ key: 'bluefernwebco', vendor: 'Blue Fern Web Co.', cents: 114000, bought: true }],
      approved: [{ key: 'bluefernwebco', vendor: 'Blue Fern Web Co.', cents: 114000, bought: true }],
      earlier: []
    });
    expect(request(33).approval).toMatchObject({
      sent: [
        { key: 'northwindofficesupply', vendor: 'Northwind Office Supply', cents: 6430, bought: false },
        { key: 'redwoodfabrication', vendor: 'Redwood Fabrication', cents: 90000, bought: false }
      ],
      approved: [],
      earlier: []
    });
    // Every sample request has been sent for approval once at most, so none has an earlier approval.
    expect(store.requests.every((r) => r.approval.earlier.length === 0)).toBe(true);
    expect(request(32).approval.sent.map((g) => g.cents)).toEqual([130000]);
    expect(store.requests.filter((r) => r.approval.sent.length === 0).map((r) => r.requestNumber)).toEqual(['PR-0041', 'PR-0036', 'PR-0035', 'PR-0034']);
  });

  it('has the approval and package submissions the story needs, with the failures that need attention', () => {
    expect(store.submissions.map((s) => [s.id, s.requestNumber, s.type, s.submissionNumber, s.packageStatus, s.errorMessage])).toEqual([
      [1, 'PR-0037', 'approval', 1, 'Packaged', ''],
      [2, 'PR-0038', 'approval', 1, 'Packaged', ''],
      [3, 'PR-0037', 'package', 1, 'Packaged', ''],
      [4, 'PR-0040', 'approval', 1, 'Packaged', ''],
      [5, 'PR-0033', 'approval', 1, 'Packaged', ''],
      [6, 'PR-0032', 'approval', 1, 'Failed', 'The SharePoint connection in the flow needs to be signed in again.'],
      [7, 'PR-0034', 'package', 1, 'Packaged', ''],
      [8, 'PR-0036', 'package', 1, 'Packaged', ''],
      [10, 'PR-0039', 'approval', 1, 'Packaged', ''],
      [11, 'PR-0039', 'package', 1, 'Packaged', ''],
      [9, 'PR-0035', 'package', 1, 'Failed', 'The SharePoint connection in the flow needs to be signed in again.']
    ]);
    expect(store.nextSubmissionId).toBe(12);
    // Every request that has been sent or submitted has the submissions its counts say.
    for (const r of store.requests) {
      const mine = store.submissions.filter((s) => s.requestId === r.id);
      expect([r.requestNumber, mine.filter((s) => s.type === 'approval').length]).toEqual([r.requestNumber, r.approvalRounds]);
      expect([r.requestNumber, mine.filter((s) => s.type === 'package').length]).toEqual([r.requestNumber, r.submissionCount]);
    }
    const label = (id: number) => {
      const s = store.submissions.find((x) => x.id === id)!;
      return submissionStatusDisplay(s.type, s.packageStatus).label;
    };
    expect([label(4), label(6), label(8), label(9)]).toEqual(['Approver emailed', 'Approval email failed', 'Packaged', 'Packaging failed']);
  });

  it('fills in the email text and CSV of each submission with the real builders', () => {
    for (const s of store.submissions) {
      const owner = request(s.requestId);
      const approverBuys = owner.buyer === 'approver';
      expect(s.emailSubject).not.toBe('');
      expect(s.emailSummary).toContain(`Department: ${s.department}`);
      // The employee sends the request; when the approver buys, the approver also submits the package (P-037).
      expect(s.submitterEmail).toBe(s.type === 'package' && approverBuys ? owner.approvedByEmail : owner.ownerEmail);
      expect(s.businessPurpose).toBe(owner.businessPurpose);
      if (s.type === 'approval') {
        expect([s.folderName, s.packageFileNames, store.csvBySubmission[s.id]]).toEqual(['', [], '']);
        // When the approver buys, the employee certifies when sending the request (P-037).
        expect(s.certificationText).toBe(approverBuys ? CERTIFICATION : '');
        expect(s.emailSubject).toContain('Purchase approval needed');
        expect(s.emailSummary).toContain(
          approverBuys ? 'Every vendor total needs your approval, whatever the amount:' : 'Needs your approval (vendor totals of $500 or more):'
        );
      } else {
        expect(s.certificationText).toBe(CERTIFICATION);
        expect(s.folderName).toMatch(/_PR-00\d\d$/);
        expect(s.packageFileNames).toContain(`${s.requestNumber}_Purchases.csv`);
        expect(store.csvBySubmission[s.id]).toContain('Request,Row,Date,Vendor');
        expect(s.emailSummary).toContain(CERTIFICATION);
        expect(s.emailSubject).toContain(approverBuys ? 'Purchase request bought' : 'Purchase request submitted');
      }
    }
    const byId = (id: number) => store.submissions.find((s) => s.id === id)!;
    expect(byId(4).emailSummary).toContain('- Harbor Software: $870.00 (quote attached)');
    // A vendor total under the quote threshold says nothing about a quote.
    expect(byId(4).emailSummary).toContain('- Blue Fern Web Co.: $129.00\n');
    expect(byId(4).emailSummary).not.toContain('The item link');
    expect(byId(6).emailSummary).toContain('(no quote: The show organizer requires its approved vendor)');
    expect(byId(5).emailSummary).toContain('- Redwood Fabrication: $900.00 (no quote)');
    expect(byId(5).emailSummary).toContain('- Northwind Office Supply: $64.30\n');
    // PR-0039: Max bought it for Jane. The CSV names him as the buyer and Jane as the one who certified, and nothing is reimbursed (P-037).
    expect(byId(11)).toMatchObject({
      submitterName: 'Max Wamsley',
      submitterEmail: 'max.wamsley@example.com',
      folderName: '2026-10-09_Jane-Doe_Cell-culture-supplies-for-the-Phase-1-as_PR-0039',
      totalReimburseCents: 0,
      totalCompanyCents: 23400,
      receiptCount: 1,
      rowsWithoutReceipt: 0,
      boughtBeforeApproval: false
    });
    expect(byId(11).emailSummary).toContain('Bought by the approver: Max Wamsley (max.wamsley@example.com)');
    expect(byId(11).emailSummary).toContain('Certified by Jane Doe (jane.doe@example.com) when the request was sent, 2026-10-08 09:30:');
    expect(store.csvBySubmission[11]).toContain('Approver,Company,No');
    expect(store.csvBySubmission[11]).toContain('Jane Doe (jane.doe@example.com)');
    expect(store.csvBySubmission[11]).toContain('6182 R&D Materials & Supplies');
    expect(store.csvBySubmission[11]).toContain('https://www.cobalt-biosupply.example/media-and-flasks');
    expect(byId(3).packageFileNames.sort()).toEqual(['PR-0037_Purchases.csv', 'R01_blue-fern-web-invoice.pdf']);
    expect(byId(3)).toMatchObject({
      folderName: '2026-09-18_Jane-Doe_Website-hosting-and-marketing_PR-0037',
      folderLink: 'Accounting > Purchases > Purchases_To_Process > 2026-09-18_Jane-Doe_Website-hosting-and-marketing_PR-0037',
      receiptCount: 1,
      quoteCount: 0,
      rowsWithoutReceipt: 0,
      boughtBeforeApproval: true,
      approvedBy: 'Max Wamsley',
      approvedOn: '2026-09-22 14:30',
      totalCompanyCents: 114000,
      purchaseDates: '2026-09-18'
    });
    expect(byId(3).emailSummary).toContain('Approval: approved by Max Wamsley on 2026-09-22 14:30.');
    expect(byId(3).emailSummary).toContain('FLAG, bought before approval: Blue Fern Web Co. ($1,140.00).');
    expect(store.csvBySubmission[3]).toContain('Approved,Yes,Max Wamsley,2026-09-22 14:30');
    expect(store.csvBySubmission[8]).toContain('Not required,No,,');
    expect(byId(8)).toMatchObject({ approvedBy: '', receiptCount: 2, totalReimburseCents: 8645, totalCompanyCents: 2460 });
    expect(byId(7).packageFileNames.sort()).toEqual(['PR-0034_Purchases.csv', 'R01_summit-training-receipt.pdf']);
    expect(byId(7)).toMatchObject({ rowsWithoutReceipt: 1, receiptCount: 1 });
    expect(byId(9)).toMatchObject({ folderLink: '', packagedAt: '' });
    expect(byId(6)).toMatchObject({ folderLink: '', packagedAt: '', boughtBeforeApproval: false });
    expect(byId(2)).toMatchObject({ quoteCount: 1, receiptCount: 0 });
  });

  it('refers to receipt files by name, served from /receipts, each with its own ID and fingerprint except the duplicate receipt', () => {
    const known = [
      'acme-lab-supply-quote.pdf',
      'acme-lab-supply-invoice.pdf',
      'harbor-software-quote.pdf',
      'harbor-software-invoice.pdf',
      'blue-fern-web-invoice.pdf',
      'northwind-office-receipt.png',
      'quickship-postage-receipt.png',
      'summit-training-receipt.pdf',
      'kestrel-instruments-quote.pdf',
      'kestrel-instruments-invoice.pdf',
      'cobalt-biosupply-invoice.pdf'
    ];
    const files = store.lines.flatMap((l) => l.files);
    for (const f of files) {
      expect(known).toContain(f.fileName);
      expect(f.url).toBe(`/receipts/${f.fileName}`);
      expect(f.contentType).toBe(f.fileName.endsWith('.pdf') ? 'application/pdf' : 'image/png');
      expect(f.sizeBytes).toBeGreaterThan(0);
    }
    expect(new Set(files.map((f) => f.id)).size).toBe(files.length);
    const prints = files.map((f) => f.fingerprint);
    const duplicated = prints.filter((p, i) => prints.indexOf(p) !== i);
    expect(duplicated).toEqual(['sample-northwind-receipt']);
    expect(new Set(store.lines.map((l) => l.id)).size).toBe(store.lines.length);
  });

  it("has a cross-employee duplicate for the administrator: the same receipt, date, vendor and amount in two people's requests", async () => {
    const refs = await asMax(createSampleStore()).listAllLineRefs();
    const matches = findCrossEmployeeDuplicates(refs);
    expect(matches).toHaveLength(1);
    expect(matches[0].kind).toBe('file');
    expect([matches[0].a, matches[0].b].map((m) => [m.requestNumber, m.line.rowNumber, m.ownerEmail]).sort()).toEqual([
      ['PR-0035', 1, 'sam.lee@example.com'],
      ['PR-0036', 1, 'jane.doe@example.com']
    ]);
    const [a, b] = [matches[0].a.line, matches[0].b.line];
    expect([a.date, a.vendor, a.amountCents]).toEqual([b.date, b.vendor, b.amountCents]);
    expect(a.files[0].fingerprint).toBe(b.files[0].fingerprint);
    // Each employee, looking only at their own requests, sees no duplicate: only the administrator can compare people.
    const fresh = createSampleStore();
    const jane = asJane(fresh);
    const sam = asSam(fresh);
    const mine = fresh.lines.filter((l) => l.requestId === 36);
    const his = fresh.lines.filter((l) => l.requestId === 35);
    expect(findDuplicates('PR-0036', mine, await jane.getOwnerOtherLines(36))).toEqual([]);
    expect(findDuplicates('PR-0035', his, await sam.getOwnerOtherLines(35))).toEqual([]);
  });

  it('can be built again from scratch, with the same IDs, and as an empty store', () => {
    expect(createSampleStore().lines.map((l) => l.id)).toEqual(store.lines.map((l) => l.id));
    expect(createEmptyStore()).toEqual({ requests: [], lines: [], submissions: [], csvBySubmission: {}, nextRequestId: 1, nextSubmissionId: 1 });
    expect(JSON.parse(JSON.stringify(store))).toEqual(store);
  });
});

describe('MockDataService on the sample data, as the preview uses it', () => {
  it('shows each person only their own requests, newest change first', async () => {
    const store = createSampleStore();
    expect((await asJane(store).listMyRequests()).map((r) => r.requestNumber)).toEqual(['PR-0041', 'PR-0036', 'PR-0039', 'PR-0040', 'PR-0038', 'PR-0037']);
    expect((await asSam(store).listMyRequests()).map((r) => r.requestNumber)).toEqual(['PR-0034', 'PR-0035', 'PR-0032', 'PR-0033']);
    await expect(asJane(store).getRequest(35)).rejects.toBeInstanceOf(NotAllowedError);
    await expect(asSam(store).getRequest(41)).rejects.toBeInstanceOf(MockNotAllowedError);
    expect((await asMax(store).listAllRequests()).map((r) => r.requestNumber)).toHaveLength(10);
  });

  it('shows the administrator what needs doing: requests to approve, and failed emails and packages', async () => {
    const store = createSampleStore();
    const max = asMax(store);
    expect(
      (await max.listAllRequests())
        .filter((r) => r.status === 'Awaiting approval')
        .map((r) => r.requestNumber)
        .sort()
    ).toEqual(['PR-0032', 'PR-0040']);
    expect(
      (await max.listAllRequests())
        .filter((r) => r.status === 'Submitted')
        .map((r) => r.requestNumber)
        .sort()
    ).toEqual(['PR-0035', 'PR-0037', 'PR-0039']);
    const failed = (await max.listSubmissions()).filter((s) => s.packageStatus === 'Failed');
    expect(failed.map((s) => [s.requestNumber, s.type])).toEqual([
      ['PR-0032', 'approval'],
      ['PR-0035', 'package']
    ]);
  });

  it('works end to end across switches between people: send, approve, buy, mark purchased and process (P-037, P-040)', async () => {
    let store = createSampleStore();
    // Jane sends the draft and certifies it now: the approver buys it, so she will not submit anything.
    const sent = await asJane(store, EARLY).sendForApproval(41, CERTIFICATION);
    expect(sent).toMatchObject({
      id: 12,
      type: 'approval',
      submissionNumber: 1,
      packageStatus: 'Ready',
      requestNumber: 'PR-0041',
      certificationText: CERTIFICATION
    });
    expect(store.requests.find((r) => r.id === 41)).toMatchObject({ status: 'Awaiting approval', approvalRounds: 1, boughtBeforeApproval: false });
    expect(store.requests.find((r) => r.id === 41)!.approval.rows?.map((r) => [r.rowNumber, r.vendor, r.amountCents])).toEqual([
      [1, 'Acme Lab Supply', 64000],
      [2, 'Northwind Office Supply', 8645]
    ]);

    // The preview reloads for Max with the saved store; the email the flow would have sent is marked as sent.
    store = reload(store);
    expect(store.submissions.find((s) => s.id === 12)!.packageStatus).toBe('Packaged');
    const max = asMax(store);
    const waiting = (await max.listAllRequests()).filter((r) => r.status === 'Awaiting approval').map((r) => r.requestNumber);
    expect(waiting).toContain('PR-0041');
    const lines = (await max.getRequest(41)).lines;
    const approved = await max.approveRequest(41, {
      note: 'OK, I will order it.',
      categories: { [lines[1].id]: { category: 'rdMaterials', categoryOther: '' } }
    });
    expect(approved).toMatchObject({ status: 'Approved', approvedBy: 'Max Wamsley', approvedOn: '2026-10-17 10:05' });
    // Every vendor total is approved, however small, because the approver buys it.
    expect(approved.approval.approved).toEqual([
      { key: 'acmelabsupply', vendor: 'Acme Lab Supply', cents: 64000, bought: false },
      { key: 'northwindofficesupply', vendor: 'Northwind Office Supply', cents: 8645, bought: false }
    ]);

    // Back to Jane, who sees it is approved but can no longer change it: it is the approver's now.
    store = reload(store);
    const jane = asJane(store, new Date(2026, 9, 18, 8, 0));
    const seen = await jane.getRequest(41);
    expect(seen.request.status).toBe('Approved');
    expect(seen.lines.map((l) => [l.category, l.categoryConfirmedBy])).toEqual([
      ['rdMaterials', 'Max Wamsley'],
      ['rdMaterials', 'Max Wamsley']
    ]);
    await expect(jane.updateLine(seen.lines[0].id, { vendor: 'Changed' })).rejects.toMatchObject({ message: notAllowed.locked });
    await expect(jane.addFileToLine(seen.lines[0].id, pdf('a.pdf'), 'receipt')).rejects.toMatchObject({ message: notAllowed.locked });

    // Max buys it. He paid a little more than Jane asked, attaches the receipts, adds a row for the shipping, and marks it purchased.
    const buyer = asMax(store, new Date(2026, 9, 18, 9, 0));
    const rows = (await buyer.getRequest(41)).lines;
    await buyer.updateLine(rows[0].id, { amountCents: 66050 });
    await buyer.addFileToLine(rows[0].id, pdf('acme-lab-supply-invoice.pdf'), 'receipt');
    await buyer.addFileToLine(rows[1].id, png('northwind-office-receipt.png', 'a different receipt'), 'receipt');
    const shipping = await buyer.addEmptyLine(41);
    expect(shipping).toMatchObject({ rowNumber: 3, paidBy: 'company', date: '2026-10-18' });
    await buyer.updateLine(shipping.id, { vendor: 'Acme Lab Supply', description: 'Shipping', category: 'shipping', amountCents: 1200, sameReceiptAsRow: 1 });
    // A category the approver chooses is confirmed by the approver, not left as the employee's suggestion.
    expect((await buyer.getRequest(41)).lines[2]).toMatchObject({ category: 'shipping', categoryConfirmedBy: 'Max Wamsley' });
    const submission = await buyer.markPurchased(41);
    expect(submission).toMatchObject({
      id: 13,
      type: 'package',
      submissionNumber: 1,
      approvedBy: 'Max Wamsley',
      submitterName: 'Max Wamsley',
      certificationText: CERTIFICATION,
      receiptCount: 2,
      quoteCount: 1
    });
    expect([...submission.packageFileNames].sort()).toEqual([
      'PR-0041_Purchases.csv',
      'Q01_acme-lab-supply-quote.pdf',
      'R01_acme-lab-supply-invoice.pdf',
      'R02_northwind-office-receipt.png'
    ]);
    // What Jane sent is kept as it was; what was bought is on the rows.
    expect(store.requests.find((r) => r.id === 41)).toMatchObject({
      status: 'Submitted',
      submissionCount: 1,
      totalReimburseCents: 0,
      totalCompanyCents: 66050 + 8645 + 1200
    });
    expect(store.requests.find((r) => r.id === 41)!.approval.rows?.map((r) => r.amountCents)).toEqual([64000, 8645]);
    expect(store.approverLineIds).toContain(shipping.id);

    // And Max processes it.
    store = reload(store);
    expect(store.submissions.find((s) => s.id === 13)).toMatchObject({
      packageStatus: 'Packaged',
      folderLink: packagedFolderLink('2026-10-14_Jane-Doe_Lab-supplies-for-the-Phase-1-assay_PR-0041')
    });
    expect((await asMax(store).markProcessed(41)).status).toBe('Processed');
    expect((await asJane(store).getRequest(41)).request).toMatchObject({ status: 'Processed', processedBy: 'Max Wamsley' });
  });

  it('lets Max buy the approved sensor kit once he attaches the invoice, and nobody else', async () => {
    const store = createSampleStore();
    const max = asMax(store, new Date(2026, 9, 18, 8, 0));
    const { lines } = await max.getRequest(38);
    await expect(asJane(store).markPurchased(38)).rejects.toBeInstanceOf(NotAllowedError);
    await expect(max.markPurchased(38)).rejects.toMatchObject({ issues: [expect.objectContaining({ field: 'receipt' })] });
    await max.addFileToLine(lines[0].id, pdf('kestrel-instruments-invoice.pdf'), 'receipt');
    const submission = await max.markPurchased(38);
    expect([...submission.packageFileNames].sort()).toEqual([
      'PR-0038_Purchases.csv',
      'Q01_kestrel-instruments-quote.pdf',
      'R01_kestrel-instruments-invoice.pdf'
    ]);
    expect(submission).toMatchObject({ approvedBy: 'Max Wamsley', approvedOn: '2026-09-25 10:05', boughtBeforeApproval: false, submitterName: 'Max Wamsley' });
    expect(store.csvBySubmission[submission.id]).toContain('Jane Doe (jane.doe@example.com)');
  });

  it('lets Jane send the draft for approval as it stands, and shows what the approver will be asked', async () => {
    const store = createSampleStore();
    await expect(asJane(store).sendForApproval(41)).rejects.toThrow(messages.certificationRequiredToSend);
    const submission = await asJane(store).sendForApproval(41, CERTIFICATION);
    expect(submission.emailSummary).toContain('- Acme Lab Supply: $640.00 (quote attached)');
    expect(submission.emailSummary).toContain('- Northwind Office Supply: $86.45\n');
    expect(submission.emailSummary).toContain('Requested by: Jane Doe (jane.doe@example.com)');
    expect(submission.emailSummary).toContain('The approver buys this request.');
    expect(submission.emailSummary).toContain('Project or grant code: NSF SBIR Phase 1 (Award # 2528301)');
  });

  it('has Max approve the waiting request, change a category, and return another with a note', async () => {
    const store = createSampleStore();
    const max = asMax(store);
    const lines = (await max.getRequest(40)).lines;
    const approved = await max.approveRequest(40, { note: 'Fine.', categories: { [lines[1].id]: { category: 'other', categoryOther: 'Domain names' } } });
    expect(approved.approval.approved).toEqual([
      { key: 'harborsoftware', vendor: 'Harbor Software', cents: 87000, bought: false },
      { key: 'bluefernwebco', vendor: 'Blue Fern Web Co.', cents: 12900, bought: false }
    ]);
    expect((await max.getRequest(40)).lines.map((l) => [l.category, l.categoryOther, l.categoryConfirmedBy])).toEqual([
      ['computer', '', 'Max Wamsley'],
      ['other', 'Domain names', 'Max Wamsley']
    ]);
    const returned = await max.returnRequest(32, 'Please get a second quote.');
    expect(returned).toMatchObject({ status: 'Returned', returnStage: 'approval', returnNote: 'Please get a second quote.' });
    const sam = asSam(store);
    expect((await sam.getRequest(32)).request).toMatchObject({ status: 'Returned', returnNote: 'Please get a second quote.' });
  });

  it('lets the administrator retry the failed approval email and the failed package', async () => {
    const store = createSampleStore();
    const max = asMax(store);
    expect(await max.retryPackaging(6)).toMatchObject({ type: 'approval', packageStatus: 'Ready', errorMessage: '' });
    expect(await max.retryPackaging(9)).toMatchObject({ type: 'package', packageStatus: 'Ready', errorMessage: '' });
    await tick();
    expect(store.submissions.filter((s) => s.packageStatus === 'Failed')).toEqual([]);
    expect(store.submissions.find((s) => s.id === 9)!.folderLink).toContain('_PR-0035');
    expect(store.submissions.find((s) => s.id === 6)!.folderLink).toBe('');
  });

  it('lets Sam resubmit the returned training course as it stands, as R2', async () => {
    const store = createSampleStore();
    const second = await asSam(store).submitRequest(34, CERTIFICATION);
    expect(second).toMatchObject({ submissionNumber: 2, previousFolderName: '2026-10-02_Sam-Lee_Training-course_PR-0034' });
    expect(second.folderName).toBe('2026-10-02_Sam-Lee_Training-course_PR-0034_R2');
    expect(second.packageFileNames).toContain('PR-0034_R2_Purchases.csv');
    expect(store.requests.find((r) => r.id === 34)).toMatchObject({ status: 'Submitted', submissionCount: 2, returnNote: '', returnStage: '' });
  });

  it("holds Sam's workbench request at the quote rule until he gives a reason, then sends it again", async () => {
    const store = createSampleStore();
    const sam = asSam(store);
    await expect(sam.sendForApproval(33, CERTIFICATION)).rejects.toMatchObject({ issues: [expect.objectContaining({ field: 'quote' })] });
    const { lines } = await sam.getRequest(33);
    await sam.updateLine(lines[1].id, { noQuoteReason: 'Only one supplier makes it' });
    const again = await sam.sendForApproval(33, CERTIFICATION);
    expect(again).toMatchObject({ type: 'approval', submissionNumber: 2 });
    expect(store.requests.find((r) => r.id === 33)).toMatchObject({ status: 'Awaiting approval', approvalRounds: 2, returnNote: '', returnStage: '' });
  });

  it('lets the administrator mark the submitted website request processed, and confirm a category after submission', async () => {
    const store = createSampleStore();
    const max = asMax(store);
    const lines = await max.confirmCategories(37, { [(await max.getRequest(37)).lines[0].id]: { category: 'computer', categoryOther: '' } });
    expect(lines[0]).toMatchObject({ category: 'computer', categoryConfirmedBy: 'Max Wamsley' });
    // The CSV already in the folder keeps the category as submitted (P-024).
    expect(store.csvBySubmission[3]).toContain('Advertising/Marketing/Website');
    expect((await max.markProcessed(37)).status).toBe('Processed');
  });

  it('refuses the administrator actions to employees, with the same error type the SharePoint service throws', async () => {
    const store = createSampleStore();
    await expect(asJane(store).markProcessed(37)).rejects.toBeInstanceOf(NotAllowedError);
    await expect(asSam(store).listAllRequests()).rejects.toMatchObject({ message: 'Administrators only.' });
    expect(MockNotAllowedError).toBe(NotAllowedError);
  });
});

describe('saving after every change (onChange)', () => {
  it('calls onChange after each change and not after reads', async () => {
    const store = createSampleStore();
    let calls = 0;
    const onChange = () => calls++;
    const jane = new MockDataService(store, SAMPLE_USERS.jane, 0, onChange, () => EARLY);
    const max = new MockDataService(store, SAMPLE_USERS.admin, 0, onChange, () => LATER);
    const changed = async (name: string, change: () => Promise<unknown>) => {
      await tick();
      const before = calls;
      await change();
      expect([name, calls > before]).toEqual([name, true]);
    };

    // A scratch request for the row and file changes, so the sample requests stay as they are for the approval steps.
    let scratch = 0;
    await changed('createRequest', async () => {
      scratch = (await jane.createRequest()).id;
    });
    await changed('updateRequest', () => jane.updateRequest(scratch, { businessPurpose: 'Scratch', department: 'R&D' }));
    let rowId = '';
    await changed('addEmptyLine', async () => {
      rowId = (await jane.addEmptyLine(scratch)).id;
    });
    await changed('updateLine', () => jane.updateLine(rowId, { description: 'Changed' }));
    await changed('addFileToLine', () => jane.addFileToLine(rowId, pdf('b.pdf'), 'quote'));
    const fileId = (await jane.getRequest(scratch)).lines[0].files[0].id;
    await changed('removeFileFromLine', () => jane.removeFileFromLine(rowId, fileId));
    await changed('addLinesFromFiles', () => jane.addLinesFromFiles(scratch, [pdf('a.pdf')], 'receipt'));
    await changed('deleteLine', () => jane.deleteLine(rowId));
    await changed('deleteRequest', () => jane.deleteRequest(scratch));
    await changed('sendForApproval', () => jane.sendForApproval(41, CERTIFICATION));
    await changed('approveRequest', () => max.approveRequest(41, { note: '', categories: {} }));
    for (const l of (await max.getRequest(41)).lines) await max.addFileToLine(l.id, pdf(`receipt-row${l.rowNumber}.pdf`), 'receipt');
    await changed('markPurchased', () => max.markPurchased(41));
    await changed('confirmCategories', () => max.confirmCategories(41, {}));
    await changed('returnRequest', () => max.returnRequest(40, 'No'));
    await changed('markProcessed', () => max.markProcessed(37));
    await changed('retryPackaging', () => max.retryPackaging(9));

    // Reads change nothing, once the simulated flow has finished.
    await tick(30);
    const settled = calls;
    await jane.listMyRequests();
    await jane.getRequest(41);
    await jane.listSubmissionsForRequest(41);
    await jane.getSubmissionCsv(3);
    await jane.getOwnerOtherLines(41);
    await jane.listApprovers();
    await max.listAllRequests();
    await max.listSubmissions();
    await max.listAllLineRefs();
    await max.getFlowSettings('test', 'https://contoso.sharepoint.com/sites/FormsAndApps/SitePages/Purchase-Requests.aspx');
    await max.getSetupStatus();
    expect(calls).toBe(settled);
  });

  it('calls onChange in the order the real site works: submission Uploading, request locked, then Ready (P-018)', async () => {
    const store = createSampleStore();
    const seen: string[] = [];
    const max = new MockDataService(
      store,
      SAMPLE_USERS.admin,
      0,
      () => seen.push(`${store.submissions.find((x) => x.id === 12)?.packageStatus ?? 'none'}/${store.requests.find((r) => r.id === 38)!.status}`),
      () => NOW
    );
    const { lines } = await max.getRequest(38);
    await max.addFileToLine(lines[0].id, pdf('kestrel-instruments-invoice.pdf'), 'receipt');
    seen.length = 0;
    const submission = await max.markPurchased(38);
    expect(submission.id).toBe(12);
    expect(seen.slice(0, 3)).toEqual(['Uploading/Approved', 'Uploading/Submitted', 'Ready/Submitted']);
    // The CSV is kept with the submission from the first step, as the files are attached before the request is locked.
    expect(store.csvBySubmission[12]).toContain('PR-0038');
  });

  it('keeps the same order when the employee submits a request they buy', async () => {
    const store = createSampleStore();
    const seen: string[] = [];
    const sam = new MockDataService(
      store,
      SAMPLE_USERS.sam,
      0,
      () => seen.push(`${store.submissions.find((x) => x.id === 12)?.packageStatus ?? 'none'}/${store.requests.find((r) => r.id === 34)!.status}`),
      () => NOW
    );
    const submission = await sam.submitRequest(34, CERTIFICATION);
    expect(submission.id).toBe(12);
    expect(seen.slice(0, 3)).toEqual(['Uploading/Returned', 'Uploading/Submitted', 'Ready/Submitted']);
  });

  it('does the same for an approval request, with no files', async () => {
    const store = createSampleStore();
    const seen: string[] = [];
    const jane = new MockDataService(
      store,
      SAMPLE_USERS.jane,
      0,
      () => seen.push(`${store.submissions.find((x) => x.id === 12)?.packageStatus ?? 'none'}/${store.requests.find((r) => r.id === 41)!.status}`),
      () => NOW
    );
    await jane.sendForApproval(41, CERTIFICATION);
    expect(seen.slice(0, 3)).toEqual(['Uploading/Draft', 'Uploading/Awaiting approval', 'Ready/Awaiting approval']);
    expect(store.csvBySubmission[12]).toBeUndefined();
    expect(store.submissions.find((s) => s.id === 12)!.packageFileNames).toEqual([]);
  });
});

describe('retrying a stuck submission', () => {
  it('starts the 30 minutes again, so a second Retry is not offered at once', async () => {
    const store = createSampleStore();
    const stuck = store.submissions.find((s) => s.id === 9)!; // PR-0035's package, failed
    const at = (h: number, m: number) => new MockDataService(store, SAMPLE_USERS.admin, 0, undefined, () => new Date(2026, 9, 12, h, m));
    expect(stuck.packageStatus).toBe('Failed');
    await at(10, 0).retryPackaging(9);
    expect(stuck.lastChanged).toBe('2026-10-12 10:00');
    await tick(10);
    stuck.packageStatus = 'Ready'; // the flow has not picked it up
    await expect(at(10, 5).retryPackaging(9)).rejects.toThrow('Only an approval email or a package that failed');
    await expect(at(10, 30).retryPackaging(9)).rejects.toThrow('Only an approval email or a package that failed');
    await expect(at(10, 31).retryPackaging(9)).resolves.toMatchObject({ packageStatus: 'Ready' });
  });
});

describe('the simulated flow', () => {
  /** Records each status a submission goes through, and waits until it is Packaged. */
  function watch(store: SampleStore, id: number) {
    const seen: PackageStatus[] = [];
    const onChange = () => {
      const s = store.submissions.find((x) => x.id === id);
      if (s && seen[seen.length - 1] !== s.packageStatus) seen.push(s.packageStatus);
    };
    const untilPackaged = async () => {
      for (let i = 0; i < 200 && seen[seen.length - 1] !== 'Packaged'; i++) await tick(10);
    };
    return { seen, onChange, untilPackaged };
  }

  it('emails the approver and marks an approval request Packaged, without a folder', async () => {
    const store = createSampleStore();
    const { seen, onChange, untilPackaged } = watch(store, 12);
    const jane = new MockDataService(store, SAMPLE_USERS.jane, 10, onChange, () => NOW);
    await jane.sendForApproval(41, CERTIFICATION);
    await untilPackaged();
    expect(seen).toEqual(['Uploading', 'Ready', 'Packaged']);
    expect(store.submissions.find((s) => s.id === 12)).toMatchObject({ packageStatus: 'Packaged', folderLink: '', packagedAt: '2026-10-16 09:30' });
  });

  it('packages a submission: Ready, Processing, then Packaged with the folder it went to', async () => {
    const store = createSampleStore();
    const { seen, onChange, untilPackaged } = watch(store, 12);
    const max = new MockDataService(store, SAMPLE_USERS.admin, 10, onChange, () => NOW);
    const { lines } = await max.getRequest(38);
    await max.addFileToLine(lines[0].id, pdf('kestrel-instruments-invoice.pdf'), 'receipt');
    await max.markPurchased(38);
    await untilPackaged();
    expect(seen).toEqual(['Uploading', 'Ready', 'Processing', 'Packaged']);
    expect(store.submissions.find((s) => s.id === 12)).toMatchObject({
      packagedAt: '2026-10-16 09:30',
      folderLink: 'Accounting > Purchases > Purchases_To_Process > 2026-09-28_Jane-Doe_Sensor-kit-for-the-Phase-1-prototype_PR-0038'
    });
  });

  it('runs again when the administrator retries a failed one', async () => {
    const store = createSampleStore();
    const { seen, onChange, untilPackaged } = watch(store, 9);
    const max = new MockDataService(store, SAMPLE_USERS.admin, 10, onChange, () => LATER);
    seen.push('Failed');
    await max.retryPackaging(9);
    await untilPackaged();
    expect(seen).toEqual(['Failed', 'Ready', 'Processing', 'Packaged']);
    expect(store.submissions.find((s) => s.id === 9)).toMatchObject({ errorMessage: '', packagedAt: '2026-10-17 10:05' });
  });

  it('finishes unfinished work when the preview restores a saved store', () => {
    const store = createSampleStore();
    const mixed: PackageStatus[] = ['Uploading', 'Ready', 'Processing', 'Packaged', 'Failed'];
    const added = mixed.flatMap((status, i) => [
      blankSubmission({ id: 100 + i * 2, type: 'approval', packageStatus: status, requestNumber: 'PR-0041' }),
      blankSubmission({ id: 101 + i * 2, type: 'package', packageStatus: status, requestNumber: 'PR-0041', folderName: `folder-${i}` })
    ]);
    store.submissions.push(...added);
    const restored = JSON.parse(JSON.stringify(store)) as SampleStore;
    finishPendingWork(restored);
    const by = (id: number) => restored.submissions.find((s) => s.id === id)!;
    for (const i of [0, 1, 2]) {
      expect(by(100 + i * 2)).toMatchObject({ packageStatus: 'Packaged', folderLink: '' });
      expect(by(100 + i * 2).packagedAt).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d$/);
      expect(by(101 + i * 2)).toMatchObject({ packageStatus: 'Packaged', folderLink: `Accounting > Purchases > Purchases_To_Process > folder-${i}` });
    }
    // Packaged stays as it was, and a Failed one stays failed, so Needs attention still has something to show.
    expect(by(106)).toMatchObject({ packageStatus: 'Packaged', packagedAt: '', folderLink: '' });
    expect(by(108)).toMatchObject({ packageStatus: 'Failed' });
    expect(by(109)).toMatchObject({ packageStatus: 'Failed', folderLink: '' });
    expect(restored.submissions.filter((s) => s.id < 100).map((s) => s.packageStatus)).toEqual(
      store.submissions.filter((s) => s.id < 100).map((s) => s.packageStatus)
    );
    // Nothing else in the store changes.
    expect({ ...restored, submissions: [] }).toEqual({ ...JSON.parse(JSON.stringify(store)), submissions: [] });
  });

  it('fills in the earlier approvals of a store kept by the preview before they were recorded, so it still works', async () => {
    const old = JSON.parse(JSON.stringify(createSampleStore())) as SampleStore;
    for (const r of old.requests) delete (r.approval as Partial<ApprovalRecord>).earlier;
    finishPendingWork(old);
    expect(old.requests.map((r) => r.approval.earlier)).toEqual(old.requests.map(() => []));
    expect(old.requests.find((r) => r.id === 38)!.approval.approved).toHaveLength(1);
    // Sam's request returned at the approval step can be sent again from it.
    const sam = asSam(old);
    await sam.updateLine((await sam.getRequest(33)).lines[1].id, { noQuoteReason: 'Only one supplier makes it' });
    expect((await sam.sendForApproval(33, CERTIFICATION)).submissionNumber).toBe(2);
  });

  it('reads a store kept by the preview before the approver could buy as requests the employee buys, with no links', async () => {
    const old = JSON.parse(JSON.stringify(createSampleStore())) as SampleStore;
    for (const r of old.requests) delete (r as Partial<typeof r>).buyer;
    for (const l of old.lines) {
      delete (l as Partial<typeof l>).itemLink;
      delete (l as Partial<typeof l>).noLinkReason;
    }
    finishPendingWork(old);
    expect(old.requests.every((r) => r.buyer === 'self')).toBe(true);
    expect(old.lines.every((l) => l.itemLink === '' && l.noLinkReason === '')).toBe(true);
    // The rows as sent, kept for a request the approver buys, survive the restore.
    const kept = reload(createSampleStore());
    expect(kept.requests.find((r) => r.id === 40)!.approval.rows).toHaveLength(2);
  });

  it('finishes unfinished work at the time given', () => {
    const store = createEmptyStore();
    store.submissions.push(blankSubmission({ id: 1, packageStatus: 'Processing', folderName: 'f' }));
    finishPendingWork(store, new Date(2026, 9, 20, 15, 45));
    expect(store.submissions[0]).toMatchObject({ packageStatus: 'Packaged', packagedAt: '2026-10-20 15:45' });
  });
});

describe('set-up and settings in the preview', () => {
  it('shows a site that is already set up, and the new site the preview offers', async () => {
    const store = createSampleStore();
    const max = asMax(store);
    expect(max.setupStatus.ready).toBe(true);
    expect((await max.getSetupStatus()).lists.every((l) => l.exists && l.listId && l.ownItemsOnly && l.versioning && l.attachments)).toBe(true);
    max.setupStatus = notSetUp();
    const fresh = await max.getSetupStatus();
    expect(fresh.ready).toBe(false);
    expect(fresh.lists.every((l) => !l.exists && !l.notOurs && l.listId === '' && !l.ownItemsOnly)).toBe(true);
  });

  it('has the list keys, titles and addresses the SharePoint service creates', () => {
    const expected = Object.values(LISTS).map((l) => [l.key, l.title, `Lists/${l.urlName}`]);
    for (const status of [readySetup(), notSetUp()]) expect(status.lists.map((l) => [l.key, l.title, l.address])).toEqual(expected);
    expect(readySetup().lists.map((l) => l.key)).toEqual(['requests', 'lines', 'submissions']);
    expect(readySetup().lists.map((l) => l.title)).toEqual(['Purchase Requests', 'Purchase Request Lines', 'Purchase Submissions']);
    expect(new Set(readySetup().lists.map((l) => l.listId)).size).toBe(3);
  });

  it('creates the lists, reporting each step, for an administrator only', async () => {
    const store = createSampleStore();
    const max = new MockDataService(store, SAMPLE_USERS.admin, 0);
    max.setupStatus = notSetUp();
    const steps: string[] = [];
    const status = await max.runSetup((s) => steps.push(s));
    expect(steps).toEqual(['Creating the Purchase Requests list', 'Creating the Purchase Request Lines list', 'Creating the Purchase Submissions list']);
    expect(status.ready).toBe(true);
    expect((await max.getSetupStatus()).ready).toBe(true);
    const jane = new MockDataService(store, SAMPLE_USERS.jane, 0);
    await expect(jane.runSetup(() => undefined)).rejects.toBeInstanceOf(NotAllowedError);
  });

  it('gives the flow settings of the sample site, for an administrator only', async () => {
    const store = createSampleStore();
    const page = 'https://contoso.sharepoint.com/sites/FormsAndApps/SitePages/Purchase-Requests.aspx';
    const test = await asMax(store).getFlowSettings('test', page);
    expect(test).toEqual({
      mode: 'test',
      siteUrl: 'https://contoso.sharepoint.com/sites/FormsAndApps',
      submissionsListId: readySetup().lists[2].listId,
      destinationSiteUrl: 'https://contoso.sharepoint.com/sites/FormsAndApps',
      libraryUrlName: 'Shared Documents',
      folders: ['Purchases_Test', 'Purchases_Test/Purchases_To_Process'],
      adminEmail: 'max.wamsley@example.com',
      approverEmails: ['max.wamsley@example.com'],
      approverSource: 'owners',
      appPageUrl: page
    });
    // The preview runs on a local http address, which a flow package refuses: the mock gives a made-up SharePoint page instead.
    const preview = await asMax(store).getFlowSettings('test', 'http://127.0.0.1:5173/');
    expect(preview.appPageUrl).toBe('https://contoso.sharepoint.com/sites/FormsAndApps/SitePages/Purchase-Requests.aspx');
    expect(() => checkFlowConfig(preview)).not.toThrow();
    expect(() => checkFlowConfig(test)).not.toThrow();
    const live = await asMax(store).getFlowSettings('live', page);
    expect(() => checkFlowConfig(live)).not.toThrow();
    expect(live).toMatchObject({
      mode: 'live',
      siteUrl: 'https://contoso.sharepoint.com/sites/FormsAndApps',
      destinationSiteUrl: 'https://claruslabsusa.sharepoint.com/sites/ExecutiveTeam',
      folders: ['01_Company Documents/Accounting/Purchases', '01_Company Documents/Accounting/Purchases/Purchases_To_Process'],
      approverEmails: ['max.wamsley@example.com']
    });
    await expect(asJane(store).getFlowSettings('test', page)).rejects.toBeInstanceOf(NotAllowedError);
  });

  it('names the approvers', async () => {
    expect(await asJane(createSampleStore()).listApprovers()).toEqual(['Max Wamsley']);
    expect(await asMax(createSampleStore()).listApprovers()).toEqual(['Max Wamsley']);
  });
});

describe("the mock's own details", () => {
  it('gives the screens copies, so changing one does not change the store', async () => {
    const store = createSampleStore();
    const jane = asJane(store);
    const got = await jane.getRequest(41);
    got.request.businessPurpose = 'Changed in the screen';
    got.lines[0].vendor = 'Changed in the screen';
    got.lines[0].files.pop();
    const again = await jane.getRequest(41);
    expect(again.request.businessPurpose).toBe('Lab supplies for the Phase 1 assay');
    expect(again.lines[0].vendor).toBe('Acme Lab Supply');
    expect(again.lines[0].files).toHaveLength(1);
    const list = await jane.listMyRequests();
    list[0].department = 'Changed';
    expect((await jane.listMyRequests())[0].department).toBe('R&D');
  });

  it('gives a file the address the screens can show it from, a new one each time, as the SharePoint service does', async () => {
    const store = createSampleStore();
    const jane = asJane(store);
    const { lines } = await jane.getRequest(41);
    expect(await jane.filePreviewUrl(lines[0].id, lines[0].files[0])).toBe('/receipts/acme-lab-supply-quote.pdf');
    const added = await jane.addFileToLine(lines[1].id, pdf('new.pdf', 'the new file'), 'quote');
    expect(added.files[0].url).toBeUndefined();
    const first = await jane.filePreviewUrl(lines[1].id, added.files[0]);
    expect(first.startsWith('blob:')).toBe(true);
    // The screen releases the address when the file is closed; opening the file again gets a new one that works.
    URL.revokeObjectURL(first);
    const second = await jane.filePreviewUrl(lines[1].id, added.files[0]);
    expect(second.startsWith('blob:')).toBe(true);
    expect(second).not.toBe(first);
    URL.revokeObjectURL(second);
    // A file attached before the page was loaded again (the store kept, the file not) cannot be shown.
    const reloaded = reload(store);
    const kept = reloaded.lines.find((l) => l.id === lines[1].id)!.files[0];
    expect(await asJane(reloaded).filePreviewUrl(lines[1].id, { ...kept, id: 'upload-from-an-earlier-page' })).toBe('');
    expect(await jane.filePreviewUrl(lines[1].id, { ...kept, id: 'gone', url: 'blob:http://localhost/old' })).toBe('');
  });

  it('never makes the same ID twice, even for services made at the same moment on one store', async () => {
    const store = createSampleStore();
    const a = asJane(store);
    const b = asJane(store);
    const [one, two] = await Promise.all([a.addEmptyLine(41), b.addEmptyLine(41)]);
    expect(one.id).not.toBe(two.id);
    expect(one.rowNumber).not.toBe(two.rowNumber);
    await Promise.all([a.addLinesFromFiles(41, [pdf('a.pdf'), pdf('b.pdf')], 'receipt'), b.addLinesFromFiles(41, [pdf('c.pdf'), pdf('d.pdf')], 'receipt')]);
    const lineIds = store.lines.map((l) => l.id);
    const fileIds = store.lines.flatMap((l) => l.files.map((f) => f.id));
    expect(new Set(lineIds).size).toBe(lineIds.length);
    expect(new Set(fileIds).size).toBe(fileIds.length);
    const rows = store.lines.filter((l) => l.requestId === 41).map((l) => l.rowNumber);
    expect(rows.sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('keeps one clock for what it writes, so a test can fix the time', async () => {
    const store = createSampleStore();
    const jane = asJane(store, new Date(2026, 9, 25, 16, 20));
    await jane.updateRequest(41, { department: 'R&D Lab' });
    expect(store.requests.find((r) => r.id === 41)!.lastChanged).toBe('2026-10-25 16:20');
  });

  it('answers a missing request or submission as not allowed, as the SharePoint service does', async () => {
    const store = createSampleStore();
    const calls = [
      () => asJane(store).getRequest(999),
      () => asMax(store).getRequest(999),
      () => asMax(store).retryPackaging(999),
      () => asMax(store).getSubmissionCsv(999)
    ];
    for (const call of calls) await expect(call()).rejects.toBeInstanceOf(NotAllowedError);
    await expect(asJane(store).updateLine('no-such-line', { vendor: 'x' })).rejects.toBeInstanceOf(NotAllowedError);
  });

  it('is the signed-in person, and copies them', async () => {
    const jane = asJane(createSampleStore());
    const me = await jane.getCurrentUser();
    expect(me).toEqual(SAMPLE_USERS.jane);
    me.displayName = 'Changed';
    expect((await jane.getCurrentUser()).displayName).toBe('Jane Doe');
    expect(JANE.email).toBe(SAMPLE_USERS.jane.email);
  });

  it("returns a package's CSV without a byte-order mark, and nothing for an approval request", async () => {
    const store = createSampleStore();
    expect(store.csvBySubmission[3].startsWith('\uFEFF')).toBe(true);
    const csv = await asJane(store).getSubmissionCsv(3);
    expect(csv.startsWith('Request,Row,Date')).toBe(true);
    expect(await asJane(store).getSubmissionCsv(1)).toBe('');
    await expect(asSam(store).getSubmissionCsv(3)).rejects.toBeInstanceOf(NotAllowedError);
  });
});
