import * as React from 'react';
import { findCategory, findPaymentType } from '../../../domain/lists';
import { messages } from '../../../domain/messages';
import { formatCents } from '../../../domain/money';
import { hasReceipt } from '../../../domain/receipts';
import { PACKAGE_STATUS_DISPLAY, REPORT_STATUS_DISPLAY } from '../../../domain/statuses';
import { ExpenseLine, Submission, TravelReport } from '../../../domain/types';
import { CSV_COLUMNS } from '../../../export/csv';
import { buildEmailSummary } from '../../../export/email';
import { packageReceipts } from '../../../domain/naming';
import { computeTotals } from '../../../domain/totals';
import { MILEAGE, activeTrips, mileageAmountCents, tripLabel } from '../../../domain/mileage';
import { validateReport } from '../../../domain/validation';
import { useApp } from '../../AppContext';
import { Badge, Card, Dialog, HeaderCard } from '../../components/common';
import { Icon } from '../../components/Icon';

/** Reads the app's own CSV back into rows for the preview. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const body = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' && body[i + 1] === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      i++;
    } else cell += ch;
  }
  return rows;
}

type Tab = 'expenses' | 'email' | 'csv' | 'folder';

export function AdminReportPage(props: { reportId: number }): React.ReactElement {
  const app = useApp();
  const [report, setReport] = React.useState<TravelReport | null>(null);
  const [lines, setLines] = React.useState<ExpenseLine[]>([]);
  const [submissions, setSubmissions] = React.useState<Submission[]>([]);
  const [csv, setCsv] = React.useState('');
  const [tab, setTab] = React.useState<Tab>('expenses');
  const [returning, setReturning] = React.useState(false);
  const [note, setNote] = React.useState('');
  const [loadError, setLoadError] = React.useState(false);

  const load = React.useCallback(async (): Promise<void> => {
    const data = await app.service.getReport(props.reportId);
    const subs = await app.service.listSubmissionsForReport(props.reportId);
    setReport(data.report);
    setLines(data.lines);
    setSubmissions(subs);
    const latest = subs.slice().sort((a, b) => b.submissionNumber - a.submissionNumber)[0];
    setCsv(latest ? await app.service.getSubmissionCsv(latest.id) : '');
  }, [app.service, props.reportId]);

  React.useEffect(() => {
    load().catch(() => setLoadError(true));
  }, [load]);

  if (!report) {
    return loadError ? (
      <div className="ctx-banner red" role="alert">
        {messages.loadFailed}
      </div>
    ) : (
      <div className="ctx-empty">Loading</div>
    );
  }
  const latest = submissions.slice().sort((a, b) => b.submissionNumber - a.submissionNumber)[0];
  const status = REPORT_STATUS_DISPLAY[report.status];
  const pkg = latest ? PACKAGE_STATUS_DISPLAY[latest.packageStatus] : null;
  const csvRows = csv ? parseCsv(csv) : [];
  const summaryText = latest
    ? buildEmailSummary({
        report,
        lines,
        totals: computeTotals(lines, activeTrips(report)),
        submitterName: report.ownerName,
        certification: { email: latest.submitterEmail, text: latest.certificationText, submittedOn: latest.submittedOn },
        receiptCount: packageReceipts(lines).length,
        warnings: validateReport(report, lines, [], latest.submittedOn.slice(0, 10)).filter((i) => i.severity === 'warning'),
        previousFolderName: latest.previousFolderName
      })
    : '';

  const act = async (work: () => Promise<unknown>, done: string): Promise<void> => {
    try {
      await work();
      app.toast(done);
      app.refreshAdminCounts();
      await load();
    } catch (e) {
      app.reportError(e);
    }
  };

  return (
    <>
      <HeaderCard
        title={`${report.reportNumber} ${report.tripName}`}
        subtitle={`Submitted by ${report.ownerName}${report.submittedOn ? ` on ${report.submittedOn}` : ''}`}
        badges={
          <>
            <Badge tone={status.tone}>{status.label}</Badge>
            {pkg ? <Badge tone={pkg.tone}>{pkg.label}</Badge> : null}
          </>
        }
        actions={
          report.status === 'Submitted' ? (
            <>
              {latest && latest.packageStatus === 'Failed' ? (
                <button className="ctx-btn ctx-btn-secondary" onClick={() => act(() => app.service.retryPackaging(latest.id), 'Packaging started again.')}>
                  <Icon name="refresh" size={16} />
                  Retry packaging
                </button>
              ) : null}
              <button className="ctx-btn ctx-btn-secondary" onClick={() => setReturning(true)}>
                <Icon name="undo" size={16} />
                Return with a note
              </button>
              <button
                className="ctx-btn ctx-btn-primary"
                onClick={() => act(() => app.service.markProcessed(report.id), `${report.reportNumber} marked processed.`)}
              >
                <Icon name="check" size={16} />
                Mark processed
              </button>
            </>
          ) : null
        }
      />
      {latest && latest.packageStatus === 'Failed' ? (
        <div className="ctx-banner red">
          <Icon name="alert" />
          <div>
            <strong>The folder was not created.</strong> {latest.errorMessage} If a partial folder exists in Trips_To_Process, delete it first, then click Retry
            packaging.
          </div>
        </div>
      ) : null}
      {report.status === 'Submitted' && latest && latest.packageStatus === 'Packaged' ? (
        <div className="ctx-banner purple">
          <Icon name="folder" />
          <div>
            <strong>Folder:</strong> <span className="ctx-code">{latest.folderLink || latest.folderName}</span>
            <br />
            When you have processed it, move the folder into <span className="ctx-code">Accounting &gt; Trips &gt; {report.tripStart.slice(0, 4)}</span> and
            click Mark processed.
          </div>
        </div>
      ) : null}
      <div className="ctx-totals">
        <div className="ctx-metric">
          <div className="ctx-metric-label">To reimburse</div>
          <div className="ctx-metric-value">{formatCents(report.totalReimburseCents)}</div>
          <div className="ctx-metric-note">To {report.ownerName}</div>
        </div>
        <div className="ctx-metric">
          <div className="ctx-metric-label">Company-paid</div>
          <div className="ctx-metric-value">{formatCents(report.totalCompanyCents)}</div>
          <div className="ctx-metric-note">Company card or paid by Clarus</div>
        </div>
        <div className="ctx-metric">
          <div className="ctx-metric-label">Trip total</div>
          <div className="ctx-metric-value">{formatCents(report.totalTripCents)}</div>
          <div className="ctx-metric-note">{lines.length} expenses</div>
        </div>
        <div className="ctx-metric">
          <div className="ctx-metric-label">Suggested class</div>
          <div className="ctx-metric-value" style={{ fontSize: '1rem' }}>
            {latest ? latest.suggestedClass || 'Not sure' : ''}
          </div>
          <div className="ctx-metric-note">{latest ? latest.tripPurpose : ''}</div>
        </div>
      </div>
      <Card>
        <div className="ctx-tabs" role="tablist">
          {(
            [
              ['expenses', 'Expenses'],
              ['email', 'Email'],
              ['csv', 'CSV file'],
              ['folder', 'Folder contents']
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`ctx-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'expenses' ? (
          <table className="ctx-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Vendor</th>
                <th>Category</th>
                <th>Paid with</th>
                <th>Receipt</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id}>
                  <td>{l.rowNumber}</td>
                  <td>{l.date}</td>
                  <td>{l.vendor}</td>
                  <td>{findCategory(l.category)?.label}</td>
                  <td>{findPaymentType(l.paymentType)?.shortLabel}</td>
                  <td>
                    {hasReceipt(l, lines) ? (
                      l.sameReceiptAsRow !== null ? (
                        `Row ${l.sameReceiptAsRow}'s`
                      ) : (
                        'Yes'
                      )
                    ) : (
                      <span style={{ color: 'var(--c-warning)' }}>None: {l.noReceiptReason}</span>
                    )}
                  </td>
                  <td className="num">{l.amountCents === null ? '' : formatCents(l.amountCents)}</td>
                </tr>
              ))}
              {activeTrips(report).map((t, i) => {
                const cents = mileageAmountCents(t);
                return (
                  <tr key={t.id}>
                    <td>{tripLabel(i)}</td>
                    <td>{t.date}</td>
                    <td>
                      {t.from} to {t.to}, {t.miles ?? ''} miles
                    </td>
                    <td>{MILEAGE.label}</td>
                    <td>Own car</td>
                    <td className="ctx-muted">Not needed</td>
                    <td className="num">{cents === null ? '' : formatCents(cents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
        {tab === 'email' && latest ? (
          <div className="ctx-email-preview">
            <div className="ctx-hint" style={{ marginBottom: 8 }}>
              <strong>Subject:</strong> {latest.emailSubject}
            </div>
            <h4>{latest.submissionNumber > 1 ? 'Travel report resubmitted' : 'Travel report submitted'}</h4>
            {/*
              Security: the summary is plain text, shown as text (D-067). Employees can edit their
              own list items directly in SharePoint (D-002), so stored text is never treated as HTML,
              here or in the email, where the flow escapes it.
            */}
            <div style={{ whiteSpace: 'pre-wrap' }}>{summaryText}</div>
            <p>
              <strong>Folder:</strong> Accounting &gt; Trips &gt; Trips_To_Process &gt; {latest.folderName} (link)
              <br />
              <strong>All reports waiting:</strong> Accounting &gt; Trips &gt; Trips_To_Process (link)
              <br />
              <strong>Open the report in Purchase Requests</strong> (link)
            </p>
          </div>
        ) : null}
        {tab === 'csv' ? (
          csvRows.length > 1 ? (
            <div className="ctx-grid-wrap">
              <table className="ctx-table nowrap" style={{ fontSize: '0.78rem' }}>
                <thead>
                  <tr>
                    {csvRows[0].map((h, i) => (
                      <th key={i}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvRows.slice(1).map((r, i) => (
                    <tr key={i}>
                      {r.map((c, j) => (
                        <td key={j}>{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="ctx-hint" style={{ marginTop: 8 }}>
                {CSV_COLUMNS.length} columns. Opens directly in Excel.
              </div>
            </div>
          ) : (
            <div className="ctx-empty">No CSV yet.</div>
          )
        ) : null}
        {tab === 'folder' && latest ? (
          <div>
            <div className="ctx-hint" style={{ marginBottom: 10 }}>
              <span className="ctx-code">Accounting &gt; Trips &gt; Trips_To_Process &gt; {latest.folderName}</span>
            </div>
            <table className="ctx-table">
              <tbody>
                {latest.packageFileNames.map((name) => (
                  <tr key={name}>
                    <td>
                      <Icon name="file" size={14} /> {name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>
      {returning ? (
        <Dialog
          title={`Return ${report.reportNumber} to ${report.ownerName}`}
          onClose={() => setReturning(false)}
          actions={
            <>
              <button className="ctx-btn ctx-btn-secondary" onClick={() => setReturning(false)}>
                Cancel
              </button>
              <button
                className="ctx-btn ctx-btn-primary"
                disabled={!note.trim()}
                onClick={() => {
                  setReturning(false);
                  void act(() => app.service.returnReport(report.id, note.trim()), `${report.reportNumber} returned to ${report.ownerName}.`);
                }}
              >
                Return report
              </button>
            </>
          }
        >
          <label className="ctx-label" htmlFor="return-note">
            What needs correcting? The employee sees this note.
          </label>
          <textarea
            id="return-note"
            className="ctx-textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="For example: Row 2, please attach the itemized hotel bill."
          />
          <div className="ctx-hint">
            After returning, delete this report&apos;s folder from Trips_To_Process. The corrected report arrives as a new folder ending in _R2.
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
