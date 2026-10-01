// Builders for synthetic test data. Used by unit tests only. Vendors and
// people are made up.

import { ApprovalRecord, AttachedFile, PurchaseLine, PurchaseRequest } from '../domain/types';

export function file(overrides: Partial<AttachedFile> = {}): AttachedFile {
  return { id: 'f1', fileName: 'receipt.pdf', sizeBytes: 1000, fingerprint: 'aaa', contentType: 'application/pdf', kind: 'receipt', ...overrides };
}

/** A quote file. */
export function quote(overrides: Partial<AttachedFile> = {}): AttachedFile {
  return file({ id: 'q1', fileName: 'quote.pdf', fingerprint: 'qqq', kind: 'quote', ...overrides });
}

export function line(overrides: Partial<PurchaseLine> = {}): PurchaseLine {
  return {
    id: 'l1',
    requestId: 42,
    rowNumber: 1,
    date: '2026-10-12',
    vendor: 'Acme Lab Supply',
    description: 'Pipette tips for the Phase 1 assay',
    category: 'rdMaterials',
    categoryOther: '',
    categoryConfirmedBy: '',
    amountCents: 12500,
    paidBy: 'company',
    noQuoteReason: '',
    noReceiptReason: '',
    itemLink: '',
    noLinkReason: '',
    sameReceiptAsRow: null,
    files: [file()],
    suggested: [],
    ...overrides
  };
}

/** A request's fields to change, where the approval record may give only some of its lists: the others are empty. */
export type RequestOverrides = Omit<Partial<PurchaseRequest>, 'approval'> & { approval?: Partial<ApprovalRecord> };

export function request(overrides: RequestOverrides = {}): PurchaseRequest {
  const { approval, ...rest } = overrides;
  return {
    id: 42,
    requestNumber: 'PR-0042',
    businessPurpose: 'Lab supplies for the Phase 1 assay',
    department: 'R&D',
    projectCode: '',
    // The tests of the first build are about a request the employee buys; the approver-buys tests say so.
    buyer: 'self',
    status: 'Draft',
    returnNote: '',
    returnStage: '',
    ownerName: 'Jane Doe',
    ownerEmail: 'jane.doe@example.com',
    submissionCount: 0,
    approvalRounds: 0,
    totalReimburseCents: 0,
    totalCompanyCents: 0,
    totalRequestCents: 0,
    sentForApprovalOn: '',
    boughtBeforeApproval: false,
    approvalNote: '',
    approvedOn: '',
    approvedBy: '',
    approvedByEmail: '',
    submittedOn: '',
    processedOn: '',
    processedBy: '',
    lastChanged: '2026-10-16 09:00',
    ...rest,
    approval: { sent: [], approved: [], earlier: [], ...approval }
  };
}
