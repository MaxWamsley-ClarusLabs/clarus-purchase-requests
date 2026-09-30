// Builders for synthetic test data. Used by unit tests only.

import { ExpenseLine, ReceiptFile, TravelReport } from '../domain/types';

export function receipt(overrides: Partial<ReceiptFile> = {}): ReceiptFile {
  return { id: 'f1', fileName: 'receipt.pdf', sizeBytes: 1000, fingerprint: 'aaa', contentType: 'application/pdf', ...overrides };
}

export function line(overrides: Partial<ExpenseLine> = {}): ExpenseLine {
  return {
    id: 'l1',
    reportId: 42,
    rowNumber: 1,
    date: '2026-10-12',
    vendor: 'Delta Air Lines',
    category: 'airfare',
    description: '',
    amountCents: 45230,
    paymentType: 'personal',
    noReceiptReason: '',
    sameReceiptAsRow: null,
    receipts: [receipt()],
    suggested: [],
    ...overrides
  };
}

export function report(overrides: Partial<TravelReport> = {}): TravelReport {
  return {
    id: 42,
    reportNumber: 'TR-0042',
    tripName: 'Boston Conference',
    destination: 'Boston, MA',
    businessPurpose: 'Present results at the conference',
    tripPurpose: 'nsfPhase1',
    tripStart: '2026-10-12',
    tripEnd: '2026-10-15',
    hasMileage: false,
    mileageTrips: [],
    status: 'Draft',
    returnNote: '',
    ownerName: 'Jane Doe',
    ownerEmail: 'jane.doe@example.com',
    submissionCount: 0,
    totalReimburseCents: 0,
    totalCompanyCents: 0,
    totalTripCents: 0,
    submittedOn: '',
    processedOn: '',
    processedBy: '',
    lastChanged: '2026-10-16 09:00',
    ...overrides
  };
}
