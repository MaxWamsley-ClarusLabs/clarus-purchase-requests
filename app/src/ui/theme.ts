// The KFA look (docs/design-reference/kfa_design_summary.md), re-created for
// this app (D-032, D-033). Injected once as a <style> element, as KFA does.
// Every rule is scoped under .ctx-app so nothing leaks into SharePoint pages.

/**
 * The purchases grid's narrowest width. On a narrower screen the grid scrolls
 * sideways inside its card, and its last column, the row menu, stays in view.
 */
export const GRID_MIN_WIDTH_PX = 1090;
/** What the grid's card adds around the grid: its padding and border, less the grid's own negative margins. */
export const GRID_CARD_EXTRA_PX = 26;
/** The files panel beside the grid on a wide screen, and the gap between them. */
export const SIDE_FILES_WIDTH_PX = 340;
export const LAYOUT_GAP_PX = 18;
/**
 * A little more than a scroll bar's width. Files already beside the grid stay
 * there until the space shrinks by more than this, so a scroll bar that comes
 * and goes as the page changes height cannot flip the layout back and forth.
 */
const SIDE_FILES_ALLOWANCE_PX = 24;

/**
 * Whether the files sit beside the grid (travel D-033), which they do only
 * when the grid keeps its full width there; otherwise they slide over the
 * page. `layoutWidth` is the measured width of the area that holds both;
 * `besideNow` says whether they are beside the grid now.
 */
export function filesBesideGrid(layoutWidth: number, besideNow: boolean): boolean {
  const needed = GRID_MIN_WIDTH_PX + GRID_CARD_EXTRA_PX + LAYOUT_GAP_PX + SIDE_FILES_WIDTH_PX;
  return layoutWidth >= needed || (besideNow && layoutWidth >= needed - SIDE_FILES_ALLOWANCE_PX);
}

export const THEME_CSS = `
.ctx-app {
  --c-purple: #70388D;
  --c-dark-purple: #3B1E4D;
  --c-lavender: #EFE6F7;
  --c-light-lavender: #F8F5FB;
  --c-accent: #C9A3E6;
  --c-text: #24142F;
  --c-muted: #6B5B73;
  --c-card: #FFFFFF;
  --c-border: #E7DDF0;
  --c-success: #1F8A5B;
  --c-warning: #B7791F;
  --c-error: #B42318;
  --shadow-card: 0 18px 46px rgba(59, 30, 77, 0.10);
  --shadow-header: 0 18px 44px rgba(59, 30, 77, 0.08);
  font-family: Inter, "Segoe UI", Arial, sans-serif;
  color: var(--c-text);
  font-size: 14px;
  line-height: 1.45;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  min-height: 100vh;
  background: #130d1c;
  box-sizing: border-box;
}
.ctx-app *, .ctx-app *::before, .ctx-app *::after { box-sizing: border-box; }
.ctx-app.ctx-collapsed { grid-template-columns: 76px minmax(0, 1fr); }
.ctx-app button { font-family: inherit; }

/* Sidebar */
.ctx-sidebar {
  background: linear-gradient(180deg, #1a1025 0%, #28183b 100%);
  padding: 24px 16px; display: flex; flex-direction: column; gap: 16px;
  border-right: 1px solid rgba(231, 221, 240, 0.16);
  box-shadow: 8px 0 28px rgba(0, 0, 0, 0.24);
  color: #fff; position: sticky; top: 0; height: 100vh; overflow-y: auto;
}
.ctx-brand { display: flex; align-items: center; gap: 12px; padding: 0 4px; }
.ctx-brand img { width: 40px; height: 40px; flex: none; }
.ctx-brand-title { font-weight: 800; font-size: 1.25rem; line-height: 1.1; }
.ctx-brand-subtitle { font-size: 0.8rem; color: rgba(255, 255, 255, 0.72); }
.ctx-nav-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.07em; color: rgba(255, 255, 255, 0.55); font-weight: 800; margin: 6px 6px 0; overflow-wrap: break-word; }
.ctx-nav { display: flex; flex-direction: column; gap: 8px; }
.ctx-nav-item {
  display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
  padding: 10px 12px; border-radius: 14px; color: #fff; cursor: pointer;
  background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(231, 221, 240, 0.08);
  border-left: 4px solid transparent; font-size: 0.9rem;
}
.ctx-nav-item:hover { background: rgba(255, 255, 255, 0.09); }
.ctx-nav-item.active { background: rgba(112, 56, 141, 0.54); border-left-color: var(--c-accent); }
.ctx-nav-item:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 1px; }
.ctx-nav-icon { width: 26px; height: 26px; border-radius: 999px; display: grid; place-items: center; flex: none; background: rgba(255, 255, 255, 0.12); font-weight: 800; font-size: 0.8rem; color: #fff; }
.ctx-nav-item.done .ctx-nav-icon { background: rgba(31, 138, 91, 0.9); }
.ctx-nav-item.attention .ctx-nav-icon { background: rgba(183, 121, 31, 0.95); }
.ctx-nav-text { display: flex; flex-direction: column; min-width: 0; }
.ctx-nav-name { font-weight: 800; }
.ctx-nav-status { font-size: 0.76rem; color: rgba(255, 255, 255, 0.72); }
.ctx-nav-count { margin-left: auto; background: var(--c-accent); color: var(--c-text); border-radius: 999px; padding: 1px 8px; font-size: 0.72rem; font-weight: 800; }
.ctx-sidebar-footer { margin-top: auto; display: flex; flex-direction: column; gap: 10px; }
.ctx-user { font-size: 0.8rem; color: rgba(255, 255, 255, 0.72); padding: 0 6px; }
.ctx-user strong { color: #fff; display: block; font-size: 0.86rem; }
.ctx-collapsed .ctx-hide-collapsed { display: none !important; }
.ctx-collapsed .ctx-sidebar { padding: 24px 10px; align-items: center; }
.ctx-collapsed .ctx-nav-item { justify-content: center; padding: 10px 6px; }

/* Main area */
.ctx-main { background: var(--c-light-lavender); padding: 22px 26px; min-width: 0; display: flex; flex-direction: column; gap: 18px; }
.ctx-header {
  background: rgba(255, 255, 255, 0.88); backdrop-filter: blur(12px);
  border: 1px solid var(--c-border); border-radius: 18px; min-height: 72px;
  box-shadow: var(--shadow-header); padding: 14px 20px;
  display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
}
/* The title may shrink below its longest word, so a very long one breaks instead of widening the page */
.ctx-header > div:first-child { min-width: 0; }
.ctx-page-title { font-size: 1.3rem; font-weight: 800; margin: 0; line-height: 1.2; overflow-wrap: break-word; }
.ctx-page-subtitle { font-size: 0.86rem; color: var(--c-muted); margin-top: 2px; overflow-wrap: break-word; }
.ctx-header-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-left: auto; }
.ctx-saved { font-size: 0.8rem; color: var(--c-muted); display: inline-flex; align-items: center; gap: 6px; }
.ctx-saved-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--c-success); }
.ctx-saved.saving .ctx-saved-dot { background: var(--c-warning); }

/* Buttons */
.ctx-btn { border: none; border-radius: 12px; font-weight: 700; font-size: 0.9rem; padding: 9px 16px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; white-space: nowrap; line-height: 1.2; }
.ctx-btn-primary { background: var(--c-purple); color: #fff; box-shadow: 0 10px 24px rgba(112, 56, 141, 0.24); }
.ctx-btn-primary:hover:not(:disabled) { background: #5f2e78; }
.ctx-btn-secondary { background: var(--c-lavender); color: var(--c-purple); }
.ctx-btn-secondary:hover:not(:disabled) { background: #e5d6f2; }
.ctx-btn-danger { background: var(--c-error); color: #fff; }
.ctx-btn-ghost { background: transparent; color: var(--c-purple); padding: 6px 10px; }
.ctx-btn-ghost:hover:not(:disabled) { background: var(--c-lavender); }
.ctx-btn-small { padding: 6px 11px; font-size: 0.8rem; border-radius: 10px; }
.ctx-btn:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
.ctx-btn:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 2px; }
.ctx-btn-sidebar { background: rgba(255, 255, 255, 0.08); color: #fff; width: 100%; justify-content: center; }

/* Badges */
.ctx-badge { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 4px 11px; font-weight: 700; font-size: 0.8rem; white-space: nowrap; }
.ctx-badge.lavender { background: var(--c-lavender); color: var(--c-purple); }
.ctx-badge.purple { background: var(--c-purple); color: #fff; }
.ctx-badge.amber { background: #fff7e6; color: var(--c-warning); }
.ctx-badge.green { background: #e7f6ee; color: var(--c-success); }
.ctx-badge.red { background: #fdecea; color: var(--c-error); }
.ctx-tag { display: inline-flex; align-items: center; border-radius: 999px; padding: 2px 8px; font-weight: 700; font-size: 0.7rem; white-space: nowrap; }
.ctx-tag.amber { background: #fff7e6; color: var(--c-warning); border: 1px solid #f3dcae; }
.ctx-tag.lavender { background: var(--c-lavender); color: var(--c-purple); }

/* Cards and totals */
/* A very long word (a name typed without spaces) breaks where it must, so it cannot widen the page. Other text wraps as
   before: break-word, unlike anywhere, does not let a box or a table column shrink below its longest word. */
.ctx-card { background: var(--c-card); border: 1px solid var(--c-border); border-radius: 20px; box-shadow: var(--shadow-card); padding: 18px 20px; min-width: 0; overflow-wrap: break-word; }
.ctx-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.ctx-card-title { font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-muted); margin: 0; }
.ctx-totals { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.ctx-metric { background: linear-gradient(180deg, #fff 0%, #fbf7ff 100%); border: 1px solid var(--c-border); border-radius: 18px; padding: 12px 16px; box-shadow: 0 10px 26px rgba(59, 30, 77, 0.06); min-width: 0; overflow-wrap: break-word; }
.ctx-metric .ctx-badge { white-space: normal; }
.ctx-metric-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--c-muted); font-weight: 700; }
/* An amount is never broken across lines */
.ctx-metric-value { font-size: 1.2rem; font-weight: 800; margin-top: 2px; font-variant-numeric: tabular-nums; overflow-wrap: normal; }
.ctx-metric-note { font-size: 0.74rem; color: var(--c-muted); }
.ctx-metric.attention .ctx-metric-value { color: var(--c-error); }
.ctx-metric.clear .ctx-metric-value { color: var(--c-success); }

/* Forms */
.ctx-field-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 16px; }
.ctx-span-2 { grid-column: 1 / -1; }
.ctx-field label, .ctx-label { display: block; font-size: 0.78rem; font-weight: 700; color: var(--c-muted); margin-bottom: 6px; }
.ctx-input, .ctx-select, .ctx-textarea { width: 100%; border: 1px solid var(--c-border); border-radius: 10px; padding: 9px 11px; font: inherit; font-size: 0.92rem; color: var(--c-text); background: #fff; }
.ctx-textarea { min-height: 74px; resize: vertical; }
.ctx-input:focus, .ctx-select:focus, .ctx-textarea:focus { outline: none; border-color: var(--c-purple); box-shadow: 0 0 0 3px rgba(201, 163, 230, 0.45); }
.ctx-input.blocking, .ctx-select.blocking, .ctx-textarea.blocking { border-color: var(--c-error); background: #fff8f7; }
.ctx-field-error { color: var(--c-error); font-size: 0.78rem; margin-top: 5px; }
.ctx-hint { font-size: 0.8rem; color: var(--c-muted); }
.ctx-static { border: 1px solid var(--c-border); border-radius: 10px; padding: 9px 11px; font-size: 0.92rem; background: var(--c-light-lavender); color: var(--c-text); min-height: 40px; overflow-wrap: anywhere; }
.ctx-quick-picks { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
.ctx-quick-picks .ctx-btn { white-space: normal; text-align: left; }
.ctx-plain-list { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; font-size: 0.9rem; }
.ctx-choice-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.ctx-choice { border: 1px solid var(--c-border); border-radius: 12px; padding: 10px 12px; cursor: pointer; display: flex; gap: 10px; align-items: flex-start; background: #fff; text-align: left; font: inherit; color: inherit; }
.ctx-choice:hover { border-color: var(--c-accent); }
.ctx-choice-list { display: grid; gap: 8px; }
.ctx-choice-list .ctx-choice input { margin-top: 3px; accent-color: var(--c-purple); flex: none; }
.ctx-choice.selected { border-color: var(--c-purple); background: var(--c-lavender); }
.ctx-choice-dot { width: 16px; height: 16px; border-radius: 999px; border: 2px solid var(--c-accent); flex: none; margin-top: 2px; }
.ctx-choice.selected .ctx-choice-dot { border-color: var(--c-purple); background: radial-gradient(circle, var(--c-purple) 45%, transparent 50%); }
.ctx-choice-label { font-weight: 700; font-size: 0.88rem; }
.ctx-choice-sub { font-size: 0.76rem; color: var(--c-muted); }

/* Receipt drop box: on a narrow screen the button goes under the text */
.ctx-drop { border: 1.5px dashed var(--c-accent); border-radius: 16px; padding: 16px 18px; display: flex; align-items: center; gap: 12px 16px; background: #fcf9fe; flex-wrap: wrap; }
.ctx-drop-body { flex: 1 1 240px; min-width: 0; }
.ctx-drop.over { background: var(--c-lavender); border-color: var(--c-purple); }
.ctx-drop-icon { width: 44px; height: 44px; border-radius: 14px; background: var(--c-lavender); color: var(--c-purple); display: grid; place-items: center; flex: none; }
.ctx-drop-title { font-weight: 800; font-size: 0.95rem; }
.ctx-drop-kind { display: flex; align-items: center; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
.ctx-drop-note { margin-top: 6px; color: #7a4f12; font-weight: 600; }
.ctx-segmented { display: inline-flex; background: var(--c-lavender); border-radius: 999px; padding: 3px; gap: 2px; max-width: 100%; }
.ctx-segmented button { border: none; background: transparent; border-radius: 999px; padding: 5px 13px; font-weight: 700; font-size: 0.8rem; color: var(--c-purple); cursor: pointer; }
.ctx-segmented button[aria-checked="true"] { background: var(--c-purple); color: #fff; }
.ctx-segmented button:focus-visible { outline: 2px solid var(--c-accent); outline-offset: 2px; }

/* Expense grid */
.ctx-expenses-layout { display: grid; grid-template-columns: minmax(0, 1fr) ${SIDE_FILES_WIDTH_PX}px; gap: ${LAYOUT_GAP_PX}px; align-items: start; }
.ctx-expenses-layout.no-preview { grid-template-columns: minmax(0, 1fr); }
.ctx-grid-wrap { overflow-x: auto; margin: 0 -8px; }
table.ctx-grid { width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 0; min-width: ${GRID_MIN_WIDTH_PX}px; font-size: 0.86rem; }
/* The row menu column stays at the right edge of the grid when the grid scrolls sideways, so the menu can always be reached */
.ctx-grid thead th:last-child, .ctx-grid tr.ctx-row > td:last-child { position: sticky; right: 0; background: var(--c-card); }
.ctx-grid tr.ctx-row.selected > td:last-child { background: #faf5fd; }
.ctx-grid-wrap.scrolls thead th:last-child, .ctx-grid-wrap.scrolls tr.ctx-row > td:last-child { box-shadow: -8px 0 8px -8px rgba(59, 30, 77, 0.28); }
/* The open menu sits over the rows below it, so its cell is lifted above theirs */
.ctx-grid tr.ctx-row > td.menu-open { z-index: 31; }
.ctx-grid th { text-align: left; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--c-muted); font-weight: 800; padding: 8px 6px; border-bottom: 1px solid var(--c-border); background: #fff; vertical-align: bottom; }
.ctx-grid td { padding: 4px 3px; border-bottom: 1px solid #f3edf8; vertical-align: middle; }
.ctx-grid tr.ctx-row td:first-child { padding-left: 8px; }
.ctx-grid tr.ctx-row.selected td { background: #faf5fd; }
.ctx-grid tr.ctx-row.has-issues td { border-bottom: none; }
.ctx-row-num { font-weight: 800; color: var(--c-muted); font-size: 0.8rem; width: 28px; }
.ctx-cell { width: 100%; border: 1px solid transparent; border-radius: 8px; padding: 6px 7px; font: inherit; font-size: 0.86rem; background: transparent; color: var(--c-text); min-height: 32px; }
.ctx-cell:hover:not(:disabled) { border-color: var(--c-border); background: #fff; }
.ctx-cell:focus { border-color: var(--c-purple); background: #fff; outline: none; box-shadow: 0 0 0 2px rgba(201, 163, 230, 0.5); }
.ctx-cell.suggested { border: 1px dashed #e0a64b; background: #fff4de; }
.ctx-cell.blocking { border-color: var(--c-error); background: #fff8f7; }
.ctx-cell.warning { border-color: var(--c-warning); background: #fffaf0; }
.ctx-cell:disabled { color: var(--c-text); -webkit-text-fill-color: var(--c-text); opacity: 1; }
.ctx-cell.amount { text-align: right; font-variant-numeric: tabular-nums; }
select.ctx-cell { cursor: pointer; appearance: auto; }
/* A drop-down that shows its choice in full (FullTextSelect): the text wraps, and the browser's drop-down sits on top, transparent */
.ctx-fullselect { position: relative; display: flex; align-items: center; padding-right: 22px; cursor: pointer; }
.ctx-fullselect::after { content: ''; position: absolute; right: 9px; top: 50%; width: 6px; height: 6px; margin-top: -5px; border-right: 1.5px solid currentColor; border-bottom: 1.5px solid currentColor; transform: rotate(45deg); opacity: 0.75; pointer-events: none; }
.ctx-fullselect.disabled { cursor: default; }
.ctx-fullselect.disabled::after { display: none; }
.ctx-fullselect-text { line-height: 1.25; overflow-wrap: break-word; min-width: 0; }
.ctx-fullselect-text.unchosen { color: var(--c-muted); }
.ctx-fullselect-native { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; font: inherit; border: 0; margin: 0; }
.ctx-fullselect-native:disabled { cursor: default; }
.ctx-fullselect.ctx-cell { padding-right: 22px; }
.ctx-fullselect.ctx-cell.disabled:hover { border-color: transparent; background: transparent; }
.ctx-fullselect.ctx-cell:focus-within { border-color: var(--c-purple); background: #fff; box-shadow: 0 0 0 2px rgba(201, 163, 230, 0.5); }
.ctx-fullselect.ctx-box { border: 1px solid var(--c-border); border-radius: 10px; padding: 6px 24px 6px 8px; font-size: 0.84rem; background: #fff; min-height: 34px; }
.ctx-fullselect.ctx-box:focus-within { border-color: var(--c-purple); box-shadow: 0 0 0 3px rgba(201, 163, 230, 0.45); }
.ctx-row-issues td { padding: 0 8px 8px 44px; font-size: 0.78rem; border-bottom: 1px solid #f3edf8; }
.ctx-issue-line { display: flex; gap: 6px; align-items: flex-start; }
.ctx-issue-line svg { flex-shrink: 0; }
/* Text that can hold a typed name may shrink below its longest word, so a very long word breaks instead of pushing out of its box */
.ctx-issue-line > span, .ctx-issue-item > .ctx-issue-line, .ctx-vendor-head > :first-child, .ctx-send-list li > :first-child { min-width: 0; }
.ctx-issue-line.blocking { color: var(--c-error); }
.ctx-issue-line.warning { color: var(--c-warning); }
.ctx-suggest-note { display: inline-flex; gap: 10px; align-items: center; flex-wrap: wrap; color: #8a5a12; background: #fff4de; border-radius: 8px; padding: 3px 4px 3px 8px; margin-bottom: 4px; }
.ctx-reading { display: inline-flex; align-items: center; gap: 5px; margin-left: 6px; font-size: 0.74rem; color: var(--c-muted); white-space: nowrap; }
.ctx-reading::before { content: ''; width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--c-lavender); border-top-color: var(--c-purple); animation: ctx-spin 0.9s linear infinite; }
@keyframes ctx-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .ctx-reading::before { animation: none; } }
.ctx-receipt-chip { display: inline-flex; align-items: center; gap: 6px; background: var(--c-lavender); color: var(--c-purple); border: none; border-radius: 8px; padding: 5px 8px; font-size: 0.78rem; font-weight: 700; max-width: 100%; cursor: pointer; text-align: left; }
.ctx-receipt-chip:focus-visible { outline: 2px solid var(--c-purple); outline-offset: 1px; }
.ctx-cell.noreceipt { background: #fffaf0; border-left: 3px solid var(--c-warning); font-size: 0.76rem; padding-left: 5px; padding-right: 2px; }
.ctx-file-note { font-size: 0.78rem; line-height: 1.3; }
.ctx-receipt-chip span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ctx-receipt-chip.shared { background: #f4f0f8; color: var(--c-muted); }
.ctx-receipt-chip.missing { background: #fff7e6; color: var(--c-warning); }
.ctx-receipt-chip.quote { background: #fff7e6; color: #7a4f12; }
.ctx-receipt-chip strong { font-weight: 800; flex: none; }
.ctx-files-cell { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; max-width: 100%; }
.ctx-files-cell .ctx-reading { margin-left: 0; }
.ctx-approval-cell { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.ctx-approval-cell .ctx-badge, .ctx-approval-cell .ctx-tag { white-space: normal; }
.ctx-flag { display: inline-flex; vertical-align: middle; color: var(--c-warning); margin-left: 6px; }
.ctx-cell.category-other { margin-top: 4px; font-size: 0.8rem; border-color: var(--c-border); background: #fff; }
.ctx-menu-wrap { position: relative; }
.ctx-btn.ctx-row-menu-button { padding: 6px 5px; }
.ctx-menu { position: fixed; background: #fff; border: 1px solid var(--c-border); border-radius: 12px; box-shadow: 0 18px 44px rgba(59, 30, 77, 0.18); padding: 6px; z-index: 30; min-width: 250px; max-height: calc(100vh - 24px); overflow-y: auto; }
.ctx-menu button, .ctx-menu label { display: flex; align-items: center; gap: 8px; width: 100%; text-align: left; padding: 8px 10px; border-radius: 8px; background: none; border: none; font: inherit; font-size: 0.86rem; color: var(--c-text); cursor: pointer; }
.ctx-menu button:hover, .ctx-menu label:hover, .ctx-menu button:focus-visible, .ctx-menu label:focus-visible { background: var(--c-lavender); }
.ctx-menu button:disabled, .ctx-menu label[aria-disabled="true"], .ctx-menu select:disabled { opacity: 0.5; cursor: not-allowed; }
.ctx-menu button:disabled:hover, .ctx-menu label[aria-disabled="true"]:hover { background: none; }
.ctx-menu button:focus-visible, .ctx-menu label:focus-visible { outline: 2px solid var(--c-purple); outline-offset: -2px; }
.ctx-menu hr { border: none; border-top: 1px solid var(--c-border); margin: 4px 0; }
.ctx-menu .danger { color: var(--c-error); }
.ctx-grid-footer { display: flex; gap: 10px; margin-top: 12px; align-items: center; flex-wrap: wrap; }

/* Receipt preview: beside the grid on wide screens, sliding over it on narrower ones */
.ctx-preview { position: sticky; top: 22px; }
.ctx-preview-overlay { position: fixed; top: 0; right: 0; bottom: 0; width: min(460px, 94vw); z-index: 51; padding: 16px; overflow-y: auto; }
.ctx-preview-overlay .ctx-card { height: 100%; }
.ctx-preview-overlay .ctx-preview-frame { height: calc(100vh - 170px); }
.ctx-preview-frame { border: 1px solid var(--c-border); border-radius: 14px; overflow: hidden; background: #f4eff8; height: 460px; display: grid; place-items: center; }
.ctx-preview-frame img { max-width: 100%; max-height: 100%; object-fit: contain; }
.ctx-preview-frame iframe { width: 100%; height: 100%; border: 0; background: #fff; }
.ctx-preview-files { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.ctx-preview-file { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; padding: 6px 8px; border-radius: 8px; background: var(--c-light-lavender); cursor: pointer; border: 1px solid transparent; text-align: left; font: inherit; width: 100%; }
.ctx-preview-file.active { border-color: var(--c-accent); background: var(--c-lavender); }
.ctx-preview-file strong { font-weight: 800; color: #7a4f12; flex: none; }
.ctx-preview-file span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ctx-muted { color: var(--c-muted); }

/* Tables. A table too wide for its card scrolls inside it (ctx-table-wrap); before that,
   headers, badges and tags wrap, so the tables fit a laptop screen without scrolling. */
.ctx-table-wrap { overflow-x: auto; max-width: 100%; }
table.ctx-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.ctx-table th { text-align: left; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--c-muted); font-weight: 800; padding: 8px 10px; border-bottom: 1px solid var(--c-border); vertical-align: bottom; }
.ctx-table td { padding: 11px 10px; border-bottom: 1px solid #f3edf8; vertical-align: middle; overflow-wrap: break-word; }
/* One cell's text cannot take more than this much of its table's width, so one very long word breaks in its cell instead of widening the table */
.ctx-table:not(.nowrap) td { max-width: 36em; }
.ctx-table .ctx-badge, .ctx-table .ctx-tag { white-space: normal; border-radius: 12px; }
.ctx-nowrap { white-space: nowrap; }
.ctx-datetime { font-variant-numeric: tabular-nums; }
.ctx-table tr.clickable { cursor: pointer; }
.ctx-table tr.clickable:hover td { background: #faf5fd; }
.ctx-table tr.clickable:focus { outline: none; }
.ctx-table tr.clickable:focus-visible td { background: #f3eafa; box-shadow: inset 0 2px 0 var(--c-purple), inset 0 -2px 0 var(--c-purple); }
.ctx-table tr.clickable:focus-visible td:first-child { box-shadow: inset 2px 2px 0 var(--c-purple), inset 0 -2px 0 var(--c-purple); }
.ctx-table tr.clickable:focus-visible td:last-child { box-shadow: inset -2px 2px 0 var(--c-purple), inset 0 -2px 0 var(--c-purple); }
.ctx-table.compact th, .ctx-table.compact td { padding-left: 6px; padding-right: 6px; }
.ctx-table td.vendor-cell { min-width: 96px; }
.ctx-table.admin-purchases td.category-cell { min-width: 150px; }
.ctx-table.admin-purchases td.files-cell { min-width: 120px; }
.ctx-table.admin-purchases .ctx-receipt-chip { max-width: 180px; }
.ctx-table.admin-purchases td.approval-cell .ctx-badge { padding: 3px 9px; }
.ctx-table .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ctx-table td.nowrap, .ctx-table.nowrap td { white-space: nowrap; }
.ctx-strong { font-weight: 700; }

/* Banners, lists, layout helpers */
.ctx-banner { border-radius: 14px; padding: 12px 16px; font-size: 0.9rem; display: flex; gap: 10px; align-items: flex-start; overflow-wrap: break-word; }
.ctx-banner > div { min-width: 0; }
.ctx-banner > svg { flex: none; margin-top: 1px; }
.ctx-banner.amber { background: #fff7e6; color: #7a4f12; border: 1px solid #f3dcae; }
.ctx-banner.purple { background: var(--c-lavender); color: var(--c-dark-purple); border: 1px solid #e0cdef; }
.ctx-banner.red { background: #fdecea; color: #8c1d13; border: 1px solid #f5c7c1; }
.ctx-banner.green { background: #e7f6ee; color: #155f3f; border: 1px solid #bfe5d1; }
.ctx-two-col { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 18px; align-items: start; }
.ctx-stack { display: flex; flex-direction: column; gap: 18px; }
.ctx-row-flex { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.ctx-dl { display: grid; grid-template-columns: 170px minmax(0, 1fr); gap: 8px 14px; margin: 0; font-size: 0.9rem; }
.ctx-dl dt { color: var(--c-muted); font-weight: 700; font-size: 0.8rem; }
.ctx-dl dd { margin: 0; }
.ctx-issue-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.ctx-vendor-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.ctx-vendor-list li { padding: 10px 12px; border: 1px solid var(--c-border); border-radius: 12px; background: #fff; }
.ctx-vendor-head { display: flex; justify-content: space-between; gap: 10px; }
.ctx-vendor-message { margin-top: 6px; font-size: 0.82rem; color: #7a4f12; background: #fff7e6; border-radius: 8px; padding: 6px 8px; }
.ctx-category-edit { display: flex; flex-direction: column; gap: 4px; min-width: 150px; }
.ctx-category-edit .ctx-select, .ctx-category-edit .ctx-input { padding: 6px 8px; font-size: 0.84rem; }
.ctx-certify, .ctx-option-row { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 12px; background: var(--c-light-lavender); border: 1px solid var(--c-border); font-size: 0.9rem; line-height: 1.45; cursor: pointer; }
.ctx-certify input, .ctx-option-row input { margin-top: 3px; width: 18px; height: 18px; accent-color: var(--c-purple); flex: none; }
.ctx-issue-item { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 12px; font-size: 0.86rem; }
.ctx-issue-item.blocking { background: #fff8f7; border: 1px solid #f5c7c1; }
.ctx-issue-item.warning { background: #fffaf0; border: 1px solid #f3dcae; }
.ctx-issue-item .ctx-btn { margin-left: auto; }
.ctx-empty { text-align: center; padding: 38px 20px; color: var(--c-muted); }
.ctx-empty h3 { color: var(--c-text); margin: 10px 0 6px; font-size: 1.05rem; }
.ctx-tabs { display: flex; flex-wrap: wrap; gap: 6px; background: var(--c-light-lavender); border-radius: 20px; padding: 4px; width: fit-content; max-width: 100%; margin-bottom: 14px; }
.ctx-tab { border: none; background: transparent; border-radius: 999px; padding: 7px 14px; font-weight: 700; color: var(--c-muted); cursor: pointer; font-size: 0.85rem; }
.ctx-tab.active { background: var(--c-purple); color: #fff; }
.ctx-tab:focus-visible { outline: 2px solid var(--c-purple); outline-offset: 1px; }
.ctx-email-preview { border: 1px solid var(--c-border); border-radius: 14px; padding: 16px 18px; font-family: Arial, sans-serif; font-size: 0.9rem; background: #fff; }
.ctx-email-preview h4 { margin: 0 0 10px; }
.ctx-code { font-family: Consolas, "Cascadia Mono", monospace; font-size: 0.82rem; background: var(--c-light-lavender); padding: 1px 6px; border-radius: 6px; }

/* Drawer, dialog, toasts */
.ctx-backdrop { position: fixed; inset: 0; background: rgba(19, 13, 28, 0.4); z-index: 50; }
.ctx-drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(540px, 94vw); background: #fff; box-shadow: -18px 0 46px rgba(59, 30, 77, 0.22); padding: 22px 24px; overflow-y: auto; z-index: 51; border-radius: 20px 0 0 20px; }
.ctx-drawer h2 { margin: 0; font-size: 1.2rem; }
.ctx-drawer h3 { font-size: 0.95rem; margin: 18px 0 6px; color: var(--c-dark-purple); }
.ctx-drawer p, .ctx-drawer li { font-size: 0.88rem; }
.ctx-drawer ul { padding-left: 20px; margin: 6px 0; }
.ctx-dialog-wrap { position: fixed; inset: 0; display: grid; place-items: center; z-index: 61; }
.ctx-dialog { background: #fff; border-radius: 20px; width: min(560px, 92vw); padding: 22px; box-shadow: 0 24px 60px rgba(19, 13, 28, 0.35); display: flex; flex-direction: column; gap: 14px; overflow-wrap: break-word; }
.ctx-dialog h2 { margin: 0; font-size: 1.15rem; }
.ctx-send-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.ctx-send-list li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 12px; background: var(--c-light-lavender); border: 1px solid var(--c-border); border-radius: 10px; }
.ctx-send-amount { font-variant-numeric: tabular-nums; font-weight: 800; }
.ctx-dialog-actions { display: flex; justify-content: flex-end; gap: 10px; }
.ctx-toasts { position: fixed; bottom: 18px; right: 18px; display: flex; flex-direction: column; gap: 8px; z-index: 70; }
.ctx-toast { background: var(--c-text); color: #fff; padding: 10px 14px; border-radius: 12px; font-size: 0.86rem; max-width: 440px; box-shadow: 0 12px 30px rgba(19, 13, 28, 0.3); overflow-wrap: break-word; }
.ctx-toast.warning { background: #7a4f12; }

/* Smaller screens: the sidebar narrows (D-033) and the preview moves under the grid */
@media (max-width: 1180px) {
  .ctx-expenses-layout { grid-template-columns: minmax(0, 1fr); }
  .ctx-preview { position: static; }
  .ctx-two-col { grid-template-columns: minmax(0, 1fr); }
  .ctx-totals { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
/* A tablet or a narrow window: tables keep their columns closer together */
@media (max-width: 900px) {
  .ctx-table th, .ctx-table td { padding-left: 7px; padding-right: 7px; }
}
/* A phone, or a narrow column: one column of fields, labels above their values */
@media (max-width: 640px) {
  .ctx-main { padding: 16px 12px; gap: 14px; }
  .ctx-card { padding: 14px 14px; }
  .ctx-header { padding: 12px 14px; }
  .ctx-field-grid { grid-template-columns: minmax(0, 1fr); }
  .ctx-dl { grid-template-columns: minmax(0, 1fr); gap: 2px; }
  .ctx-dl dd { margin-bottom: 8px; overflow-wrap: anywhere; }
  .ctx-drop { padding: 14px; }
  .ctx-dialog { padding: 18px; }
}
`;

let injected = false;

/** Adds the stylesheet to the page once. */
export function injectTheme(doc: Document = document): void {
  if (injected || doc.getElementById('ctx-theme')) return;
  const style = doc.createElement('style');
  style.id = 'ctx-theme';
  style.textContent = THEME_CSS;
  doc.head.appendChild(style);
  injected = true;
}
