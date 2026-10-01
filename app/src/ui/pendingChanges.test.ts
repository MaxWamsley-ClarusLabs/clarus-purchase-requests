import { line, request } from '../testing/builders';
import { NO_CHANGES, SaveQueue, addChanges, changeAsKept, forRows, hasChanges, keptAsSent, savesNotYetRead, withChanges } from './pendingChanges';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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

describe('saving one change after another', () => {
  it('runs each save after the one before it has finished, even when the first is slower', async () => {
    const queue = new SaveQueue();
    const events: string[] = [];
    const job = (name: string, ms: number) => async () => {
      events.push(`${name} starts`);
      await wait(ms);
      events.push(`${name} ends`);
    };
    queue.add(job('category Other', 30));
    queue.add(job('its description', 1));
    await queue.idle();
    expect(events).toEqual(['category Other starts', 'category Other ends', 'its description starts', 'its description ends']);
  });

  it('waits for the save running and the saves waiting, not for those added later', async () => {
    const queue = new SaveQueue();
    const done: string[] = [];
    queue.add(async () => {
      await wait(20);
      done.push('running');
    });
    queue.add(async () => {
      done.push('waiting');
    });
    const idle = queue.idle().then(() => [...done]);
    queue.add(async () => {
      await wait(5);
      done.push('added later');
    });
    expect(await idle).toEqual(['running', 'waiting']);
    await queue.idle();
    expect(done).toEqual(['running', 'waiting', 'added later']);
  });

  it('goes on after a save that fails, and never rejects', async () => {
    const queue = new SaveQueue();
    const done: string[] = [];
    queue.add(async () => {
      throw new Error('The network is down.');
    });
    queue.add(() => {
      throw new Error('Failed before it began.');
    });
    queue.add(async () => {
      done.push('next save');
    });
    await expect(queue.idle()).resolves.toBeUndefined();
    expect(done).toEqual(['next save']);
  });

  it('waits for nothing when there is nothing to save', async () => {
    await expect(new SaveQueue().idle()).resolves.toBeUndefined();
  });
});

describe('a category change as the data layer keeps it (P-024)', () => {
  const other = line({ category: 'other', categoryOther: 'Lab safety audit' });

  it('clears the description when the new category needs none', () => {
    expect(changeAsKept(other, { category: 'office' })).toEqual({ category: 'office', categoryOther: '' });
    expect(changeAsKept(other, { category: '' })).toEqual({ category: '', categoryOther: '' });
    expect(changeAsKept(line({ category: 'office', categoryOther: 'Left over' }), { categoryOther: 'Typed' })).toEqual({ categoryOther: '' });
  });

  it('leaves every other change as it is', () => {
    expect(changeAsKept(other, { category: 'other' })).toEqual({ category: 'other' });
    expect(changeAsKept(other, { categoryOther: 'Lab furniture' })).toEqual({ categoryOther: 'Lab furniture' });
    expect(changeAsKept(other, { vendor: 'Acme Lab Supply' })).toEqual({ vendor: 'Acme Lab Supply' });
    expect(changeAsKept(line({ category: 'office', categoryOther: '' }), { category: 'rdMaterials' })).toEqual({ category: 'rdMaterials' });
  });
});

describe('what the data layer kept', () => {
  const stored = line({ category: 'office', categoryOther: '', vendor: 'Acme Lab Supply', suggested: ['date', 'amount'] });

  it('knows a change was kept as sent', () => {
    expect(keptAsSent({ category: 'office', categoryOther: '' }, stored)).toBe(true);
    expect(keptAsSent({ vendor: 'Acme Lab Supply' }, stored)).toBe(true);
    expect(keptAsSent({ businessPurpose: 'Supplies' }, request({ businessPurpose: 'Supplies' }))).toBe(true);
  });

  it('notices a description the data layer cleared, or text it cut', () => {
    expect(keptAsSent({ categoryOther: 'Lab safety audit' }, stored)).toBe(false);
    expect(keptAsSent({ vendor: 'Acme Lab Supply, the long name' }, stored)).toBe(false);
  });

  it('compares lists by what they hold, in any order, and ignores a field sent as undefined', () => {
    expect(keptAsSent({ suggested: ['amount', 'date'] }, stored)).toBe(true);
    expect(keptAsSent({ suggested: ['amount'] }, stored)).toBe(false);
    expect(keptAsSent({ vendor: undefined, category: 'office' }, stored)).toBe(true);
  });
});
