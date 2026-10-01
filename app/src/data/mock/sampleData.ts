// Synthetic sample data for the preview and tests. People, vendors and
// receipts are made up (see test/fixtures/receipts). No real data. The sample
// is one time in the life of the app: requests at every stage, including the
// ones that need attention (a failed package, a failed approval email, a
// duplicate receipt between two people).

import { dateRange, dateRangeText, toLocalDateTime } from '../../domain/dates';
import { csvFileName, folderName, packageFiles } from '../../domain/naming';
import { CERTIFICATION, PROJECT_QUICK_PICKS, anyBoughtBefore, groupsForApproval, groupsForApproved } from '../../domain/purchaseRules';
import { hasReceipt } from '../../domain/receipts';
import { computeTotals } from '../../domain/totals';
import {
  ApprovalGroup,
  AttachedFile,
  CurrentUser,
  FileKind,
  PackageStatus,
  PurchaseLine,
  PurchaseRequest,
  Submission,
  SubmissionType
} from '../../domain/types';
import { validateRequest } from '../../domain/validation';
import { buildPurchasesCsv } from '../../export/csv';
import { approvalEmailSubject, buildApprovalEmailSummary, buildSubmissionEmailSummary, submissionEmailSubject } from '../../export/email';

export const SAMPLE_USERS: Record<'jane' | 'sam' | 'admin', CurrentUser> = {
  jane: { displayName: 'Jane Doe', email: 'jane.doe@example.com', isAdministrator: false },
  sam: { displayName: 'Sam Lee', email: 'sam.lee@example.com', isAdministrator: false },
  admin: { displayName: 'Max Wamsley', email: 'max.wamsley@example.com', isAdministrator: true }
};

/** Where the flow says a package went, for the preview (P-008). */
export function packagedFolderLink(folderNameText: string): string {
  return `Accounting > Purchases > Purchases_To_Process > ${folderNameText}`;
}

function file(id: string, fileName: string, sizeBytes: number, fingerprint: string, kind: FileKind): AttachedFile {
  const contentType = fileName.endsWith('.pdf') ? 'application/pdf' : 'image/png';
  return { id, fileName, sizeBytes, fingerprint, contentType, kind, url: `/receipts/${fileName}` };
}

// Every file has its own ID and fingerprint, except the Northwind receipt, which
// Jane and Sam both attached (a possible duplicate for the administrator).
const FILES = {
  acmeQuote: () => file('f-acme-quote', 'acme-lab-supply-quote.pdf', 31204, 'sample-acme-quote', 'quote'),
  harborQuote: () => file('f-harbor-quote', 'harbor-software-quote.pdf', 30871, 'sample-harbor-quote', 'quote'),
  kestrelQuote: () => file('f-kestrel-quote', 'kestrel-instruments-quote.pdf', 32560, 'sample-kestrel-quote', 'quote'),
  blueFernInvoice: () => file('f-bluefern-invoice', 'blue-fern-web-invoice.pdf', 29940, 'sample-bluefern-invoice', 'receipt'),
  northwindReceipt: (id: string) => file(id, 'northwind-office-receipt.png', 40812, 'sample-northwind-receipt', 'receipt'),
  quickshipReceipt: () => file('f-quickship-receipt', 'quickship-postage-receipt.png', 38420, 'sample-quickship-receipt', 'receipt'),
  summitReceipt: () => file('f-summit-receipt', 'summit-training-receipt.pdf', 33715, 'sample-summit-receipt', 'receipt')
};

function request(r: Partial<PurchaseRequest> & Pick<PurchaseRequest, 'id' | 'businessPurpose' | 'ownerName' | 'ownerEmail'>): PurchaseRequest {
  return {
    requestNumber: `PR-${String(r.id).padStart(4, '0')}`,
    department: '',
    projectCode: '',
    status: 'Draft',
    returnNote: '',
    returnStage: '',
    submissionCount: 0,
    approvalRounds: 0,
    totalReimburseCents: 0,
    totalCompanyCents: 0,
    totalRequestCents: 0,
    sentForApprovalOn: '',
    boughtBeforeApproval: false,
    approval: { sent: [], approved: [] },
    approvalNote: '',
    approvedOn: '',
    approvedBy: '',
    approvedByEmail: '',
    submittedOn: '',
    processedOn: '',
    processedBy: '',
    lastChanged: '2026-09-20 10:00',
    ...r
  };
}

let lineCounter = 0;
function row(requestId: number, rowNumber: number, l: Partial<PurchaseLine>): PurchaseLine {
  lineCounter += 1;
  return {
    id: `sample-${lineCounter}`,
    requestId,
    rowNumber,
    date: '',
    vendor: '',
    description: '',
    category: '',
    categoryOther: '',
    categoryConfirmedBy: '',
    amountCents: null,
    paidBy: '',
    noQuoteReason: '',
    noReceiptReason: '',
    sameReceiptAsRow: null,
    files: [],
    suggested: [],
    ...l
  };
}

export interface SampleStore {
  requests: PurchaseRequest[];
  lines: PurchaseLine[];
  submissions: Submission[];
  csvBySubmission: Record<number, string>;
  nextRequestId: number;
  nextSubmissionId: number;
}

/** A store with nothing in it, for tests that start from a new site. */
export function createEmptyStore(): SampleStore {
  return { requests: [], lines: [], submissions: [], csvBySubmission: {}, nextRequestId: 1, nextSubmissionId: 1 };
}

/** The vendor totals as they were when the request was sent for approval (P-017), worked out by the real rule. */
function sentGroups(lines: readonly PurchaseLine[], sentOn: string): ApprovalGroup[] {
  return groupsForApproval(
    lines.map((l) => ({ id: l.id, vendor: l.vendor, amountCents: l.amountCents, date: l.date, hasReceipt: hasReceipt(l, lines) })),
    sentOn.slice(0, 10)
  );
}

interface SubmissionSpec {
  id: number;
  requestId: number;
  type: SubmissionType;
  number: number;
  status: PackageStatus;
  /** When the app created it: "YYYY-MM-DD HH:MM". */
  on: string;
  /** When the flow finished with it, for one that is Packaged. */
  packagedAt?: string;
  errorMessage?: string;
}

const SAMPLE_SUBMISSIONS: SubmissionSpec[] = [
  { id: 1, requestId: 37, type: 'approval', number: 1, status: 'Packaged', on: '2026-09-21 11:05', packagedAt: '2026-09-21 11:09' },
  { id: 2, requestId: 38, type: 'approval', number: 1, status: 'Packaged', on: '2026-09-24 15:40', packagedAt: '2026-09-24 15:44' },
  { id: 3, requestId: 37, type: 'package', number: 1, status: 'Packaged', on: '2026-09-24 08:50', packagedAt: '2026-09-24 08:54' },
  { id: 4, requestId: 40, type: 'approval', number: 1, status: 'Packaged', on: '2026-09-29 09:12', packagedAt: '2026-09-29 09:16' },
  { id: 5, requestId: 33, type: 'approval', number: 1, status: 'Packaged', on: '2026-10-01 10:20', packagedAt: '2026-10-01 10:24' },
  {
    id: 6,
    requestId: 32,
    type: 'approval',
    number: 1,
    status: 'Failed',
    on: '2026-10-02 16:45',
    errorMessage: 'The SharePoint connection in the flow needs to be signed in again.'
  },
  { id: 7, requestId: 34, type: 'package', number: 1, status: 'Packaged', on: '2026-10-05 10:15', packagedAt: '2026-10-05 10:19' },
  { id: 8, requestId: 36, type: 'package', number: 1, status: 'Packaged', on: '2026-10-08 08:30', packagedAt: '2026-10-08 08:34' },
  {
    id: 9,
    requestId: 35,
    type: 'package',
    number: 1,
    status: 'Failed',
    on: '2026-10-08 09:05',
    errorMessage: 'The SharePoint connection in the flow needs to be signed in again.'
  }
];

export function createSampleStore(): SampleStore {
  lineCounter = 0;
  const jane = SAMPLE_USERS.jane;
  const sam = SAMPLE_USERS.sam;
  const grant = PROJECT_QUICK_PICKS[0];

  const lines: PurchaseLine[] = [
    // PR-0041: Jane's draft. A vendor total of $640.00 needs approval, which has not been asked for yet.
    row(41, 1, {
      date: '2026-10-14',
      vendor: 'Acme Lab Supply',
      description: 'Pipette tips and centrifuge tubes for the assay',
      category: 'rdMaterials',
      amountCents: 64000,
      paidBy: 'company',
      files: [FILES.acmeQuote()]
    }),
    row(41, 2, {
      date: '2026-10-14',
      vendor: 'Northwind Office Supply',
      description: 'Lab notebooks and labels',
      category: 'office',
      amountCents: 8645,
      paidBy: 'employee'
    }),

    // PR-0040: sent for approval, waiting for the approver. The Blue Fern total is under the threshold.
    row(40, 1, {
      date: '2026-10-05',
      vendor: 'Harbor Software',
      description: 'Annual licence for the analysis software',
      category: 'computer',
      amountCents: 87000,
      paidBy: 'company',
      files: [FILES.harborQuote()]
    }),
    row(40, 2, {
      date: '2026-10-05',
      vendor: 'Blue Fern Web Co.',
      description: 'Domain renewal for the company website',
      category: 'advertising',
      amountCents: 12900,
      paidBy: 'company'
    }),

    // PR-0038: approved. The quote is attached; the receipt is still to come.
    row(38, 1, {
      date: '2026-09-28',
      vendor: 'Kestrel Instruments',
      description: 'Benchtop sensor kit',
      category: 'rdMaterials',
      categoryConfirmedBy: 'Max Wamsley',
      amountCents: 115000,
      paidBy: 'company',
      files: [FILES.kestrelQuote()]
    }),

    // PR-0037: bought before approval, approved, then submitted. One receipt covers both rows.
    row(37, 1, {
      date: '2026-09-15',
      vendor: 'Blue Fern Web Co.',
      description: 'Website hosting for the year',
      category: 'advertising',
      categoryConfirmedBy: 'Max Wamsley',
      amountCents: 62000,
      paidBy: 'company',
      noQuoteReason: 'Already purchased',
      files: [FILES.blueFernInvoice()]
    }),
    row(37, 2, {
      date: '2026-09-16',
      vendor: 'Blue Fern Web Co.',
      description: 'Search marketing package',
      category: 'advertising',
      categoryConfirmedBy: 'Max Wamsley',
      amountCents: 52000,
      paidBy: 'company',
      sameReceiptAsRow: 1
    }),

    // PR-0036: processed. Row 1 is the receipt Sam also attached to PR-0035.
    row(36, 1, {
      date: '2026-10-07',
      vendor: 'Northwind Office Supply',
      description: 'Printer paper and toner for the lab office',
      category: 'office',
      amountCents: 8645,
      paidBy: 'employee',
      files: [FILES.northwindReceipt('f36-1')]
    }),
    row(36, 2, {
      date: '2026-10-07',
      vendor: 'QuickShip Postage',
      description: 'Postage for the sample return shipment',
      category: 'shipping',
      amountCents: 2460,
      paidBy: 'company',
      files: [FILES.quickshipReceipt()]
    }),

    // PR-0035: Sam's submission, the same receipt, date, vendor and amount as PR-0036 row 1 (a cross-employee duplicate).
    row(35, 1, {
      date: '2026-10-07',
      vendor: 'Northwind Office Supply',
      description: 'Desk organiser and stationery for the new hire',
      category: 'office',
      amountCents: 8645,
      paidBy: 'employee',
      files: [FILES.northwindReceipt('f35-1')]
    }),

    // PR-0034: returned at processing. Row 2 has no receipt.
    row(34, 1, {
      date: '2026-10-01',
      vendor: 'Summit Training Institute',
      description: 'Two-day laboratory safety course',
      category: 'training',
      amountCents: 45000,
      paidBy: 'employee',
      files: [FILES.summitReceipt()]
    }),
    row(34, 2, {
      date: '2026-10-02',
      vendor: 'Lakeview Bookshop',
      description: 'Course workbook',
      category: 'training',
      amountCents: 3820,
      paidBy: 'employee',
      noReceiptReason: 'Card slip only'
    }),

    // PR-0033: returned at approval. The second vendor has no quote and no reason.
    row(33, 1, {
      date: '2026-10-06',
      vendor: 'Northwind Office Supply',
      description: 'Storage bins and labels',
      category: 'office',
      amountCents: 6430,
      paidBy: 'company'
    }),
    row(33, 2, {
      date: '2026-10-06',
      vendor: 'Redwood Fabrication',
      description: 'Stainless steel workbench',
      category: 'other',
      categoryOther: 'Lab furniture',
      amountCents: 90000,
      paidBy: 'company'
    }),

    // PR-0032: sent for approval, but the approval email failed to go out.
    row(32, 1, {
      date: '2026-10-20',
      vendor: 'Ridgeline Displays',
      description: 'Pop-up banner stands and table cover for the booth',
      category: 'advertising',
      amountCents: 130000,
      paidBy: 'company',
      noQuoteReason: 'The show organizer requires its approved vendor'
    })
  ];
  const of = (id: number) => lines.filter((l) => l.requestId === id);

  const sent40 = sentGroups(of(40), '2026-09-29');
  const sent38 = sentGroups(of(38), '2026-09-24');
  const sent37 = sentGroups(of(37), '2026-09-21');
  const sent33 = sentGroups(of(33), '2026-10-01');
  const sent32 = sentGroups(of(32), '2026-10-02');
  const max = SAMPLE_USERS.admin;

  const requests: PurchaseRequest[] = [
    request({
      id: 41,
      businessPurpose: 'Lab supplies for the Phase 1 assay',
      department: 'R&D',
      projectCode: grant,
      ownerName: jane.displayName,
      ownerEmail: jane.email,
      lastChanged: '2026-10-12 16:40'
    }),
    request({
      id: 40,
      businessPurpose: 'Software licence for the analysis pipeline',
      department: 'R&D',
      projectCode: grant,
      status: 'Awaiting approval',
      approvalRounds: 1,
      sentForApprovalOn: '2026-09-29 09:12',
      approval: { sent: sent40, approved: [] },
      ownerName: jane.displayName,
      ownerEmail: jane.email,
      lastChanged: '2026-09-29 09:12'
    }),
    request({
      id: 38,
      businessPurpose: 'Sensor kit for the Phase 1 prototype',
      department: 'R&D',
      projectCode: grant,
      status: 'Approved',
      approvalRounds: 1,
      sentForApprovalOn: '2026-09-24 15:40',
      approval: { sent: sent38, approved: groupsForApproved(of(38), sent38) },
      approvalNote: 'OK, use the company card.',
      approvedOn: '2026-09-25 10:05',
      approvedBy: max.displayName,
      approvedByEmail: max.email,
      ownerName: jane.displayName,
      ownerEmail: jane.email,
      lastChanged: '2026-09-25 10:05'
    }),
    request({
      id: 37,
      businessPurpose: 'Website hosting and marketing',
      department: 'R&D',
      projectCode: grant,
      status: 'Submitted',
      submissionCount: 1,
      approvalRounds: 1,
      sentForApprovalOn: '2026-09-21 11:05',
      boughtBeforeApproval: anyBoughtBefore(sent37),
      approval: { sent: sent37, approved: groupsForApproved(of(37), sent37) },
      approvedOn: '2026-09-22 14:30',
      approvedBy: max.displayName,
      approvedByEmail: max.email,
      submittedOn: '2026-09-24 08:50',
      ownerName: jane.displayName,
      ownerEmail: jane.email,
      lastChanged: '2026-09-24 08:50'
    }),
    request({
      id: 36,
      businessPurpose: 'Office supplies and postage',
      department: 'R&D',
      projectCode: grant,
      status: 'Processed',
      submissionCount: 1,
      submittedOn: '2026-10-08 08:30',
      processedOn: '2026-10-12 11:20',
      processedBy: max.displayName,
      ownerName: jane.displayName,
      ownerEmail: jane.email,
      lastChanged: '2026-10-12 11:20'
    }),
    request({
      id: 35,
      businessPurpose: 'Office supplies for the new hire',
      department: 'Operations',
      status: 'Submitted',
      submissionCount: 1,
      submittedOn: '2026-10-08 09:05',
      ownerName: sam.displayName,
      ownerEmail: sam.email,
      lastChanged: '2026-10-08 09:05'
    }),
    request({
      id: 34,
      businessPurpose: 'Training course',
      department: 'Operations',
      status: 'Returned',
      returnStage: 'processing',
      returnNote: 'Row 2: please attach the itemized invoice, not the card slip.',
      submissionCount: 1,
      submittedOn: '2026-10-05 10:15',
      ownerName: sam.displayName,
      ownerEmail: sam.email,
      lastChanged: '2026-10-09 15:30'
    }),
    request({
      id: 33,
      businessPurpose: 'Workbench for the new lab space',
      department: 'Operations',
      status: 'Returned',
      returnStage: 'approval',
      returnNote: 'Please add a quote for the second vendor, or say why there is none.',
      approvalRounds: 1,
      sentForApprovalOn: '2026-10-01 10:20',
      approval: { sent: sent33, approved: [] },
      ownerName: sam.displayName,
      ownerEmail: sam.email,
      lastChanged: '2026-10-02 09:40'
    }),
    request({
      id: 32,
      businessPurpose: 'Conference booth materials',
      department: 'Operations',
      status: 'Awaiting approval',
      approvalRounds: 1,
      sentForApprovalOn: '2026-10-02 16:45',
      approval: { sent: sent32, approved: [] },
      ownerName: sam.displayName,
      ownerEmail: sam.email,
      lastChanged: '2026-10-02 16:45'
    })
  ];

  for (const r of requests) {
    const t = computeTotals(of(r.id));
    r.totalReimburseCents = t.reimburseCents;
    r.totalCompanyCents = t.companyCents;
    r.totalRequestCents = t.requestCents;
  }

  const store: SampleStore = {
    requests,
    lines,
    submissions: [],
    csvBySubmission: {},
    nextRequestId: 42,
    nextSubmissionId: SAMPLE_SUBMISSIONS.length + 1
  };
  completeSampleOutputs(store);
  return store;
}

/**
 * Makes the sample submissions and fills in what the app would have written at
 * Send for approval or Submit (email text, CSV, package file names), using
 * the real builders, so the preview shows the real wording.
 */
function completeSampleOutputs(store: SampleStore): void {
  for (const spec of SAMPLE_SUBMISSIONS) {
    const request = store.requests.find((r) => r.id === spec.requestId)!;
    const lines = store.lines.filter((l) => l.requestId === request.id).sort((a, b) => a.rowNumber - b.rowNumber);
    const totals = computeTotals(lines);
    const submitter = { name: request.ownerName, email: request.ownerEmail };
    const frozen = {
      id: spec.id,
      requestId: request.id,
      requestNumber: request.requestNumber,
      type: spec.type,
      submissionNumber: spec.number,
      packageStatus: spec.status,
      submitterName: submitter.name,
      submitterEmail: submitter.email,
      submittedOn: spec.on,
      businessPurpose: request.businessPurpose,
      department: request.department,
      projectCode: request.projectCode,
      purchaseDates: dateRangeText(lines.map((l) => l.date)),
      totalReimburseCents: totals.reimburseCents,
      totalCompanyCents: totals.companyCents,
      totalRequestCents: totals.requestCents,
      packagedAt: spec.packagedAt ?? '',
      errorMessage: spec.errorMessage ?? ''
    };

    if (spec.type === 'approval') {
      const groups = request.approval.sent;
      store.submissions.push({
        ...frozen,
        folderName: '',
        previousFolderName: '',
        certificationText: '',
        receiptCount: 0,
        quoteCount: lines.reduce((n, l) => n + l.files.filter((f) => f.kind === 'quote').length, 0),
        rowsWithoutReceipt: 0,
        boughtBeforeApproval: anyBoughtBefore(groups),
        approvedBy: '',
        approvedOn: '',
        emailSubject: approvalEmailSubject(request.ownerName, request.businessPurpose, request.requestNumber, spec.number),
        emailSummary: buildApprovalEmailSummary({
          request,
          lines,
          totals,
          submitterName: submitter.name,
          submitterEmail: submitter.email,
          round: spec.number,
          sentOn: spec.on,
          groups
        }),
        folderLink: '',
        packageFileNames: []
      });
      store.csvBySubmission[spec.id] = '';
      continue;
    }

    const warnings = validateRequest(request, lines, [], spec.on.slice(0, 10)).filter((i) => i.severity === 'warning');
    const files = packageFiles(lines);
    const receiptCount = files.filter((f) => f.kind === 'receipt').length;
    const quoteCount = files.filter((f) => f.kind === 'quote').length;
    const name = folderName({
      firstPurchaseDate: dateRange(lines.map((l) => l.date)).first,
      ownerName: request.ownerName,
      businessPurpose: request.businessPurpose,
      requestNumber: request.requestNumber,
      submissionNumber: spec.number
    });
    store.submissions.push({
      ...frozen,
      folderName: name,
      previousFolderName: '',
      certificationText: CERTIFICATION,
      receiptCount,
      quoteCount,
      rowsWithoutReceipt: lines.filter((l) => !hasReceipt(l, lines)).length,
      boughtBeforeApproval: request.boughtBeforeApproval || anyBoughtBefore(request.approval.approved),
      approvedBy: request.approvedBy,
      approvedOn: request.approvedOn,
      emailSubject: submissionEmailSubject(request.ownerName, request.businessPurpose, request.requestNumber, spec.number),
      emailSummary: buildSubmissionEmailSummary({
        request,
        lines,
        totals,
        submitterName: submitter.name,
        certification: { email: submitter.email, text: CERTIFICATION, submittedOn: spec.on },
        receiptCount,
        quoteCount,
        warnings,
        previousFolderName: ''
      }),
      folderLink: spec.status === 'Packaged' ? packagedFolderLink(name) : '',
      packageFileNames: [...files.map((f) => f.packageName), csvFileName(request.requestNumber, spec.number)]
    });
    store.csvBySubmission[spec.id] = buildPurchasesCsv({
      request,
      lines,
      submissionNumber: spec.number,
      submitterName: submitter.name,
      submitterEmail: submitter.email,
      submittedOn: spec.on,
      warnings
    });
  }
}

/**
 * Finishes what the simulated flow had still to do. The preview keeps the store
 * as plain data when it switches between people, and the timers that would have
 * finished the work die with the page, so a restored store has every
 * submission that was Uploading, Ready or Processing marked Packaged.
 */
export function finishPendingWork(store: SampleStore, now: Date = new Date()): void {
  for (const s of store.submissions) {
    if (s.packageStatus !== 'Uploading' && s.packageStatus !== 'Ready' && s.packageStatus !== 'Processing') continue;
    s.packageStatus = 'Packaged';
    s.packagedAt = toLocalDateTime(now);
    if (s.type === 'package') s.folderLink = packagedFolderLink(s.folderName);
  }
}
