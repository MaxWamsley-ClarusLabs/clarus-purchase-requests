import { asSentence, listText } from './text';

describe('wording helpers', () => {
  it('lists names in plain English', () => {
    expect(listText([])).toBe('');
    expect(listText(['Acme Lab Supply'])).toBe('Acme Lab Supply');
    expect(listText(['Acme Lab Supply', 'Northwind Office Supply'])).toBe('Acme Lab Supply and Northwind Office Supply');
    expect(listText(['A', 'B', 'C'])).toBe('A, B and C');
  });

  it('ends a typed note with a full stop only when it has no ending of its own', () => {
    expect(asSentence('Checkpoint note')).toBe('Checkpoint note.');
    expect(asSentence('  OK, go ahead.  ')).toBe('OK, go ahead.');
    expect(asSentence('Is the second quote coming?')).toBe('Is the second quote coming?');
    expect(asSentence('Buy it now!')).toBe('Buy it now!');
    expect(asSentence('Use the "blue card."')).toBe('Use the "blue card."');
    expect(asSentence('(Use the company card.)')).toBe('(Use the company card.)');
    expect(asSentence('   ')).toBe('');
  });
});
