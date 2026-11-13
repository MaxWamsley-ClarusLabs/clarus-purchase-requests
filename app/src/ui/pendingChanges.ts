// Changes made on screen that what is read back may not hold yet (travel
// D-033 automatic saving). A request is read back after a row is added or
// deleted or a file is attached; anything typed meanwhile is either waiting
// for the save delay or being saved, and the screen must go on showing it, so
// that it always shows what is saved, or is about to be. Saves run one after
// another (SaveQueue). Pure functions, and a queue with no React in it.

import { LineChanges, RequestChanges } from '../data/PurchaseDataService';
import { categoryNeedsDescription } from '../domain/purchaseRules';
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

/**
 * A change to a row as the data layer will keep it (P-024): only a category
 * that needs a description (Other) keeps one, so a change to another category
 * clears the row's description in the same change. The screen then shows the
 * description empty, as it is saved, instead of keeping one that is not.
 */
export function changeAsKept(line: Pick<PurchaseLine, 'category' | 'categoryOther'>, changes: LineChanges): LineChanges {
  if (changes.category === undefined && changes.categoryOther === undefined) return changes;
  const category = changes.category ?? line.category;
  const description = changes.categoryOther ?? line.categoryOther;
  return !categoryNeedsDescription(category) && description !== '' ? { ...changes, categoryOther: '' } : changes;
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

/**
 * Runs jobs one after another, in the order they were added, so two saves of
 * one row are written in the order they were made, and each is judged against
 * what the one before it wrote. A job that fails does not stop the ones after it.
 */
export class SaveQueue {
  private last: Promise<void> = Promise.resolve();

  /** Adds a job. It starts once every job added before it has finished. */
  add(job: () => Promise<unknown>): void {
    this.last = this.last.then(job).then(
      () => undefined,
      () => undefined
    );
  }

  /** Resolves once every job added so far has finished, those running and those waiting. Never rejects. */
  idle(): Promise<void> {
    return this.last;
  }
}

/** Two stored values are the same; lists are the same when they hold the same items, in any order. */
function sameValue(sent: unknown, kept: unknown): boolean {
  if (Array.isArray(sent) && Array.isArray(kept)) return sent.length === kept.length && sent.every((item) => kept.includes(item));
  return sent === kept;
}

/**
 * Whether the data layer kept each field of a change as it was sent. It may
 * keep something else, such as text cut to the length a column holds, or a
 * category description it cleared because the category needs none; the
 * screen then reads back what is saved. A field sent as undefined is not a change.
 */
export function keptAsSent(sent: object, kept: object): boolean {
  const stored = kept as Record<string, unknown>;
  return Object.entries(sent).every(([field, value]) => value === undefined || sameValue(value, stored[field]));
}
