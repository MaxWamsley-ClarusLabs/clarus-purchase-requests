import { GRID_CARD_EXTRA_PX, GRID_MIN_WIDTH_PX, LAYOUT_GAP_PX, SIDE_FILES_WIDTH_PX, THEME_CSS, filesBesideGrid } from './theme';

describe('where the files sit on the Purchases step (travel D-033)', () => {
  const needed = GRID_MIN_WIDTH_PX + GRID_CARD_EXTRA_PX + LAYOUT_GAP_PX + SIDE_FILES_WIDTH_PX;

  it('puts the files beside the grid only when the grid keeps its full width', () => {
    expect(needed).toBe(1474);
    expect(filesBesideGrid(needed, false)).toBe(true);
    expect(filesBesideGrid(needed - 1, false)).toBe(false);
    // A 1600-pixel window with the full sidebar leaves 1288 pixels: the files slide over the page.
    expect(filesBesideGrid(1288, false)).toBe(false);
    // A 1920-pixel window leaves 1608.
    expect(filesBesideGrid(1608, false)).toBe(true);
  });

  it('keeps them beside the grid while a scroll bar comes and goes', () => {
    expect(filesBesideGrid(needed - 17, true)).toBe(true);
    expect(filesBesideGrid(needed - 25, true)).toBe(false);
  });

  it('uses the same widths as the stylesheet', () => {
    expect(THEME_CSS).toContain(`min-width: ${GRID_MIN_WIDTH_PX}px`);
    expect(THEME_CSS).toContain(`grid-template-columns: minmax(0, 1fr) ${SIDE_FILES_WIDTH_PX}px; gap: ${LAYOUT_GAP_PX}px`);
  });
});
