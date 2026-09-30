import { MockDataService, NotAllowedError } from './MockDataService';
import { createSampleStore, SAMPLE_USERS } from './sampleData';
import { messages } from '../../domain/messages';

describe('MockDataService lifecycle rules (D-042)', () => {
  it('shows employees only their own reports', async () => {
    const store = createSampleStore();
    const jane = new MockDataService(store, SAMPLE_USERS.jane, 0);
    const mine = await jane.listMyReports();
    expect(mine.every((r) => r.ownerEmail === SAMPLE_USERS.jane.email)).toBe(true);
    await expect(jane.getReport(39)).rejects.toBeInstanceOf(NotAllowedError);
  });

  it('locks a report once submitted and numbers the submission', async () => {
    const store = createSampleStore();
    const jane = new MockDataService(store, SAMPLE_USERS.jane, 0);
    const draft = (await jane.getReport(41)).lines;
    // Fix the blocking row in the sample draft (no payment type), then submit.
    await jane.updateLine(draft[6].id, { paymentType: 'companyCard' });
    const submission = await jane.submitReport(41, messages.certification);
    expect(submission.folderName).toBe('2026-09-14_Jane-Doe_Boston-Conference_TR-0041');
    expect(submission.packageFileNames).toContain('TR-0041_Expenses.csv');
    expect(submission.submitterEmail).toBe(SAMPLE_USERS.jane.email);
    expect(submission.certificationText).toBe(messages.certification);
    const after = await jane.getReport(41);
    expect(after.report.status).toBe('Submitted');
    await expect(jane.updateReport(41, { tripName: 'Changed' })).rejects.toBeInstanceOf(NotAllowedError);
  });

  it('lets only drafts be deleted', async () => {
    const store = createSampleStore();
    const jane = new MockDataService(store, SAMPLE_USERS.jane, 0);
    await expect(jane.deleteReport(38)).rejects.toBeInstanceOf(NotAllowedError);
    const created = await jane.createReport();
    await jane.deleteReport(created.id);
    expect((await jane.listMyReports()).some((r) => r.id === created.id)).toBe(false);
  });

  it('renumbers rows after a deletion and keeps shared-receipt pointers right', async () => {
    const store = createSampleStore();
    const jane = new MockDataService(store, SAMPLE_USERS.jane, 0);
    const lines = (await jane.getReport(41)).lines;
    await jane.deleteLine(lines[0].id); // row 1 removed; row 4 pointed at row 3
    const after = (await jane.getReport(41)).lines;
    expect(after.map((l) => l.rowNumber)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(after.find((l) => l.vendor.startsWith('Harbor Grill'))!.sameReceiptAsRow).toBe(2);
  });

  it('keeps administrator actions for administrators', async () => {
    const store = createSampleStore();
    const jane = new MockDataService(store, SAMPLE_USERS.jane, 0);
    await expect(jane.markProcessed(38)).rejects.toBeInstanceOf(NotAllowedError);
    const admin = new MockDataService(store, SAMPLE_USERS.admin, 0);
    const returned = await admin.returnReport(38, 'Please add the parking receipt.');
    expect(returned.status).toBe('Returned');
    await jane.updateReport(38, { destination: 'Denver, Colorado' });
    const resubmitted = await jane.submitReport(38, messages.certification);
    expect(resubmitted.submissionNumber).toBe(2);
    expect(resubmitted.folderName.endsWith('_TR-0038_R2')).toBe(true);
    expect(resubmitted.previousFolderName).toBe('2026-09-08_Jane-Doe_Customer-visit-Denver_TR-0038');
  });
});
