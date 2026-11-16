import * as React from 'react';
import { LedgerFilter, LedgerRow, effectiveAccount, filterLedger, ledgerPaidBy, lineLabel, postProblem } from '../../../domain/ledger';
import { accountLayers, buildHistory, classLayers } from '../../../domain/ledgerSuggestions';
import { toIsoDate } from '../../../domain/dates';
import { formatCents } from '../../../domain/money';
import { buildLedgerWorkbook, ledgerFileName } from '../../../export/ledgerExport';
import { XLSX_TYPE } from '../../../export/xlsx';
import { useApp } from '../../AppContext';
import { downloadFile } from '../../download';
import { useMountedRef } from '../../hooks';
import { Badge, Card, HeaderCard, Tag } from '../../components/common';
import { Combobox } from '../../components/Combobox';
import { Icon } from '../../components/Icon';

const TABS: { id: LedgerFilter; label: string }[] = [
  { id: 'notPosted', label: 'Not posted' },
  { id: 'posted', label: 'Posted' },
  { id: 'all', label: 'All' }
];

/** How many rows are drawn at once; "Show more" draws the next batch. Every row has two type-ahead boxes, so a long list is drawn in parts. */
const PAGE_ROWS = 150;

/**
 * The Ledger (P-052): every purchase line of a request that has been bought and packaged, for the bookkeepers to post to
 * QuickBooks. Open to administrators and members of the Purchase Bookkeepers group. Each line has an account and a class
 * chosen from QuickBooks' own lists, with the likeliest choices first (P-055), and is marked Posted when it has been entered.
 */
export function LedgerPage(): React.ReactElement {
  const app = useApp();
  const mounted = useMountedRef();
  const [rows, setRows] = React.useState<LedgerRow[] | null>(null);
  const [filter, setFilter] = React.useState<LedgerFilter>('notPosted');
  const [search, setSearch] = React.useState('');
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());
  const [limit, setLimit] = React.useState(PAGE_ROWS);
  const [busy, setBusy] = React.useState<ReadonlySet<string>>(new Set());
  const [posting, setPosting] = React.useState(false);

  const load = React.useCallback(() => {
    app.service
      .listLedger()
      .then((all) => {
        if (mounted.current) setRows(all);
      })
      .catch(app.reportError);
  }, [app.service]);
  React.useEffect(load, [load]);

  // The suggestions count the most recently posted lines, once, when the page opens and after each posting.
  const history = React.useMemo(() => buildHistory(rows ?? []), [rows]);

  const counts = React.useMemo(() => {
    const all = rows ?? [];
    const posted = all.filter((r) => r.entry.posted).length;
    return { notPosted: all.length - posted, posted, all: all.length };
  }, [rows]);

  const shown = React.useMemo(() => filterLedger(rows ?? [], filter, search), [rows, filter, search]);
  const visible = shown.slice(0, limit);
  const picked = shown.filter((r) => selected.has(r.line.id));

  const replace = (updated: LedgerRow[]) => {
    const byId = new Map(updated.map((r) => [r.line.id, r]));
    setRows((all) => (all ? all.map((r) => byId.get(r.line.id) ?? r) : all));
  };

  const changeEntry = (row: LedgerRow, changes: { account?: string; className?: string }) => {
    const id = row.line.id;
    setBusy((b) => new Set(b).add(id));
    app.service
      .updateLedgerEntry(id, changes)
      .then((updated) => {
        if (mounted.current) replace([updated]);
      })
      .catch(app.reportError)
      .finally(() => {
        if (!mounted.current) return;
        setBusy((b) => {
          const next = new Set(b);
          next.delete(id);
          return next;
        });
      });
  };

  const setPosted = (target: LedgerRow[], posted: boolean) => {
    if (target.length === 0 || posting) return;
    setPosting(true);
    app.service
      .setPosted(
        target.map((r) => r.line.id),
        posted
      )
      .then((updated) => {
        if (!mounted.current) return;
        replace(updated);
        setSelected((s) => {
          const next = new Set(s);
          for (const r of updated) next.delete(r.line.id);
          return next;
        });
        app.toast(
          posted
            ? `Marked ${updated.length} ${updated.length === 1 ? 'line' : 'lines'} Posted.`
            : `Set ${updated.length} ${updated.length === 1 ? 'line' : 'lines'} back to Not posted.`
        );
      })
      .catch(app.reportError)
      .finally(() => {
        if (mounted.current) setPosting(false);
      });
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.line.id));
  const toggleAllVisible = () =>
    setSelected((s) => {
      const next = new Set(s);
      for (const r of visible) {
        if (allVisibleSelected) next.delete(r.line.id);
        else next.add(r.line.id);
      }
      return next;
    });

  const download = () => {
    downloadFile(buildLedgerWorkbook(shown), ledgerFileName(toIsoDate(new Date())), XLSX_TYPE);
  };

  const canOpenRequests = app.user.isAdministrator;
  const postedMode = filter === 'posted';

  return (
    <>
      <HeaderCard
        title="Ledger"
        subtitle="Every purchase line that has been bought, ready for QuickBooks. Choose the account and the class, then mark each line Posted when it is entered."
      />
      <Card>
        <div className="ctx-ledger-bar">
          <div className="ctx-tabs" role="tablist" aria-label="Show lines that are">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={filter === t.id}
                className={`ctx-tab ${filter === t.id ? 'active' : ''}`}
                onClick={() => {
                  setFilter(t.id);
                  setLimit(PAGE_ROWS);
                }}
              >
                {t.label} ({counts[t.id]})
              </button>
            ))}
          </div>
          <div className="ctx-ledger-actions">
            <input
              className="ctx-input ctx-ledger-search"
              type="search"
              placeholder="Search request, vendor, account"
              aria-label="Search the ledger"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(PAGE_ROWS);
              }}
            />
            <button className="ctx-btn ctx-btn-secondary" onClick={download} disabled={shown.length === 0} title="Saves the lines shown, as an Excel file">
              <Icon name="file" size={15} /> Download Excel
            </button>
            {postedMode ? (
              <button className="ctx-btn ctx-btn-secondary" disabled={picked.length === 0 || posting} onClick={() => setPosted(picked, false)}>
                <Icon name="undo" size={15} /> Set {picked.length} back to Not posted
              </button>
            ) : (
              <button className="ctx-btn ctx-btn-primary" disabled={picked.length === 0 || posting} onClick={() => setPosted(picked, true)}>
                <Icon name="check" size={15} /> Mark {picked.length} selected Posted
              </button>
            )}
          </div>
        </div>

        {rows === null ? (
          <div className="ctx-empty">Loading</div>
        ) : shown.length === 0 ? (
          <div className="ctx-empty">
            <Icon name="book" size={28} />
            <h3>{rows.length === 0 ? 'Nothing to post yet' : search.trim() ? 'No line matches' : filter === 'posted' ? 'Nothing posted yet' : 'All posted'}</h3>
            {rows.length === 0
              ? 'Lines appear here once a request has been bought and packaged.'
              : search.trim()
                ? 'Change or clear the search.'
                : filter === 'posted'
                  ? 'Lines you mark Posted appear here.'
                  : 'Every line shown in All has been posted.'}
          </div>
        ) : (
          <>
            <div className="ctx-table-wrap">
              <table className="ctx-table ctx-ledger-table">
                <thead>
                  <tr>
                    <th>
                      <input type="checkbox" aria-label="Select all lines shown" checked={allVisibleSelected} onChange={toggleAllVisible} />
                    </th>
                    <th>Posted</th>
                    <th>Request</th>
                    <th className="ctx-ledger-what">What was bought</th>
                    <th className="num">Total</th>
                    <th className="ctx-ledger-receipt">Receipt</th>
                    <th className="ctx-ledger-pick">QuickBooks account</th>
                    <th className="ctx-ledger-pick">Class</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const label = lineLabel(row);
                    const locked = row.entry.posted || busy.has(row.line.id);
                    const problem = row.entry.posted ? '' : postProblem(row);
                    const paid = ledgerPaidBy(row);
                    return (
                      <tr key={row.line.id} className={row.entry.posted ? 'ctx-ledger-done' : ''}>
                        <td>
                          <input type="checkbox" aria-label={`Select ${label}`} checked={selected.has(row.line.id)} onChange={() => toggle(row.line.id)} />
                        </td>
                        <td className="nowrap">
                          {row.entry.posted ? <Badge tone="green">Posted</Badge> : <Badge tone="amber">Not posted</Badge>}
                          {row.entry.posted ? (
                            <div className="ctx-hint" title={`Posted by ${row.entry.postedBy} on ${row.entry.postedOn}`}>
                              {row.entry.postedBy}, {row.entry.postedOn.slice(0, 10)}
                            </div>
                          ) : problem ? (
                            <div className="ctx-hint">{row.entry.className === '' ? 'Needs a class' : 'Needs an account'}</div>
                          ) : null}
                        </td>
                        <td className="ctx-strong nowrap">
                          {canOpenRequests ? (
                            <a href={`#/admin/request/${row.line.requestId}`} title={`Open ${row.requestNumber}`}>
                              {row.requestNumber}
                            </a>
                          ) : (
                            row.requestNumber
                          )}
                          <div className="ctx-hint">
                            row {row.line.rowNumber}, {row.line.date}
                          </div>
                        </td>
                        <td>
                          <span className="ctx-strong">{row.line.vendor}</span>
                          <div>
                            {row.line.description}
                            {row.line.quantity > 1 ? <span className="ctx-muted"> (quantity {row.line.quantity})</span> : null}
                            {row.line.rowKind !== '' ? (
                              <>
                                {' '}
                                <Tag tone="lavender">{row.line.rowKind === 'shipping' ? 'Shipping' : 'Tax'}</Tag>
                              </>
                            ) : null}
                          </div>
                        </td>
                        <td className="num nowrap">
                          {row.line.amountCents === null ? '' : formatCents(row.line.amountCents)}
                          {paid ? <div className="ctx-hint">{paid.reimbursable ? 'To reimburse' : `Paid by ${paid.label.toLowerCase()}`}</div> : null}
                        </td>
                        <td className="ctx-ledger-receipt">
                          {row.receipts.length === 0 ? (
                            <span className="ctx-muted">{row.line.noReceiptReason ? `No receipt: ${row.line.noReceiptReason}` : 'No receipt'}</span>
                          ) : (
                            row.receipts.map((r) => (
                              <div key={r.fileName}>
                                {r.url ? (
                                  <a href={r.url} target="_blank" rel="noopener noreferrer" title={`Open ${r.fileName}`}>
                                    {r.fileName}
                                  </a>
                                ) : (
                                  <span title="The link is not ready yet. The flow adds it when it has copied the receipts.">{r.fileName}</span>
                                )}
                              </div>
                            ))
                          )}
                          {row.receiptPlace === 'request folder' ? (
                            <div
                              className="ctx-hint"
                              title="This request was packaged before the receipt archive existed. The link stops working if the request folder is filed."
                            >
                              request folder
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <Combobox
                            label={`${label} account`}
                            value={effectiveAccount(row)}
                            disabled={locked}
                            allowClear={row.entry.account !== ''}
                            invalid={!row.entry.posted && effectiveAccount(row) === ''}
                            placeholder="Choose an account"
                            getLayers={() => accountLayers(row.line, history)}
                            onChoose={(text) => changeEntry(row, { account: text })}
                          />
                        </td>
                        <td>
                          <Combobox
                            label={`${label} class`}
                            value={row.entry.className}
                            disabled={locked}
                            placeholder="Choose a class"
                            invalid={!row.entry.posted && row.entry.className === ''}
                            getLayers={() => classLayers(row.line, history)}
                            onChoose={(text) => changeEntry(row, { className: text })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {shown.length > visible.length ? (
              <div className="ctx-ledger-more">
                <button className="ctx-btn ctx-btn-secondary ctx-btn-small" onClick={() => setLimit((n) => n + PAGE_ROWS)}>
                  Show {Math.min(PAGE_ROWS, shown.length - visible.length)} more ({shown.length - visible.length} not shown)
                </button>
              </div>
            ) : null}
            <div className="ctx-hint" style={{ marginTop: 10 }}>
              Posted lines are locked: set one back to Not posted to change its account or class. Every change is kept in the line&apos;s SharePoint version
              history.
            </div>
          </>
        )}
      </Card>
    </>
  );
}
