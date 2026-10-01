// Changes made on screen that what is read back may not hold yet (travel
// D-033 automatic saving). A request is read back after a row is added or
// deleted or a file is attached; anything typed meanwhile is either waiting
// for the save delay or being saved, and the screen must go on showing it, so
// that it always shows what is saved, or is about to be. Pure functions.

import { LineChanges, RequestChanges } from '../data/PurchaseDataService';
import { PurchaseLine, PurchaseRequest } from '../domain/types';

/** Changes to a request and its rows, by row ID. */
export interface ChangeSet {
  request: RequestChanges;
  lines: Record<string, LineChanges>;
}

export const NO_CHANGES: ChangeSet = { request: {}, lines: {} };

export function hasChanges(changes: ChangeSet): boolean {
  return Object.keys(changes.request).length > 0 || Object.keys(changes.lines).length > 0;
}

/** `later` on top of `earlier`: a field changed in both keeps the later value. */
export function addChanges(earlier: ChangeSet, later: ChangeSet): ChangeSet {
  const lines: Record<string, LineChanges> = { ...earlier.lines };
  for (const [id, changes] of Object.entries(later.lines)) lines[id] = { ...lines[id], ...changes };
  return { request: { ...earlier.request, ...later.request }, lines };
}

/** The changes without those for rows that no longer exist. */
export function forRows(changes: ChangeSet, lineIds: ReadonlySet<string>): ChangeSet {
  const lines: Record<string, LineChanges> = {};
  for (const [id, c] of Object.entries(changes.lines)) if (lineIds.has(id)) lines[id] = c;
  return { request: changes.request, lines };
}

/**
 * What the screen shows after reading a request back: the request and rows as
 * read, with the changes made on screen put back on top, oldest first.
 * Changes to rows that no longer exist are left out.
 */
export function withChanges(
  request: PurchaseRequest,
  lines: readonly PurchaseLine[],
  changes: readonly ChangeSet[]
): { request: PurchaseRequest; lines: PurchaseLine[] } {
  const all = changes.reduce(addChanges, NO_CHANGES);
  return {
    request: { ...request, ...all.request },
    lines: lines.map((l) => (all.lines[l.id] ? { ...l, ...all.lines[l.id] } : l))
  };
}

/** A save started from the screen: the changes it writes, and when it finished (null while it runs). */
export interface SaveRecord {
  changes: ChangeSet;
  finishedAt: number | null;
}

/**
 * The saves that a request read back may not hold yet: those still running
 * when it started to be read, or started since. `readStartedAt` and
 * `finishedAt` are counts from one counter, so the order of events is known.
 */
export function savesNotYetRead(saves: readonly SaveRecord[], readStartedAt: number): ChangeSet[] {
  return saves.filter((s) => s.finishedAt === null || s.finishedAt > readStartedAt).map((s) => s.changes);
}
