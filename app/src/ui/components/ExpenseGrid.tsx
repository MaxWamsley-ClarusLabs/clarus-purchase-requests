import * as React from 'react';
import { CATEGORIES, PAYMENT_TYPES, TEXT_MAX_LENGTH } from '../../domain/lists';
import { centsToPlain, parseAmountToCents } from '../../domain/money';
import { receiptSourceRow } from '../../domain/receipts';
import { ACCEPT_ATTRIBUTE } from '../../domain/receipts';
import { NO_RECEIPT_REASONS } from '../../domain/defaults';
import { suggestedFieldsText } from '../../domain/suggestions';
import { Issue, LineField, issueForCell, issuesForLine } from '../../domain/validation';
import { ExpenseLine, SuggestedField } from '../../domain/types';
import { LineChanges } from '../../data/TravelDataService';
import { Icon } from './Icon';
import { IssueLine } from './common';

interface Props {
  lines: ExpenseLine[];
  issues: Issue[];
  readOnly: boolean;
  selectedLineId: string | null;
  onSelect: (lineId: string) => void;
  onChange: (lineId: string, changes: LineChanges) => void;
  onDelete: (lineId: string) => void;
  onAddFile: (lineId: string, file: File) => void;
  onRemoveFile: (lineId: string, receiptId: string) => void;
  /** Shows a row's receipt (the side panel, or the slide-over on narrower screens). */
  onOpenReceipt: (lineId: string) => void;
  /** Vendors the employee has used before, for autocomplete (D-057). */
  vendorOptions: string[];
  /** Rows whose receipt is being read (D-074). */
  readingLineIds: ReadonlySet<string>;
  /** Confirms a row's suggested values (D-078). */
  onConfirm: (lineId: string) => void;
}

const SUGGESTED_TITLE = 'Filled in by the app. Check it against the receipt.';

// Columns that take typed or chosen values, in grid order. Used for Enter,
// Ctrl+D and multi-row paste.
type EditableColumn = 'date' | 'vendor' | 'category' | 'amount' | 'paymentType' | 'description';
const EDITABLE: EditableColumn[] = ['date', 'vendor', 'category', 'amount', 'paymentType', 'description'];

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
    case 'paymentType': {
      const p = PAYMENT_TYPES.find((x) => [x.label, x.shortLabel, x.id].some((v) => v.toLowerCase() === value.toLowerCase()));
      return p ? { paymentType: p.id } : null;
    }
    case 'vendor':
      return { vendor: value };
    case 'description':
      return { description: value };
  }
}

function cellValue(line: ExpenseLine, column: EditableColumn): string {
  switch (column) {
    case 'amount':
      return line.amountCents === null ? '' : centsToPlain(line.amountCents);
    case 'category':
      return line.category;
    case 'paymentType':
      return line.paymentType;
    default:
      return line[column];
  }
}

export function ExpenseGrid(props: Props): React.ReactElement {
  const { lines, issues, readOnly } = props;
  const tableRef = React.useRef<HTMLTableElement>(null);
  const [menuFor, setMenuFor] = React.useState<string | null>(null);
  // Amount text as typed, so a half-typed or invalid amount is not lost.
  const [amountText, setAmountText] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
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
      const change = valueToChange(column, cellValue(lines[rowIndex - 1], column));
      if (change) {
        if (column === 'amount') setAmountText((t) => ({ ...t, [lines[rowIndex].id]: cellValue(lines[rowIndex - 1], column) }));
        props.onChange(lines[rowIndex].id, change);
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

  const isSuggested = (line: ExpenseLine, field: LineField) => line.suggested.includes(field as SuggestedField);
  const cellClass = (line: ExpenseLine, field: LineField, extra = '') => {
    const issue = issueForCell(issues, line.id, field);
    return `ctx-cell ${extra} ${isSuggested(line, field) ? 'suggested' : ''} ${issue ? issue.severity : ''}`;
  };
  const cellTitle = (line: ExpenseLine, field: LineField) =>
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
      <table className="ctx-grid" ref={tableRef}>
        <thead>
          <tr>
            <th>#</th>
            <th style={{ width: 128 }}>Receipt</th>
            <th style={{ width: 138 }}>Date</th>
            <th style={{ minWidth: 160 }}>Vendor</th>
            <th style={{ width: 158 }}>Category</th>
            <th style={{ width: 92, textAlign: 'right' }}>Amount</th>
            <th style={{ width: 138 }}>Paid with</th>
            <th style={{ minWidth: 150 }}>Description</th>
            <th style={{ width: 40 }} aria-label="Row menu" />
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => {
            // Unconfirmed suggestions get their own note with a Confirm button, below.
            const rowIssues = issuesForLine(issues, line.id).filter((issue) => issue.field !== 'suggested');
            const showSuggestNote = line.suggested.length > 0 && !readOnly;
            const source = receiptSourceRow(line, lines);
            const shared = line.sameReceiptAsRow !== null;
            const receiptIssue = issueForCell(issues, line.id, 'receipt');
            const selected = props.selectedLineId === line.id;
            const otherRowsWithFiles = lines.filter((l) => l.id !== line.id && l.sameReceiptAsRow === null && l.receipts.length > 0);
            return (
              <React.Fragment key={line.id}>
                <tr
                  className={`ctx-row ${selected ? 'selected' : ''} ${rowIssues.length || showSuggestNote ? 'has-issues' : ''}`}
                  onClick={() => props.onSelect(line.id)}
                >
                  <td className="ctx-row-num">{line.rowNumber}</td>
                  <td>
                    {shared ? (
                      <button
                        className="ctx-receipt-chip shared"
                        title={source ? `Uses the receipt on row ${line.sameReceiptAsRow}` : receiptIssue?.message}
                        onClick={() => props.onOpenReceipt(line.id)}
                      >
                        <Icon name="link" size={13} />
                        <span>Same as row {line.sameReceiptAsRow}</span>
                      </button>
                    ) : line.receipts.length > 0 ? (
                      <button className="ctx-receipt-chip" title={line.receipts.map((r) => r.fileName).join(', ')} onClick={() => props.onOpenReceipt(line.id)}>
                        <Icon name="file" size={13} />
                        <span>{line.receipts[0].fileName}</span>
                        {line.receipts.length > 1 ? <strong>+{line.receipts.length - 1}</strong> : null}
                      </button>
                    ) : null}
                    {props.readingLineIds.has(line.id) ? (
                      <span className="ctx-reading" role="status">
                        Reading
                      </span>
                    ) : null}
                    {shared || line.receipts.length > 0 ? null : (
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
                    )}
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
                    <select
                      className={cellClass(line, 'category')}
                      title={cellTitle(line, 'category')}
                      aria-label={`Row ${line.rowNumber} category`}
                      value={line.category}
                      onChange={(e) => props.onChange(line.id, { category: e.target.value as ExpenseLine['category'] })}
                      {...common(i, 'category')}
                    >
                      <option value="">Choose</option>
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id} title={c.covers}>
                          {c.label}
                        </option>
                      ))}
                    </select>
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
                      className={cellClass(line, 'paymentType')}
                      title={cellTitle(line, 'paymentType')}
                      aria-label={`Row ${line.rowNumber} paid with`}
                      value={line.paymentType}
                      onChange={(e) => props.onChange(line.id, { paymentType: e.target.value as ExpenseLine['paymentType'] })}
                      {...common(i, 'paymentType')}
                    >
                      <option value="">Choose</option>
                      {PAYMENT_TYPES.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.shortLabel}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className={cellClass(line, 'description')}
                      title={cellTitle(line, 'description')}
                      aria-label={`Row ${line.rowNumber} description`}
                      maxLength={TEXT_MAX_LENGTH}
                      placeholder={
                        line.category === 'otherTravel' ? 'Required for Other travel' : line.category === 'businessMeal' ? 'Optional: who attended' : ''
                      }
                      value={line.description}
                      onChange={(e) => props.onChange(line.id, { description: e.target.value })}
                      {...common(i, 'description')}
                    />
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
                            setMenuFor(menuFor === line.id ? null : line.id);
                          }}
                        >
                          <Icon name="dots" />
                        </button>
                        {menuFor === line.id ? (
                          <div className="ctx-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                            <label role="menuitem">
                              <Icon name="plus" size={15} />
                              {line.receipts.length > 0 ? 'Add another file' : 'Attach a receipt'}
                              <input
                                type="file"
                                accept={ACCEPT_ATTRIBUTE}
                                hidden
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) props.onAddFile(line.id, f);
                                  setMenuFor(null);
                                }}
                              />
                            </label>
                            <div style={{ padding: '6px 10px' }}>
                              <div className="ctx-label" style={{ marginBottom: 4 }}>
                                Same receipt as row
                              </div>
                              <select
                                className="ctx-select"
                                value={line.sameReceiptAsRow ?? ''}
                                onChange={(e) => {
                                  props.onChange(line.id, { sameReceiptAsRow: e.target.value === '' ? null : Number(e.target.value) });
                                  setMenuFor(null);
                                }}
                              >
                                <option value="">No, this row has its own</option>
                                {otherRowsWithFiles.map((l) => (
                                  <option key={l.id} value={l.rowNumber}>
                                    Row {l.rowNumber}: {l.vendor || l.receipts[0].fileName}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {line.receipts.length > 0 ? <hr /> : null}
                            {line.receipts.map((r) => (
                              <button
                                key={r.id}
                                role="menuitem"
                                onClick={() => {
                                  props.onRemoveFile(line.id, r.id);
                                  setMenuFor(null);
                                }}
                              >
                                <Icon name="x" size={15} />
                                Remove {r.fileName}
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
                    <td colSpan={9}>
                      {showSuggestNote ? (
                        <div className="ctx-suggest-note">
                          <span>Filled in by the app: {suggestedFieldsText(line.suggested)}. Check against the receipt, then confirm or correct.</span>
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
