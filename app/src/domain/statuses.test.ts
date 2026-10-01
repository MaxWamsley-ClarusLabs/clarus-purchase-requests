import {
  APPROVAL_STATE_DISPLAY,
  approvalStateDisplay,
  LINE_APPROVAL_DISPLAY,
  PACKAGE_ATTENTION_MINUTES,
  REQUEST_STATUSES,
  REQUEST_STATUS_DISPLAY,
  STATUS_FOR_SUBMISSION,
  canConfirmCategories,
  isEditable,
  mayBuy,
  requestStatusDisplay,
  submissionNeedsAttention,
  submissionStatusDisplay
} from './statuses';

describe('request statuses (P-006, P-027)', () => {
  it('has the travel statuses and the two approval statuses', () => {
    expect(REQUEST_STATUSES).toEqual(['Draft', 'Awaiting approval', 'Approved', 'Submitted', 'Returned', 'Processed']);
    for (const s of REQUEST_STATUSES) expect(REQUEST_STATUS_DISPLAY[s].label.length).toBeGreaterThan(0);
  });

  it('the employee can edit a Draft, Returned or Approved request only', () => {
    expect(REQUEST_STATUSES.filter((status) => isEditable(status))).toEqual(['Draft', 'Approved', 'Returned']);
  });

  it('categories can be confirmed while awaiting approval, approved or submitted, and not at other times (P-024)', () => {
    expect(REQUEST_STATUSES.filter(canConfirmCategories)).toEqual(['Awaiting approval', 'Approved', 'Submitted']);
  });

  it('shows an approval request and a package in their own words', () => {
    expect(submissionStatusDisplay('package', 'Packaged')).toEqual({ label: 'Packaged', tone: 'green' });
    expect(submissionStatusDisplay('approval', 'Packaged')).toEqual({ label: 'Approver emailed', tone: 'green' });
    expect(submissionStatusDisplay('approval', 'Failed').tone).toBe('red');
    expect(submissionStatusDisplay('package', 'Failed').label).toBe('Packaging failed');
  });

  it('labels every approval state and every line status', () => {
    expect(Object.keys(APPROVAL_STATE_DISPLAY).sort()).toEqual(['approved', 'changed', 'needed', 'notRequired', 'pending']);
    expect(Object.keys(LINE_APPROVAL_DISPLAY).sort()).toEqual(['approved', 'changed', 'needed', 'notRequired', 'pending']);
  });

  it('flags a submission that is not done after 30 minutes', () => {
    expect(PACKAGE_ATTENTION_MINUTES).toBe(30);
  });

  it('needs attention when it failed, or when it is not Packaged 30 minutes after it was made (P-030)', () => {
    const now = new Date(2026, 9, 12, 10, 0);
    expect(submissionNeedsAttention({ packageStatus: 'Failed', submittedOn: '2026-10-12 09:59' }, now)).toBe(true);
    expect(submissionNeedsAttention({ packageStatus: 'Packaged', submittedOn: '2026-10-01 09:00' }, now)).toBe(false);
    for (const status of ['Uploading', 'Ready', 'Processing'] as const) {
      expect(submissionNeedsAttention({ packageStatus: status, submittedOn: '2026-10-12 09:29' }, now)).toBe(true);
      expect(submissionNeedsAttention({ packageStatus: status, submittedOn: '2026-10-12 09:31' }, now)).toBe(false);
    }
  });

  it('measures from the last change when it is known, so a retry starts the 30 minutes again', () => {
    const now = new Date(2026, 9, 12, 10, 0);
    // Made long ago, retried at 09:45: not stuck yet.
    expect(submissionNeedsAttention({ packageStatus: 'Ready', submittedOn: '2026-10-11 09:00', lastChanged: '2026-10-12 09:45' }, now)).toBe(false);
    // Last changed at 09:29: stuck.
    expect(submissionNeedsAttention({ packageStatus: 'Ready', submittedOn: '2026-10-12 09:00', lastChanged: '2026-10-12 09:29' }, now)).toBe(true);
    // Not known: the time it was made.
    expect(submissionNeedsAttention({ packageStatus: 'Ready', submittedOn: '2026-10-12 09:29' }, now)).toBe(true);
    // A failure is always listed.
    expect(submissionNeedsAttention({ packageStatus: 'Failed', submittedOn: '2026-10-11 09:00', lastChanged: '2026-10-12 09:59' }, now)).toBe(true);
  });

  it('says which request status each kind of submission is for', () => {
    expect(STATUS_FOR_SUBMISSION).toEqual({ approval: 'Awaiting approval', package: 'Submitted' });
  });
});

describe('when the approver buys (P-037)', () => {
  it('shows Submitted as Purchased and an approved request as the approver\'s to finish', () => {
    expect(requestStatusDisplay('Submitted', 'approver').label).toBe('Purchased');
    expect(requestStatusDisplay('Submitted', 'self').label).toBe('Submitted');
    expect(requestStatusDisplay('Approved', 'approver').help).toContain('approver buys it');
    for (const s of REQUEST_STATUSES) expect(requestStatusDisplay(s, 'approver').label.length).toBeGreaterThan(0);
    expect(requestStatusDisplay('Draft', 'approver')).toEqual(REQUEST_STATUS_DISPLAY.Draft);
  });

  it('shows the approval states in the approver-buys words', () => {
    expect(approvalStateDisplay('needed', 'approver').help).toContain('approver');
    expect(approvalStateDisplay('needed', 'self')).toEqual(APPROVAL_STATE_DISPLAY.needed);
  });

  it('keeps an approved request from the employee, who no longer buys it', () => {
    expect(REQUEST_STATUSES.filter((status) => isEditable(status, 'approver'))).toEqual(['Draft', 'Returned']);
    expect(REQUEST_STATUSES.filter((status) => isEditable(status, 'self'))).toEqual(['Draft', 'Approved', 'Returned']);
  });

  it('lets only the approver who approved it buy it, while it is approved', () => {
    const request = { buyer: 'approver' as const, status: 'Approved' as const, approvedByEmail: 'max.wamsley@example.com' };
    const max = { email: 'Max.Wamsley@example.com', isAdministrator: true };
    expect(mayBuy(request, max)).toBe(true);
    expect(mayBuy(request, { email: 'someone.else@example.com', isAdministrator: true })).toBe(false);
    expect(mayBuy(request, { ...max, isAdministrator: false })).toBe(false);
    expect(mayBuy({ ...request, status: 'Submitted' }, max)).toBe(false);
    expect(mayBuy({ ...request, buyer: 'self' }, max)).toBe(false);
    expect(mayBuy({ ...request, approvedByEmail: '' }, { email: '', isAdministrator: true })).toBe(false);
  });
});
