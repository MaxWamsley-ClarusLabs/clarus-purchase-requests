// Keeps docs/SOP.md Part A identical to the in-app Instructions (D-036).
// "npm run sop" rewrites Part A from the app text; otherwise this test fails
// when they differ, so a wording change is never made in only one place.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { instructionsMarkdown } from '../../src/content/instructions';

const SOP_PATH = fileURLToPath(new URL('../../../docs/SOP.md', import.meta.url));
const START = '<!-- Part A starts: generated from app/src/content/instructions.ts by "npm run sop". Edit the app text, not this block. -->';
const END = '<!-- Part A ends -->';

describe('docs/SOP.md Part A', () => {
  it('matches the in-app Instructions', () => {
    const sop = readFileSync(SOP_PATH, 'utf8');
    const start = sop.indexOf(START);
    const end = sop.indexOf(END);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const expected = `${START}\n\n${instructionsMarkdown()}\n${END}`;
    const current = sop.slice(start, end + END.length);
    if (process.env.UPDATE_SOP === '1' && current !== expected) {
      writeFileSync(SOP_PATH, sop.slice(0, start) + expected + sop.slice(end + END.length));
      return;
    }
    expect(current).toBe(expected);
  });
});
