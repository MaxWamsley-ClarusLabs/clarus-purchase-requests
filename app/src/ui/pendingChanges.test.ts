import { line, request } from '../testing/builders';
import { NO_CHANGES, addChanges, forRows, hasChanges, savesNotYetRead, withChanges } from './pendingChanges';

describe('changes made on screen and not yet read back', () => {
  it('knows when there is nothing to save', () => {
    expect(hasChanges(NO_CHANGES)).toBe(false);
    expect(hasChanges({ request: {}, lines: { a: { vendor: 'Acme' } } })).toBe(true);
    expect(hasChanges({ request: { department: 'R&D' }, lines: {} })).toBe(true);
  });

  it('keeps the later value of a field changed twice, and every other field', () => {
    const merged = addChanges(
      { request: { department: 'R&D' }, lines: { a: { vendor: 'Acme', amountCents: 100 } } },
      { request: { businessPurpose: 'Supplies' }, lines: { a: { amountCents: 250 }, b: { date: '2026-10-14' } } }
    );
    expect(merged).toEqual({
      request: { department: 'R&D', businessPurpose: 'Supplies' },
      lines: { a: { vendor: 'Acme', amountCents: 250 }, b: { date: '2026-10-14' } }
    });
  });

  it('puts the changes back on top of what was read, oldest first, and leaves out deleted rows', () => {
    const read = [line({ id: 'a', rowNumber: 1, amountCents: 8645 }), line({ id: 'c', rowNumber: 2, vendor: 'New row', amountCents: null })];
    const shown = withChanges(request({ businessPurpose: 'Old' }), read, [
      { request: { businessPurpose: 'Saving' }, lines: { a: { amountCents: 100 }, b: { vendor: 'Deleted row' } } },
      { request: {}, lines: { a: { amountCents: 12345 } } }
    ]);
    expect(shown.request.businessPurpose).toBe('Saving');
    expect(shown.lines.map((l) => [l.id, l.amountCents, l.vendor])).toEqual([
      ['a', 12345, read[0].vendor],
      ['c', null, 'New row']
    ]);
    // What was read is not changed.
    expect(read[0].amountCents).toBe(8645);
  });

  it('drops the changes for rows that no longer exist', () => {
    expect(forRows({ request: { department: 'R&D' }, lines: { a: { vendor: 'A' }, b: { vendor: 'B' } } }, new Set(['a']))).toEqual({
      request: { department: 'R&D' },
      lines: { a: { vendor: 'A' } }
    });
  });

  it('counts a save as not yet read if it was running when the read started, or finished after', () => {
    const save = (finishedAt: number | null, vendor: string) => ({ changes: { request: {}, lines: { a: { vendor } } }, finishedAt });
    const saves = [save(3, 'finished before the read'), save(7, 'finished during the read'), save(null, 'still running')];
    expect(savesNotYetRead(saves, 5).map((c) => c.lines.a.vendor)).toEqual(['finished during the read', 'still running']);
  });
});
