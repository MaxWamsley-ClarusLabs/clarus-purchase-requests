// Where the flows write their output: the ONE place (P-064). The Purchase Requests flow's request folders, the receipt
// archive and the nightly ledger backup all take their site, library and folder names from here, and so do the Set-up
// page's checks and the paths shown on screen. Change a name here and nowhere else.
//
// Max creates these folders and restricts who can open them. Nothing in the app or the flows creates them or sets their
// permissions (only the PR-#### folder of each request, and its folder in the receipt archive, are made by the flow).
// If one is missing the flow stops with a clear message, and the Set-up page does not make a package.
//
// The Executive Team site is retired and is never written to (P-064).

export type OutputMode = 'test' | 'live';

export interface OutputDestination {
  /** The site the folders are on. null: the site the app runs on (the test destination). */
  siteUrl: string | null;
  /** The library's address on its site, as SharePoint shows it in a folder's web address. */
  libraryUrlName: string;
  /** The library's name as people see it. */
  libraryTitle: string;
  /** The folder Max creates, inside the library. The three folders below are inside it. */
  parentFolder: string;
  /** Where each request's PR-#### folder is made. */
  requestsFolder: string;
  /** The permanent receipt archive: one folder per request inside it (P-058, replaced by this place in P-064). */
  archiveFolder: string;
  /** The nightly ledger backup: a new dated pair of files each night (P-059, replaced by this place in P-064). */
  backupFolder: string;
}

export const OUTPUT_DESTINATION: Record<OutputMode, OutputDestination> = {
  live: {
    siteUrl: 'https://claruslabsusa.sharepoint.com/sites/FormsandApps',
    libraryUrlName: 'Shared Documents',
    libraryTitle: 'Documents',
    parentFolder: 'App Output',
    requestsFolder: 'Purchases_To_Process',
    archiveFolder: 'Purchase_Receipts',
    backupFolder: 'Ledger_Backups'
  },
  test: {
    siteUrl: null,
    libraryUrlName: 'Shared Documents',
    libraryTitle: 'Documents',
    parentFolder: 'Purchases_Test',
    requestsFolder: 'Purchases_To_Process',
    archiveFolder: 'Purchase_Receipts',
    backupFolder: 'Ledger_Backups'
  }
};

/** The three folders a package writes into, as paths inside the library. */
export function outputFolders(mode: OutputMode): { requests: string; archive: string; backup: string } {
  const d = OUTPUT_DESTINATION[mode];
  return {
    requests: `${d.parentFolder}/${d.requestsFolder}`,
    archive: `${d.parentFolder}/${d.archiveFolder}`,
    backup: `${d.parentFolder}/${d.backupFolder}`
  };
}

/** The folders as the flow lists them: the parent first, the request landing folder last. */
export function landingFolders(mode: OutputMode): string[] {
  return [OUTPUT_DESTINATION[mode].parentFolder, outputFolders(mode).requests];
}

/** A folder as people read it: "Documents / App Output / Purchases_To_Process". */
export function folderText(mode: OutputMode, folder: 'requests' | 'archive' | 'backup'): string {
  const d = OUTPUT_DESTINATION[mode];
  return `${d.libraryTitle} / ${d.parentFolder} / ${folder === 'requests' ? d.requestsFolder : folder === 'archive' ? d.archiveFolder : d.backupFolder}`;
}

/** The live request folder with ">" between the names, for a sentence on screen. */
export const LIVE_REQUESTS_PATH_TEXT = `${OUTPUT_DESTINATION.live.parentFolder} > ${OUTPUT_DESTINATION.live.requestsFolder}`;

/** Where the administrator files a processed request. The app writes nothing there. */
export const FILING_PLACE_TEXT = 'Internal Records > Accounting and Receipts';
