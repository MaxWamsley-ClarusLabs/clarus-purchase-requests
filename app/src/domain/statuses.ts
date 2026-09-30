// Report and package statuses and how each is shown (D-033).

import { PackageStatus, ReportStatus } from './types';

export type BadgeTone = 'lavender' | 'purple' | 'amber' | 'green' | 'red';

export const REPORT_STATUS_DISPLAY: Record<ReportStatus, { label: string; tone: BadgeTone; help: string }> = {
  Draft: { label: 'Draft', tone: 'lavender', help: 'Being prepared. Saved automatically.' },
  Submitted: { label: 'Submitted', tone: 'purple', help: 'Sent for processing. Read-only until processed or returned.' },
  Returned: { label: 'Returned', tone: 'amber', help: 'Sent back with a note. Correct it and submit again.' },
  Processed: { label: 'Processed', tone: 'green', help: 'Filed and entered. Closed.' }
};

export const PACKAGE_STATUS_DISPLAY: Record<PackageStatus, { label: string; tone: BadgeTone }> = {
  Uploading: { label: 'Uploading', tone: 'lavender' },
  Ready: { label: 'Waiting for packaging', tone: 'lavender' },
  Processing: { label: 'Packaging', tone: 'purple' },
  Packaged: { label: 'Packaged', tone: 'green' },
  Failed: { label: 'Packaging failed', tone: 'red' }
};

/** Reports an employee may edit (D-042). */
export function isEditable(status: ReportStatus): boolean {
  return status === 'Draft' || status === 'Returned';
}

/** Minutes after which a submission that is not Packaged needs attention (strategy section 7). */
export const PACKAGE_ATTENTION_MINUTES = 30;
