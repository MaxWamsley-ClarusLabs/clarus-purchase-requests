import { prepareSubmission, SubmissionBlockedError } from './submission';
import { messages } from '../domain/messages';
import { line, receipt, report } from '../testing/builders';

describe('prepareSubmission', () => {
  const now = new Date(2026, 9, 16, 9, 30);
  const certified = { text: messages.certification, email: 'jane.doe@example.com' };

  it('prepares the folder name, CSV, receipt copies and email', () => {
    const prepared = prepareSubmission(report(), [line({ receipts: [receipt({ fileName: 'ticket.pdf' })] })], [], now, '', certified);
    expect(prepared.submission.folderName).toBe('2026-10-12_Jane-Doe_Boston-Conference_TR-0042');
    expect(prepared.csvName).toBe('TR-0042_Expenses.csv');
    expect(prepared.submission.packageFileNames).toEqual(['R01_ticket.pdf', 'TR-0042_Expenses.csv']);
    expect(prepared.submission.emailSubject).toBe('Travel report submitted: Jane Doe, Boston Conference (TR-0042)');
    expect(prepared.submission.suggestedClass).toBe('1.01 NSF Phase 1 SBIR');
    expect(prepared.submission.totalReimburseCents).toBe(45230);
    expect(prepared.submission.submittedOn).toBe('2026-10-16 09:30');
  });

  it('numbers a resubmission and names the folder it replaces', () => {
    const prepared = prepareSubmission(report({ submissionCount: 1 }), [line()], [], now, '2026-10-12_Jane-Doe_Boston-Conference_TR-0042', certified);
    expect(prepared.submission.submissionNumber).toBe(2);
    expect(prepared.submission.folderName).toBe('2026-10-12_Jane-Doe_Boston-Conference_TR-0042_R2');
    expect(prepared.csvName).toBe('TR-0042_R2_Expenses.csv');
    expect(prepared.submission.emailSubject).toBe('Travel report resubmitted: Jane Doe, Boston Conference (TR-0042, R2)');
    expect(prepared.submission.emailSummary).toContain('This replaces the earlier folder');
  });

  it('refuses a report with blocking problems', () => {
    expect(() => prepareSubmission(report({ tripName: '' }), [line()], [], now, '', certified)).toThrow(SubmissionBlockedError);
  });

  it('writes the email summary as plain text, which the flow escapes (D-067)', () => {
    const prepared = prepareSubmission(report({ businessPurpose: '<b>urgent</b>' }), [line()], [], now, '', certified);
    expect(prepared.submission.emailSummary).toContain('Business purpose: <b>urgent</b>');
    expect(prepared.submission.emailSummary).toContain('To reimburse: $452.30');
  });

  it('records the certification with the account, and refuses without it (D-064)', () => {
    const prepared = prepareSubmission(report(), [line()], [], now, '', certified);
    expect(prepared.submission.certificationText).toBe(messages.certification);
    expect(prepared.submission.submitterEmail).toBe('jane.doe@example.com');
    expect(prepared.submission.emailSummary).toContain(messages.certification);
    expect(prepared.csvContent).toContain('Jane Doe (jane.doe@example.com)');
    expect(() => prepareSubmission(report(), [line()], [], now, '', { text: '', email: 'jane.doe@example.com' })).toThrow(messages.certificationRequired);
    expect(() => prepareSubmission(report(), [line()], [], now, '', { text: 'Something else', email: 'jane.doe@example.com' })).toThrow();
    expect(() => prepareSubmission(report(), [line()], [], now, '', { text: messages.certification, email: '' })).toThrow();
  });

  it('passes a late submission to the administrator as a report warning (D-065)', () => {
    const late = new Date(2026, 10, 20, 9, 0);
    const prepared = prepareSubmission(report(), [line()], [], late, '', certified);
    expect(prepared.warnings.map((w) => w.message)).toEqual([messages.lateSubmission(36)]);
    expect(prepared.submission.emailSummary).toContain(`- ${messages.lateSubmission(36)}`);
    expect(prepared.submission.emailSummary).not.toContain('Row undefined');
    expect(prepared.csvContent).toContain(messages.lateSubmission(36));
  });

  it('adds mileage drives after the receipt rows, numbered M1, and includes them in the totals (D-071)', () => {
    const withMileage = report({ hasMileage: true, mileageTrips: [{ id: 't1', date: '2026-10-12', from: 'Office', to: 'Airport', miles: 42 }] });
    const prepared = prepareSubmission(withMileage, [line()], [], now, '', certified);
    expect(prepared.submission.totalReimburseCents).toBe(45230 + 3192);
    const rows = prepared.csvContent.split('\r\n');
    expect(rows[2]).toContain('TR-0042,M1,2026-10-12,Mileage,Mileage,31.92,Personal vehicle (reimburse me),Yes,6104 Transportation');
    expect(rows[2]).toContain('From Office to Airport: 42 miles at 76 cents a mile');
    expect(prepared.submission.emailSummary).toContain('Mileage: 1 drive, 42 miles, included in To reimburse.');
    expect(prepared.submission.rowsWithoutReceipt).toBe(0);
  });
});
