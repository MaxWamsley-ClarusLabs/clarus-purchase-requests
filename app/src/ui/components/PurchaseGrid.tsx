import * as React from 'react';
import { NO_QUOTE_REASONS, NO_RECEIPT_REASONS } from '../../domain/defaults';
import { FIRST_YEAR, LAST_YEAR, isValidIsoDate } from '../../domain/dates';
import { centsToPlain, parseAmountToCents } from '../../domain/money';
import { CATEGORIES, LineApproval, PAID_BY_OPTIONS, categoryNeedsDescription, findCategory, vendorGroups } from '../../domain/purchaseRules';
import { ACCEPT_ATTRIBUTE, hasReceipt, quoteFiles, receiptFiles, receiptSourceRow } from '../../domain/receipts';
import { LINE_APPROVAL_DISPLAY } from '../../domain/statuses';
import { messages } from '../../domain/messages';
import { suggestedFieldsText } from '../../domain/suggestions';
import { FileKind, PurchaseLine, SuggestedField, TEXT_MAX_LENGTH } from '../../domain/types';
import { Issue, LineField, ValidationStage, issueForCell, issuesForLine } from '../../domain/validation';
import { LineChanges } from '../../data/PurchaseDataService';
import { PASTE_COLUMNS, PasteColumn, parseClipboardTable, pasteWarning, planPaste } from '../pasteParse';
import { Icon } from './Icon';
import { Badge, FileChip, FullTextSelect, IssueLine, Tag } from './common';

interface Props {
  lines: PurchaseLine[];
  issues: Issue[];
  readOnly: boolean;
  /** Which action the request is being checked for: the quote reason is asked at "approval", the receipt reason at "submit" (P-006). */
  stage: ValidationStage;
  /** The approval status of each row, from the vendor totals (P-003). */
  approvals: ReadonlyMap<string, LineApproval>;
  selectedLineId: string | null;
  onSelect: (lineId: string) => void;
  onChange: (lineId: string, changes: LineChanges) => void;
  onDelete: (lineId: string) => void;
  onAddFile: (lineId: string, file: File, kind: FileKind) => void;
  onRemoveFile: (lineId: string, fileId: string) => void;
  /** Shows a row's files (the side panel, or the slide-over on narrower screens). `fileId` is '' for a shared receipt. */
  onOpenFile: (lineId: string, fileId: string) => void;
  /** Vendors the employee has used before, for autocomplete (travel D-057). */
  vendorOptions: string[];
  /** Rows whose receipt is being read (travel D-074). */
  readingLineIds: ReadonlySet<string>;
  /** Confirms a row's suggested values (travel D-078). */
  onConfirm: (lineId: string) => void;
  /** Tells the employee about part of a paste that was not used. */
  onWarning: (text: string) => void;
}

const SUGGESTED_TITLE = 'Filled in by the app. Check it against the receipt.';

/** About as tall as the open row menu: a menu that would not fit below its button opens above it. */
const MENU_HEIGHT_PX = 340;

/** The dates the date box offers (`isValidIsoDate` accepts no others). */
const MIN_DATE = `${FIRST_YEAR}-01-01`;
const MAX_DATE = `${LAST_YEAR}-12-31`;

/** Where an open row menu sits: fixed to the window, so the grid's own scrolling cannot cut it off. */
interface OpenMenu {
  lineId: string;
  right: number;
  top?: number;
  bottom?: number;
}

/** The menu's place next to its button: below it, or above it near the bottom of the window. */
function placeMenu(lineId: string, button: HTMLElement): OpenMenu {
  const rect = button.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom;
  const opensUp = below < MENU_HEIGHT_PX && rect.top > below;
  return {
    lineId,
    right: Math.max(8, window.innerWidth - rect.right),
    ...(opensUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 })
  };
}

/** Whether the button can still be seen: in the window, and not scrolled out of the grid's own area. */
function inView(button: HTMLElement): boolean {
  const rect = button.getBoundingClientRect();
  const area = button.closest('.ctx-grid-wrap')?.getBoundingClientRect();
  const inWindow = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
  return inWindow && (!area || (rect.right > area.left && rect.left < area.right));
}

// Columns that take typed or chosen values, in grid order. Used for Enter,
// Ctrl+D and pasting from a spreadsheet (pasteParse.ts).
type EditableColumn = PasteColumn;
const EDITABLE = PASTE_COLUMNS;

/** The change that copies a cell from the row above (Ctrl+D), or null when there is nothing to copy. */
function copyFromAbove(column: EditableColumn, above: PurchaseLine): LineChanges | null {
  switch (column) {
    case 'date':
      return above.date ? { date: above.date } : null;
    case 'amount':
      return above.amountCents === null ? null : { amountCents: above.amountCents };
    case 'category':
      if (!above.category) return null;
      // A category the employee describes ("Other") means nothing without its description, so it is copied with it.
      return categoryNeedsDescription(above.category) ? { category: above.category, categoryOther: above.categoryOther } : { category: above.category };
    case 'paidBy':
      return above.paidBy ? { paidBy: above.paidBy } : null;
    case 'vendor':
      return { vendor: above.vendor };
    case 'description':
      return { description: above.description };
  }
}

/**
 * The rows that show "No quote: say why": the first row of each vendor total
 * that needs a quote and has no quote file, plus any row that already holds a
 * reason, so a reason typed on another row of the vendor can still be seen and
 * changed (P-015). Only while the request is waiting to be sent for approval.
 */
function quoteReasonRows(lines: readonly PurchaseLine[], stage: ValidationStage): Set<string> {
  const rows = new Set<string>();
  if (stage !== 'approval') return rows;
  const byId = new Map(lines.map((l) => [l.id, l]));
  for (const group of vendorGroups(lines)) {
    if (!group.needsQuote) continue;
    const members = group.lineIds.map((id) => byId.get(id)).filter((l): l is PurchaseLine => !!l);
    if (members.some((l) => quoteFiles(l).length > 0)) continue;
    rows.add(group.lineIds[0]);
    for (const l of members) if (l.noQuoteReason.trim()) rows.add(l.id);
  }
  return rows;
}

/** Copies of a record without one key. */
function without(record: Record<string, string>, key: string): Record<string, string> {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

export function PurchaseGrid(props: Props): React.ReactElement {
  const { lines, issues, readOnly } = props;
  const tableRef = React.useRef<HTMLTableElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  // The button that opened the row menu, which gets the focus back when the menu closes.
  const menuButton = React.useRef<HTMLElement | null>(null);
  const [menu, setMenu] = React.useState<OpenMenu | null>(null);
  const menuFor = menu ? menu.lineId : null;
  const setMenuFor = (lineId: string | null, button?: HTMLElement) => {
    if (lineId === null || !button) return setMenu(null);
    menuButton.current = button;
    setMenu(placeMenu(lineId, button));
  };
  /** Closes the row menu after a choice in it, and gives the focus back to its button. */
  const closeMenu = () => {
    setMenu(null);
    menuButton.current?.focus();
  };
  // Amount text as typed, so a half-typed or invalid amount is not lost.
  const [amountText, setAmountText] = React.useState<Record<string, string>>({});
  // A date as typed in the date box. A date the app does not accept (such as year 0026, which a
  // date box allows) is not stored: while it is typed the last good date stays, and once the
  // box is left the date is emptied and the cell says why.
  const [dateText, setDateText] = React.useState<Record<string, string>>({});
  const askQuoteReason = quoteReasonRows(lines, props.stage);

  // The keyboard goes into the menu as soon as it shows, so its choices can be reached with Tab.
  React.useLayoutEffect(() => {
    if (menuFor) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [menuFor]);

  React.useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setMenu(null);
      menuButton.current?.focus();
    };
    // Scrolling the page or the grid moves the row: the menu follows its button, and closes once
    // the button is out of sight. (The browser also scrolls a clicked button fully into view.)
    const onScroll = () => {
      const button = menuButton.current;
      if (!button || !inView(button)) close();
      else setMenu((current) => (current ? placeMenu(current.lineId, button) : current));
    };
    window.addEventListener('click', close);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [menuFor]);

  const focusCell = (rowIndex: number, column: string) => {
    const el = tableRef.current?.querySelector<HTMLElement>(`[data-row="${rowIndex}"][data-col="${column}"]`);
    if (el) el.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent, rowIndex: number, column: EditableColumn) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      focusCell(Math.min(rowIndex + 1, lines.length - 1), column);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && rowIndex > 0) {
      e.preventDefault();
      const above = lines[rowIndex - 1];
      const lineId = lines[rowIndex].id;
      const change = copyFromAbove(column, above);
      if (!change) return;
      if (column === 'amount') setAmountText((t) => without(t, lineId));
      if (column === 'date') setDateText((t) => without(t, lineId));
      props.onChange(lineId, change);
    }
  };

  // Pasting from a spreadsheet fills the cells below and to the right (pasteParse.ts). One
  // plain cell pasted into a box where text is typed is left to the browser, which puts it at
  // the cursor; a date box or a drop-down cannot take pasted text itself, so the app reads it.
  const onPaste = (e: React.ClipboardEvent, rowIndex: number, column: EditableColumn) => {
    const text = e.clipboardData.getData('text/plain');
    const table = parseClipboardTable(text);
    if (table.length === 0) return;
    const typedBox = column === 'vendor' || column === 'description' || column === 'amount';
    const plainOneCell = table.length === 1 && table[0].length === 1 && !/[\t\n\r]/.test(text.replace(/\r?\n$/, ''));
    if (typedBox && plainOneCell) return;
    e.preventDefault();
    const plan = planPaste(
      table,
      lines.map((l) => l.id),
      rowIndex,
      EDITABLE.indexOf(column)
    );
    for (const row of plan.rows) {
      if (row.amountText !== undefined) {
        // An amount that is not an amount shows as pasted, with the error; a good one shows as stored.
        const pasted = row.amountText;
        setAmountText((t) => (row.changes.amountCents === null ? { ...t, [row.lineId]: pasted } : without(t, row.lineId)));
      }
      if (row.changes.date !== undefined) setDateText((t) => without(t, row.lineId));
      props.onChange(row.lineId, row.changes);
    }
    const warning = pasteWarning(plan);
    if (warning) props.onWarning(warning);
  };

  /** The date typed in a row's date box is one the app does not accept. */
  const badDateTyped = (line: PurchaseLine): boolean => {
    const typed = dateText[line.id];
    return typed !== undefined && typed !== '' && !isValidIsoDate(typed);
  };
  // A date the app does not accept is not stored, so the check finds the date empty; the cell says why instead.
  const issueShown = (line: PurchaseLine, issue: Issue | undefined): Issue | undefined =>
    issue && issue.field === 'date' && !line.date && badDateTyped(line) ? { ...issue, message: messages.dateInvalid } : issue;
  const issueFor = (line: PurchaseLine, field: LineField) => issueShown(line, issueForCell(issues, line.id, field));

  const isSuggested = (line: PurchaseLine, field: LineField) => line.suggested.includes(field as SuggestedField);
  const cellClass = (line: PurchaseLine, field: LineField, extra = '') => {
    const issue = issueFor(line, field);
    return `ctx-cell ${extra} ${isSuggested(line, field) ? 'suggested' : ''} ${issue ? issue.severity : ''}`;
  };
  const cellTitle = (line: PurchaseLine, field: LineField) => issueFor(line, field)?.message ?? (isSuggested(line, field) ? SUGGESTED_TITLE : undefined);
  const common = (rowIndex: number, column: EditableColumn) => ({
    'data-row': rowIndex,
    'data-col': column,
    disabled: readOnly,
    onKeyDown: (e: React.KeyboardEvent) => onKeyDown(e, rowIndex, column),
    onPaste: (e: React.ClipboardEvent) => onPaste(e, rowIndex, column),
    onFocus: () => props.onSelect(lines[rowIndex].id)
  });

  return (
    <div className="ctx-grid-wrap">
      <datalist id="ctx-vendor-options">
        {props.vendorOptions.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="ctx-no-receipt-reasons">
        {NO_RECEIPT_REASONS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <datalist id="ctx-no-quote-reasons">
        {NO_QUOTE_REASONS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <table className="ctx-grid" ref={tableRef}>
        <thead>
          <tr>
            <th style={{ width: 24 }}>#</th>
            <th style={{ width: 150 }}>Files</th>
            <th style={{ width: 128 }}>Date</th>
            <th style={{ width: 204 }}>Vendor</th>
            <th>What was bought and why</th>
            <th style={{ width: 172 }}>Category</th>
            <th style={{ width: 86, textAlign: 'right' }}>Amount</th>
            <th style={{ width: 104 }}>Who paid</th>
            <th style={{ width: 128 }}>Approval</th>
            <th style={{ width: 36 }} aria-label="Row menu" />
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            // Unconfirmed suggestions get their own note with a Confirm button, below.
            const rowIssues = issuesForLine(issues, line.id)
              .filter((issue) => issue.field !== 'suggested')
              .map((issue) => issueShown(line, issue) as Issue);
            const showSuggestNote = line.suggested.length > 0 && !readOnly;
            const source = receiptSourceRow(line, lines);
            const shared = line.sameReceiptAsRow !== null;
            const receipts = receiptFiles(line);
            const quotes = quoteFiles(line);
            const receiptIssue = issueFor(line, 'receipt');
            const quoteIssue = issueFor(line, 'quote');
            const askReceiptReason = props.stage === 'submit' && !hasReceipt(line, lines);
            const showQuoteReason = askQuoteReason.has(line.id) && (!readOnly || line.noQuoteReason.trim() !== '');
            const showReceiptReason = askReceiptReason && (!readOnly || line.noReceiptReason.trim() !== '');
            const approval = props.approvals.get(line.id);
            const approvalDisplay = approval ? LINE_APPROVAL_DISPLAY[approval.status] : undefined;
            const selected = props.selectedLineId === line.id;
            // A row either holds its own receipt or uses another row's (travel D-038), so a row with its own receipt is not offered the choice.
            const otherRowsWithReceipts = lines.filter((l) => l.id !== line.id && l.sameReceiptAsRow === null && receiptFiles(l).length > 0);
            const category = findCategory(line.category);
            return (
              <React.Fragment key={line.id}>
                <tr
                  className={`ctx-row ${selected ? 'selected' : ''} ${rowIssues.length || showSuggestNote ? 'has-issues' : ''}`}
                  onClick={() => props.onSelect(line.id)}
                >
                  <td className="ctx-row-num">{line.rowNumber}</td>
                  <td>
                    <div className="ctx-files-cell">
                      {shared ? (
                        <button
                          type="button"
                          className="ctx-receipt-chip shared"
                          title={source ? `Uses the receipt on row ${line.sameReceiptAsRow}` : receiptIssue?.message}
                          onClick={() => props.onOpenFile(line.id, '')}
                        >
                          <Icon name="link" size={13} />
                          <span>Same as row {line.sameReceiptAsRow}</span>
                        </button>
                      ) : (
                        receipts.map((f) => <FileChip key={f.id} file={f} onOpen={() => props.onOpenFile(line.id, f.id)} />)
                      )}
                      {quotes.map((f) => (
                        <FileChip key={f.id} file={f} onOpen={() => props.onOpenFile(line.id, f.id)} />
                      ))}
                      {props.readingLineIds.has(line.id) ? (
                        <span className="ctx-reading" role="status">
                          Reading
                        </span>
                      ) : null}
                      {showQuoteReason ? (
                        <input
                          className={`ctx-cell noreceipt ${quoteIssue ? quoteIssue.severity : ''}`}
                          placeholder="No quote: say why"
                          list="ctx-no-quote-reasons"
                          aria-label={`Row ${line.rowNumber} reason there is no quote`}
                          maxLength={TEXT_MAX_LENGTH}
                          value={line.noQuoteReason}
                          disabled={readOnly}
                          title={quoteIssue?.message}
                          onChange={(e) => props.onChange(line.id, { noQuoteReason: e.target.value })}
                          onFocus={() => props.onSelect(line.id)}
                        />
                      ) : null}
                      {showReceiptReason ? (
                        <input
                          className={`ctx-cell noreceipt ${receiptIssue ? receiptIssue.severity : ''}`}
                          placeholder="No receipt: say why"
                          list="ctx-no-receipt-reasons"
                          aria-label={`Row ${line.rowNumber} reason there is no receipt`}
                          maxLength={TEXT_MAX_LENGTH}
                          value={line.noReceiptReason}
                          disabled={readOnly}
                          title={receiptIssue?.message}
                          onChange={(e) => props.onChange(line.id, { noReceiptReason: e.target.value })}
                          onFocus={() => props.onSelect(line.id)}
                        />
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <input
                      type="date"
                      min={MIN_DATE}
                      max={MAX_DATE}
                      className={cellClass(line, 'date')}
                      title={cellTitle(line, 'date')}
                      aria-label={`Row ${line.rowNumber} date`}
                      value={dateText[line.id] ?? line.date}
                      onChange={(e) => {
                        const value = e.target.value;
                        setDateText((t) => ({ ...t, [line.id]: value }));
                        if (value === '' || isValidIsoDate(value)) props.onChange(line.id, { date: value });
                      }}
                      onBlur={(e) => {
                        const value = e.currentTarget.value;
                        if (value === '' || isValidIsoDate(value)) setDateText((t) => without(t, line.id));
                        else if (line.date !== '') props.onChange(line.id, { date: '' });
                      }}
                      {...common(i, 'date')}
                    />
                  </td>
                  <td>
                    <input
                      className={cellClass(line, 'vendor')}
                      title={cellTitle(line, 'vendor')}
                      aria-label={`Row ${line.rowNumber} vendor`}
                      maxLength={TEXT_MAX_LENGTH}
                      list="ctx-vendor-options"
                      value={line.vendor}
                      onChange={(e) => props.onChange(line.id, { vendor: e.target.value })}
                      {...common(i, 'vendor')}
                    />
                  </td>
                  <td>
                    <input
                      className={cellClass(line, 'description')}
                      title={cellTitle(line, 'description')}
                      aria-label={`Row ${line.rowNumber} what was bought and why`}
                      maxLength={TEXT_MAX_LENGTH}
                      value={line.description}
                      onChange={(e) => props.onChange(line.id, { description: e.target.value })}
                      {...common(i, 'description')}
                    />
                  </td>
                  <td>
                    <FullTextSelect
                      boxClassName={cellClass(line, 'category')}
                      shownText={category ? category.label : 'Choose'}
                      nothingChosen={!category}
                      title={cellTitle(line, 'category')}
                      aria-label={`Row ${line.rowNumber} category`}
                      value={line.category}
                      onChange={(e) => props.onChange(line.id, { category: e.target.value as PurchaseLine['category'] })}
                      {...common(i, 'category')}
                    >
                      <option value="">Choose</option>
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id} title={c.covers}>
                          {c.label}
                        </option>
                      ))}
                    </FullTextSelect>
                    {categoryNeedsDescription(line.category) ? (
                      <input
                        className={cellClass(line, 'categoryOther', 'category-other')}
                        title={cellTitle(line, 'categoryOther')}
                        aria-label={`Row ${line.rowNumber} category description`}
                        placeholder="Describe the category"
                        maxLength={TEXT_MAX_LENGTH}
                        value={line.categoryOther}
                        disabled={readOnly}
                        onChange={(e) => props.onChange(line.id, { categoryOther: e.target.value })}
                        onFocus={() => props.onSelect(line.id)}
                      />
                    ) : null}
                  </td>
                  <td>
                    <input
                      className={cellClass(line, 'amount', 'amount')}
                      title={cellTitle(line, 'amount')}
                      aria-label={`Row ${line.rowNumber} amount`}
                      inputMode="decimal"
                      value={
                        line.suggested.includes('amount') && line.amountCents !== null
                          ? centsToPlain(line.amountCents)
                          : (amountText[line.id] ?? (line.amountCents === null ? '' : centsToPlain(line.amountCents)))
                      }
                      onChange={(e) => {
                        const text = e.target.value;
                        setAmountText((t) => ({ ...t, [line.id]: text }));
                        props.onChange(line.id, { amountCents: parseAmountToCents(text) });
                      }}
                      onBlur={() => {
                        if (line.amountCents !== null) setAmountText((t) => without(t, line.id));
                      }}
                      {...common(i, 'amount')}
                    />
                  </td>
                  <td>
                    <select
                      className={cellClass(line, 'paidBy')}
                      title={cellTitle(line, 'paidBy')}
                      aria-label={`Row ${line.rowNumber} who paid`}
                      value={line.paidBy}
                      onChange={(e) => props.onChange(line.id, { paidBy: e.target.value as PurchaseLine['paidBy'] })}
                      {...common(i, 'paidBy')}
                    >
                      <option value="">Choose</option>
                      {PAID_BY_OPTIONS.map((p) => (
                        <option key={p.id} value={p.id} title={p.help}>
                          {p.shortLabel}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {approval && approvalDisplay ? (
                      <div className="ctx-approval-cell">
                        <Badge tone={approvalDisplay.tone}>{approvalDisplay.label}</Badge>
                        {approval.boughtBefore ? <Tag>Bought before approval</Tag> : null}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    {readOnly ? null : (
                      <div className="ctx-menu-wrap">
                        <button
                          type="button"
                          className="ctx-btn ctx-btn-ghost ctx-btn-small ctx-row-menu-button"
                          aria-label={`Row ${line.rowNumber} menu`}
                          aria-haspopup="menu"
                          aria-expanded={menuFor === line.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuFor(menuFor === line.id ? null : line.id, e.currentTarget);
                          }}
                        >
                          <Icon name="dots" />
                        </button>
                        {menu && menu.lineId === line.id ? (
                          <div
                            ref={menuRef}
                            className="ctx-menu"
                            role="menu"
                            aria-label={`Row ${line.rowNumber}`}
                            style={{ right: menu.right, top: menu.top, bottom: menu.bottom }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {(
                              [
                                ['receipt', 'Attach a receipt or invoice'],
                                ['quote', 'Attach a quote']
                              ] as [FileKind, string][]
                            ).map(([kind, label]) => (
                              <label
                                key={kind}
                                role="menuitem"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key !== 'Enter' && e.key !== ' ') return;
                                  e.preventDefault();
                                  e.currentTarget.querySelector('input')?.click();
                                }}
                              >
                                <Icon name="plus" size={15} />
                                {label}
                                <input
                                  type="file"
                                  accept={ACCEPT_ATTRIBUTE}
                                  hidden
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) props.onAddFile(line.id, f, kind);
                                    closeMenu();
                                  }}
                                />
                              </label>
                            ))}
                            {receipts.length === 0 ? (
                              <div style={{ padding: '6px 10px' }}>
                                <div className="ctx-label" style={{ marginBottom: 4 }}>
                                  Same receipt as row
                                </div>
                                <select
                                  className="ctx-select"
                                  aria-label={`Row ${line.rowNumber} same receipt as row`}
                                  value={line.sameReceiptAsRow ?? ''}
                                  onChange={(e) => {
                                    props.onChange(line.id, { sameReceiptAsRow: e.target.value === '' ? null : Number(e.target.value) });
                                    closeMenu();
                                  }}
                                >
                                  <option value="">No, this row has its own</option>
                                  {otherRowsWithReceipts.map((l) => (
                                    <option key={l.id} value={l.rowNumber}>
                                      Row {l.rowNumber}: {l.vendor || receiptFiles(l)[0].fileName}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : null}
                            {line.files.length > 0 ? <hr /> : null}
                            {line.files.map((f) => (
                              <button
                                type="button"
                                key={f.id}
                                role="menuitem"
                                onClick={() => {
                                  props.onRemoveFile(line.id, f.id);
                                  closeMenu();
                                }}
                              >
                                <Icon name="x" size={15} />
                                Remove the {f.kind === 'quote' ? 'quote' : 'receipt'} {f.fileName}
                              </button>
                            ))}
                            <hr />
                            <button
                              type="button"
                              role="menuitem"
                              className="danger"
                              onClick={() => {
                                props.onDelete(line.id);
                                closeMenu();
                              }}
                            >
                              <Icon name="trash" size={15} />
                              Delete row {line.rowNumber}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </td>
                </tr>
                {rowIssues.length > 0 || showSuggestNote ? (
                  <tr className="ctx-row-issues">
                    <td colSpan={10}>
                      {showSuggestNote ? (
                        <div className="ctx-suggest-note">
                          <span>{messages.suggestionsNotConfirmed(suggestedFieldsText(line.suggested))}</span>
                          <button
                            type="button"
                            className="ctx-btn ctx-btn-secondary ctx-btn-small"
                            aria-label={`Confirm row ${line.rowNumber}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              props.onConfirm(line.id);
                            }}
                          >
                            <Icon name="check" size={14} />
                            Confirm
                          </button>
                        </div>
                      ) : null}
                      {rowIssues.map((issue, k) => (
                        <IssueLine key={k} severity={issue.severity}>
                          {issue.message}
                        </IssueLine>
                      ))}
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
