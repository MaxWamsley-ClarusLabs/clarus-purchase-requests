// Whether the site has its three lists, with every column and setting the app
// needs (travel D-063). Shared by the SharePoint and mock data services.

export type SetupListKey = 'requests' | 'lines' | 'submissions';

export interface ListCheck {
  key: SetupListKey;
  title: string;
  exists: boolean;
  /** The list's address on the site, for example Lists/PurchaseRequests. */
  address: string;
  /**
   * A list exists at this address but was not made by this app. Set-up does
   * not change it (travel D-077).
   */
  notOurs: boolean;
  /** The list's ID, used by the flow package (travel D-047). */
  listId: string;
  missingFields: string[];
  missingChoices: string[];
  unindexedFields: string[];
  /** Employees see and edit only their own items (travel D-003). */
  ownItemsOnly: boolean;
  versioning: boolean;
  attachments: boolean;
}

export interface SetupStatus {
  /** True when every list exists with all its columns and settings. */
  ready: boolean;
  lists: ListCheck[];
}

export function isReady(lists: readonly ListCheck[]): boolean {
  return lists.every(
    (l) =>
      l.exists &&
      !l.notOurs &&
      l.missingFields.length === 0 &&
      l.missingChoices.length === 0 &&
      l.unindexedFields.length === 0 &&
      l.ownItemsOnly &&
      l.versioning &&
      l.attachments
  );
}
