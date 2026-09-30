import {
  APPROVAL_STATE_DISPLAY,
  LINE_APPROVAL_DISPLAY,
  PACKAGE_ATTENTION_MINUTES,
  REQUEST_STATUSES,
  REQUEST_STATUS_DISPLAY,
  isEditable,
  submissionStatusDisplay
} from './statuses';

describe('request statuses (P-006, P-027)', () => {
  it('has the travel statuses and the two approval statuses', () => {
    expect(REQUEST_STATUSES).toEqual(['Draft', 'Awaiting approval', 'Approved', 'Submitted', 'Returned', 'Processed']);
    for (const s of REQUEST_STATUSES) expect(REQUEST_STATUS_DISPLAY[s].label.length).toBeGreaterThan(0);
  });

  it('the employee can edit a Draft, Returned or Approved request only', () => {
    expect(REQUEST_STATUSES.filter(isEditable)).toEqual(['Draft', 'Approved', 'Returned']);
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
});
