import * as React from 'react';
import { NO_QUOTE_REASONS, NO_RECEIPT_REASONS } from '../../domain/defaults';
import { centsToPlain, parseAmountToCents } from '../../domain/money';
import { CATEGORIES, LineApproval, PAID_BY_OPTIONS, vendorGroups } from '../../domain/purchaseRules';
import { ACCEPT_ATTRIBUTE, hasReceipt, quoteFiles, receiptFiles, receiptSourceRow } from '../../domain/receipts';
import { LINE_APPROVAL_DISPLAY } from '../../domain/statuses';
import { messages } from '../../domain/messages';
import { suggestedFieldsText } from '../../domain/suggestions';
import { FileKind, PurchaseLine, SuggestedField, TEXT_MAX_LENGTH } from '../../domain/types';
import { Issue, LineField, ValidationStage, issueForCell, issuesForLine } from '../../domain/validation';
import { LineChanges } from '../../data/PurchaseDataService';
import { Icon } from './Icon';
import { Badge, IssueLine, Tag } from './common';

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
}

const SUGGESTED_TITLE = 'Filled in by the app. Check it against the receipt.';

/** About as tall as the open row menu: a menu that would not fit below its button opens above it. */
const MENU_HEIGHT_PX = 340;

/** Where an open row menu sits: fixed to the window, so the grid's own scrolling cannot cut it off. */
interface OpenMenu {
  lineId: string;
  right: number;
  top?: number;
  bottom?: number;
}

// Columns that take typed or chosen values, in grid order. Used for Enter,
// Ctrl+D and multi-row paste.
type EditableColumn = 'date' | 'vendor' | 'description' | 'category' | 'amount' | 'paidBy';
const EDITABLE: EditableColumn[] = ['date', 'vendor', 'description', 'category', 'amount', 'paidBy'];

/** Turns pasted or copied text into a change for one cell, or null if it does not fit. */
function valueToChange(column: EditableColumn, text: string): LineChanges | null {
  const value = text.trim();
  switch (column) {
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(value) ? { date: value } : null;
    case 'amount': {
      const cents = parseAmountToCents(value);
      return cents === null ? null : { amountCents: cents };
    }
    case 'category': {
      const c = CATEGORIES.find((x) => x.label.toLowerCase() === value.toLowerCase() || x.id === value);
      return c ? { category: c.id } : null;
    }
    case 'paidBy': {
      const p = PAID_BY_OPTIONS.find((x) => [x.label, x.shortLabel, x.id].some((v) => v.toLowerCase() === value.toLowerCase()));
      return p ? { paidBy: p.id } : null;
    }
    case 'vendor':
      return { vendor: value };
    case 'description':
      return { description: value };
  }
}

function cellValue(line: PurchaseLine, column: EditableColumn): string {
  switch (column) {
    case 'amount':
      return line.amountCents === null ? '' : centsToPlain(line.amountCents);
    default:
      return line[column];
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

export function PurchaseGrid(props: Props): React.ReactElement {
  const { lines, issues, readOnly } = props;
  const tableRef = React.useRef<HTMLTableElement>(null);
  const [menu, setMenu] = React.useState<OpenMenu | null>(null);
  const menuFor = menu ? menu.lineId : null;
  const setMenuFor = (lineId: string | null, button?: HTMLElement) => {
    if (lineId === null || !button) return setMenu(null);
    const rect = button.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    const opensUp = below < MENU_HEIGHT_PX && rect.top > below;
    setMenu({
      lineId,
      right: Math.max(8, window.innerWidth - rect.right),
      ...(opensUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 })
    });
  };
  // Amount text as typed, so a half-typed or invalid amount is not lost.
  const [amountText, setAmountText] = React.useState<Record<string, string>>({});
  const askQuoteReason = quoteReasonRows(lines, props.stage);

  React.useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('resize', close);
    // Scrolling the page or the grid moves the row away from the menu, so the menu closes.
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
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
      const change = valueToChange(column, cellValue(above, column));
      if (change) {
        if (column === 'amount') setAmountText((t) => ({ ...t, [lines[rowIndex].id]: cellValue(above, column) }));
        // "Other" is meaningless without its description, so it is copied with it.
        props.onChange(lines[rowIndex].id, column === 'category' && above.category === 'other' ? { ...change, categoryOther: above.categoryOther } : change);
      }
    }
  };

  // Pasting several rows (or columns) from a spreadsheet fills the cells below and to the right.
  const onPaste = (e: React.ClipboardEvent, rowIndex: number, column: EditableColumn) => {
    const text = e.clipboardData.getData('text/plain');
    if (!/[\t\n]/.test(text.trim())) return;
    e.preventDefault();
    const rows = text
      .replace(/\r/g, '')
      .replace(/\n$/, '')
      .split('\n')
      .map((r) => r.split('\t'));
    const startCol = EDITABLE.indexOf(column);
    rows.forEach((cells, r) => {
      const line = lines[rowIndex + r];
      if (!line) return;
      let changes: LineChanges = {};
      cells.forEach((cellText, c) => {
        const col = EDITABLE[startCol + c];
        if (!col) return;
        const change = valueToChange(col, cellText);
        if (change) changes = { ...changes, ...change };
        if (col === 'amount') setAmountText((t) => ({ ...t, [line.id]: cellText.trim() }));
      });
      if (Object.keys(changes).length > 0) props.onChange(line.id, changes);
    });
  };

  const isSuggested = (line: PurchaseLine, field: LineField) => line.suggested.includes(field as SuggestedField);
  const cellClass = (line: PurchaseLine, field: LineField, extra = '') => {
    const issue = issueForCell(issues, line.id, field);
    return `ctx-cell ${extra} ${isSuggested(line, field) ? 'suggested' : ''} ${issue ? issue.severity : ''}`;
  };
  const cellTitle = (line: PurchaseLine, field: LineField) =>
    issueForCell(issues, line.id, field)?.message ?? (isSuggested(line, field) ? SUGGESTED_TITLE : undefined);
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
            const rowIssues = issuesForLine(issues, line.id).filter((issue) => issue.field !== 'suggested');
            const showSuggestNote = line.suggested.length > 0 && !readOnly;
            const source = receiptSourceRow(line, lines);
            const shared = line.sameReceiptAsRow !== null;
            const receipts = receiptFiles(line);
            const quotes = quoteFiles(line);
            const receiptIssue = issueForCell(issues, line.id, 'receipt');
            const quoteIssue = issueForCell(issues, line.id, 'quote');
            const askReceiptReason = props.stage === 'submit' && !hasReceipt(line, lines);
            const showQuoteReason = askQuoteReason.has(line.id) && (!readOnly || line.noQuoteReason.trim() !== '');
            const showReceiptReason = askReceiptReason && (!readOnly || line.noReceiptReason.trim() !== '');
            const approval = props.approvals.get(line.id);
            const approvalDisplay = approval ? LINE_APPROVAL_DISPLAY[approval.status] : undefined;
            const selected = props.selectedLineId === line.id;
            const otherRowsWithReceipts = lines.filter((l) => l.id !== line.id && l.sameReceiptAsRow === null && receiptFiles(l).length > 0);
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
                          className="ctx-receipt-chip shared"
                          title={source ? `Uses the receipt on row ${line.sameReceiptAsRow}` : receiptIssue?.message}
                          onClick={() => props.onOpenFile(line.id, '')}
                        >
                          <Icon name="link" size={13} />
                          <span>Same as row {line.sameReceiptAsRow}</span>
                        </button>
                      ) : (
                        receipts.map((f) => (
                          <button key={f.id} className="ctx-receipt-chip" title={f.fileName} onClick={() => props.onOpenFile(line.id, f.id)}>
                            <Icon name="file" size={13} />
                            <span>{f.fileName}</span>
                          </button>
                        ))
                      )}
                      {quotes.map((f) => (
                        <button key={f.id} className="ctx-receipt-chip quote" title={`Quote: ${f.fileName}`} onClick={() => props.onOpenFile(line.id, f.id)}>
                          <strong>Quote</strong>
                          <span>{f.fileName}</span>
                        </button>
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
                      className={cellClass(line, 'date')}
                      title={cellTitle(line, 'date')}
                      aria-label={`Row ${line.rowNumber} date`}
                      value={line.date}
                      onChange={(e) => props.onChange(line.id, { date: e.target.value })}
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
                    <select
                      className={cellClass(line, 'category')}
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
                    </select>
                    {line.category === 'other' ? (
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
                      onBlur={() =>
                        setAmountText((t) => {
                          const next = { ...t };
                          if (line.amountCents !== null) delete next[line.id];
                          return next;
                        })
                      }
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
                          className="ctx-btn ctx-btn-ghost ctx-btn-small"
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
                            className="ctx-menu"
                            role="menu"
                            style={{ right: menu.right, top: menu.top, bottom: menu.bottom }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {(
                              [
                                ['receipt', 'Attach a receipt or invoice'],
                                ['quote', 'Attach a quote']
                              ] as [FileKind, string][]
                            ).map(([kind, label]) => (
                              <label key={kind} role="menuitem">
                                <Icon name="plus" size={15} />
                                {label}
                                <input
                                  type="file"
                                  accept={ACCEPT_ATTRIBUTE}
                                  hidden
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) props.onAddFile(line.id, f, kind);
                                    setMenuFor(null);
                                  }}
                                />
                              </label>
                            ))}
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
                                  setMenuFor(null);
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
                            {line.files.length > 0 ? <hr /> : null}
                            {line.files.map((f) => (
                              <button
                                key={f.id}
                                role="menuitem"
                                onClick={() => {
                                  props.onRemoveFile(line.id, f.id);
                                  setMenuFor(null);
                                }}
                              >
                                <Icon name="x" size={15} />
                                Remove {f.fileName}
                              </button>
                            ))}
                            <hr />
                            <button
                              role="menuitem"
                              className="danger"
                              onClick={() => {
                                props.onDelete(line.id);
                                setMenuFor(null);
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
