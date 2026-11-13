import { request } from '../../../testing/builders';
import { PackageStatus, Submission, SubmissionType } from '../../../domain/types';
import {
  latestApprovalByRequest,
  latestByRequest,
  latestSubmission,
  needsAttention,
  requestsAwaitingApproval,
  requestsToProcess,
  stuckSubmissions
} from './adminData';

function submission(overrides: Partial<Submission> & Pick<Submission, 'id' | 'requestId'>): Submission {
  return {
    requestNumber: `PR-00${overrides.requestId}`,
    type: 'package' as SubmissionType,
    submissionNumber: 1,
    packageStatus: 'Packaged' as PackageStatus,
    folderName: '',
    previousFolderName: '',
    submitterName: 'Jane Doe',
    submitterEmail: 'jane.doe@example.com',
    submittedOn: '2026-10-12 09:00',
    certificationText: '',
    businessPurpose: 'Lab supplies',
    department: 'R&D',
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

const NOW = new Date('2026-10-12T10:00:00');

describe('the newest submission of a request', () => {
  const all = [
    submission({ id: 1, requestId: 7, type: 'approval', submissionNumber: 1 }),
    submission({ id: 2, requestId: 7, type: 'approval', submissionNumber: 2 }),
    submission({ id: 3, requestId: 7, type: 'package', submissionNumber: 1 }),
    submission({ id: 4, requestId: 7, type: 'package', submissionNumber: 2 }),
    submission({ id: 5, requestId: 8, type: 'package', submissionNumber: 1 })
  ];

  it('is found separately for approval requests and packages', () => {
    expect(latestSubmission(all, 'approval')?.id).toBe(2);
    expect(
      latestSubmission(
        all.filter((s) => s.requestId === 7),
        'package'
      )?.id
    ).toBe(4);
    expect(latestSubmission([], 'package')).toBeUndefined();
  });

  it('is kept per request', () => {
    expect([...latestByRequest(all)].map(([id, s]) => [id, s.id]).sort()).toEqual([
      [7, 4],
      [8, 5]
    ]);
    expect([...latestApprovalByRequest(all)].map(([id, s]) => [id, s.id])).toEqual([[7, 2]]);
  });

  it('takes the later item when two have the same submission number', () => {
    const twins = [submission({ id: 10, requestId: 7 }), submission({ id: 11, requestId: 7 })];
    expect(latestSubmission(twins, 'package')?.id).toBe(11);
    expect(latestByRequest(twins).get(7)?.id).toBe(11);
  });
});

describe('a submission that needs attention (P-030)', () => {
  it('is one that failed', () => {
    expect(needsAttention(submission({ id: 1, requestId: 7, packageStatus: 'Failed', submittedOn: '2026-10-12 09:59' }), NOW)).toBe(true);
  });

  it('is not one that is done', () => {
    expect(needsAttention(submission({ id: 1, requestId: 7, packageStatus: 'Packaged', submittedOn: '2026-10-01 09:00' }), NOW)).toBe(false);
  });

  it('is one that is not done after 30 minutes, for an approval request as well as a package', () => {
    for (const type of ['approval', 'package'] as const) {
      expect(needsAttention(submission({ id: 1, requestId: 7, type, packageStatus: 'Ready', submittedOn: '2026-10-12 09:29' }), NOW)).toBe(true);
      expect(needsAttention(submission({ id: 1, requestId: 7, type, packageStatus: 'Ready', submittedOn: '2026-10-12 09:31' }), NOW)).toBe(false);
    }
  });
});

describe('the submissions listed under Needs attention', () => {
  const requests = [
    request({ id: 1, status: 'Submitted' }),
    request({ id: 2, status: 'Awaiting approval' }),
    request({ id: 3, status: 'Returned' }),
    request({ id: 4, status: 'Approved' }),
    request({ id: 5, status: 'Processed' })
  ];

  it('are a failed package of a submitted request and a failed approval email of a request awaiting approval', () => {
    const subs = [
      submission({ id: 10, requestId: 1, type: 'package', packageStatus: 'Failed', submittedOn: '2026-10-08 09:05' }),
      submission({ id: 11, requestId: 2, type: 'approval', packageStatus: 'Failed', submittedOn: '2026-10-09 10:00' })
    ];
    expect(stuckSubmissions(requests, subs, NOW).map((s) => s.id)).toEqual([11, 10]);
  });

  it('leave out a submission whose request has moved on', () => {
    const subs = [
      submission({ id: 20, requestId: 3, type: 'package', packageStatus: 'Failed' }),
      submission({ id: 21, requestId: 4, type: 'approval', packageStatus: 'Failed' }),
      submission({ id: 22, requestId: 5, type: 'package', packageStatus: 'Failed' }),
      submission({ id: 23, requestId: 1, type: 'approval', packageStatus: 'Failed' }),
      submission({ id: 24, requestId: 2, type: 'package', packageStatus: 'Failed' })
    ];
    expect(stuckSubmissions(requests, subs, NOW)).toEqual([]);
  });

  it('look only at the newest submission of each type', () => {
    const subs = [
      submission({ id: 30, requestId: 1, type: 'package', submissionNumber: 1, packageStatus: 'Failed' }),
      submission({ id: 31, requestId: 1, type: 'package', submissionNumber: 2, packageStatus: 'Packaged' })
    ];
    expect(stuckSubmissions(requests, subs, NOW)).toEqual([]);
  });
});

describe('the lists of requests', () => {
  const requests = [
    request({ id: 1, status: 'Submitted' }),
    request({ id: 2, status: 'Awaiting approval' }),
    request({ id: 3, status: 'Draft' }),
    request({ id: 4, status: 'Submitted' })
  ];

  it('pick the submitted ones, and the ones awaiting approval', () => {
    expect(requestsToProcess(requests).map((r) => r.id)).toEqual([1, 4]);
    expect(requestsAwaitingApproval(requests).map((r) => r.id)).toEqual([2]);
  });
});
