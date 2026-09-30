import * as React from 'react';
import { LineRef } from '../../domain/duplicates';
import { findTripPurpose, TRIP_PURPOSES, findCategory, findPaymentType, TEXT_MAX_LENGTH } from '../../domain/lists';
import { destinationSuggestions, vendorSuggestions } from '../../domain/defaults';
import { messages } from '../../domain/messages';
import { formatCents } from '../../domain/money';
import { checkReceiptFile, hasReceipt } from '../../domain/receipts';
import { marksAfterEdit, readingChanges, shouldReadReceipt, vendorMemoryChanges } from '../../domain/suggestions';
import { isEditable, PACKAGE_STATUS_DISPLAY, REPORT_STATUS_DISPLAY } from '../../domain/statuses';
import { computeTotals } from '../../domain/totals';
import { MILEAGE, activeTrips, mileageAmountCents, tripLabel } from '../../domain/mileage';
import { todayIso } from '../../domain/dates';
import { ExpenseLine, Submission, TravelReport } from '../../domain/types';
import { blockingIssues, Issue, issuePrefix, ReportField, validateReport } from '../../domain/validation';
import { LineChanges, ReportChanges } from '../../data/TravelDataService';
import { SubmissionBlockedError } from '../../export/submission';
import { useApp } from '../AppContext';
import { Badge, Card, Dialog, HeaderCard, IssueLine, SavedIndicator, TotalsStrip } from '../components/common';
import { DropZone } from '../components/DropZone';
import { ExpenseGrid } from '../components/ExpenseGrid';
import { MileageCard } from '../components/MileageCard';
import { Icon } from '../components/Icon';
import { ReceiptPreview } from '../components/ReceiptPreview';
import { ReportNav } from '../components/Sidebar';
import { ReportStep } from '../routing';

const SAVE_DELAY_MS = 500;
/** From this window width the receipt sits beside the grid; below it, it slides over (D-033). */
export const WIDE_LAYOUT_PX = 1600;
const STEP_NUMBER: Record<ReportStep, number> = { trip: 1, expenses: 2, review: 3 };

/** Shown once per page load if the receipt reader cannot start (D-074). */
let readerWarningShown = false;

/** A row nobody has started filling in yet: shown as "to fill in", not in red. */
function isFresh(line: ExpenseLine): boolean {
  return !line.date && !line.vendor && !line.category && line.amountCents === null && !line.paymentType;
}

export function ReportWorkspace(props: { reportId: number; step: ReportStep }): React.ReactElement {
  const app = useApp();
  const { service } = app;
  const [report, setReport] = React.useState<TravelReport | null>(null);
  const [lines, setLines] = React.useState<ExpenseLine[]>([]);
  const [others, setOthers] = React.useState<LineRef[]>([]);
  const [submissions, setSubmissions] = React.useState<Submission[]>([]);
  const [destinationOptions, setDestinationOptions] = React.useState<string[]>([]);
  const [loadError, setLoadError] = React.useState('');
  const [selectedLineId, setSelectedLineId] = React.useState<string | null>(null);
  const [wide, setWide] = React.useState(() => window.innerWidth >= WIDE_LAYOUT_PX);
  const [showPreview, setShowPreview] = React.useState(true);
  const [overlayOpen, setOverlayOpen] = React.useState(false);
  const [touchedFields, setTouchedFields] = React.useState<Record<string, boolean>>({});
  const [touchedLines, setTouchedLines] = React.useState<Record<string, boolean>>({});
  const [showAllIssues, setShowAllIssues] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [confirm, setConfirm] = React.useState<'submit' | 'delete' | null>(null);
  const [certified, setCertified] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  // Receipt suggestions (D-074, D-078): rows being read, and rows where the
  // employee has chosen "Paid with" themselves, so vendor memory leaves it alone.
  const [readingLineIds, setReadingLineIds] = React.useState<ReadonlySet<string>>(new Set());
  const paidWithChosen = React.useRef<Record<string, boolean>>({});
  const linesRef = React.useRef<ExpenseLine[]>([]);
  linesRef.current = lines;
  const othersRef = React.useRef<LineRef[]>([]);
  othersRef.current = others;
  // Reading stops if the employee leaves the report; rows already filled are saved.
  const mounted = React.useRef(true);
  React.useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  // Automatic saving (D-033): changes are collected and written shortly after the last keystroke.
  const reportChanges = React.useRef<ReportChanges>({});
  const lineChanges = React.useRef<Record<string, LineChanges>>({});
  const timer = React.useRef<number | undefined>(undefined);
  const inflight = React.useRef(0);

  const load = React.useCallback(async () => {
    try {
      const [data, other, subs] = await Promise.all([
        service.getReport(props.reportId),
        service.getOwnerOtherLines(props.reportId),
        service.listSubmissionsForReport(props.reportId)
      ]);
      if (data.report.ownerEmail === app.user.email) {
        const mine = await service.listMyReports();
        setDestinationOptions(destinationSuggestions(mine.filter((r) => r.id !== props.reportId)));
      }
      setReport(data.report);
      setLines(data.lines);
      setOthers(other);
      setSubmissions(subs);
      setSelectedLineId((current) => current ?? (data.lines[0] ? data.lines[0].id : null));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, [service, props.reportId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= WIDE_LAYOUT_PX);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const flush = React.useCallback(async () => {
    window.clearTimeout(timer.current);
    const rc = reportChanges.current;
    const lc = lineChanges.current;
    reportChanges.current = {};
    lineChanges.current = {};
    const jobs: Promise<unknown>[] = [];
    if (Object.keys(rc).length > 0) jobs.push(service.updateReport(props.reportId, rc));
    for (const [id, changes] of Object.entries(lc)) jobs.push(service.updateLine(id, changes));
    if (jobs.length === 0) {
      setSaving(inflight.current > 0);
      return;
    }
    inflight.current += 1;
    try {
      await Promise.all(jobs);
    } catch (e) {
      app.toast(`Could not save: ${e instanceof Error ? e.message : String(e)}`, 'warning');
    } finally {
      inflight.current -= 1;
      setSaving(inflight.current > 0 || Object.keys(reportChanges.current).length > 0 || Object.keys(lineChanges.current).length > 0);
    }
  }, [service, props.reportId, app]);

  const scheduleSave = () => {
    setSaving(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void flush();
    }, SAVE_DELAY_MS);
  };

  React.useEffect(
    () => () => {
      void flush();
    },
    [flush]
  );

  // While a package is being created, check its progress.
  const latest = submissions.slice().sort((a, b) => b.submissionNumber - a.submissionNumber)[0];
  React.useEffect(() => {
    if (!latest || latest.packageStatus === 'Packaged' || latest.packageStatus === 'Failed') return;
    const t = window.setInterval(async () => {
      try {
        setSubmissions(await service.listSubmissionsForReport(props.reportId));
      } catch {
        // Checked again on the next tick.
      }
    }, 1200);
    return () => window.clearInterval(t);
  }, [latest && latest.packageStatus, service, props.reportId]);

  const editable = !!report && isEditable(report.status) && report.ownerEmail === app.user.email;
  // A report already sent is checked as of the day it was submitted.
  const asOf = report && !editable && report.submittedOn ? report.submittedOn.slice(0, 10) : todayIso();
  const issues: Issue[] = React.useMemo(() => (report ? validateReport(report, lines, others, asOf) : []), [report, lines, others, asOf]);
  const blocking = blockingIssues(issues);
  const warnings = issues.filter((i) => i.severity === 'warning');
  const totals = computeTotals(lines, report ? activeTrips(report) : []);

  // Issues shown on screen: rows nobody has started are "to fill in", not red.
  const shownIssues = issues.filter((i) => {
    if (i.scope === 'report') return showAllIssues || touchedFields[i.field];
    if (i.scope === 'mileage') {
      const trip = report ? report.mileageTrips.find((t) => t.id === i.tripId) : undefined;
      return showAllIssues || (!!trip && (!!trip.date || !!trip.from || !!trip.to || trip.miles !== null));
    }
    const line = lines.find((l) => l.id === i.lineId);
    return !!line && (showAllIssues || touchedLines[line.id] || !isFresh(line));
  });

  // Sidebar steps.
  React.useEffect(() => {
    if (!report) return;
    const reportIssues = issues.filter((i) => i.scope === 'report' && i.field !== 'rows' && i.severity === 'blocking').length;
    const tripEmpty = !report.tripName && !report.destination && !report.businessPurpose && !report.tripPurpose && !report.tripStart;
    const rowBlocking =
      new Set(blocking.filter((i) => i.scope === 'row').map((i) => i.lineId)).size +
      new Set(blocking.filter((i) => i.scope === 'mileage').map((i) => i.tripId)).size;
    const tripCount = activeTrips(report).length;
    const counted = `${lines.length} expenses${tripCount > 0 ? `, ${tripCount} ${tripCount === 1 ? 'drive' : 'drives'}` : ''}`;
    const locked = !editable;
    const nav: ReportNav = {
      reportId: report.id,
      reportNumber: report.reportNumber,
      steps: {
        trip: locked
          ? { state: 'done', status: 'Read-only' }
          : reportIssues > 0
            ? { state: tripEmpty ? 'waiting' : 'attention', status: tripEmpty ? 'To fill in' : `${reportIssues} to fix` }
            : { state: 'done', status: 'Complete' },
        expenses: locked
          ? { state: 'done', status: counted }
          : lines.length === 0 && tripCount === 0
            ? { state: 'waiting', status: 'No expenses yet' }
            : rowBlocking > 0
              ? { state: 'attention', status: `${counted}, ${rowBlocking} to fix` }
              : { state: 'done', status: `${counted}, all complete` },
        review: locked
          ? { state: 'done', status: REPORT_STATUS_DISPLAY[report.status].label }
          : blocking.length === 0
            ? { state: 'current', status: 'Ready to submit' }
            : { state: 'waiting', status: `${blocking.length} to fix first` }
      }
    };
    app.setReportNav(nav);
  }, [report, lines, issues, editable]);

  React.useEffect(() => () => app.setReportNav(null), []);

  React.useEffect(() => {
    if (props.step === 'review') setShowAllIssues(true);
  }, [props.step]);

  if (loadError) {
    return (
      <div className="ctx-banner red">
        <Icon name="alert" />
        {loadError}
      </div>
    );
  }
  if (!report) return <div className="ctx-empty">Loading</div>;

  const changeReport = (changes: ReportChanges) => {
    setReport({ ...report, ...changes });
    reportChanges.current = { ...reportChanges.current, ...changes };
    setTouchedFields((t) => ({ ...t, ...Object.fromEntries(Object.keys(changes).map((k) => [k, true])) }));
    scheduleSave();
  };

  // Past rows of this employee, oldest first, for vendor suggestions and vendor memory (D-057, D-074).
  const historyFor = (lineId: string): ExpenseLine[] =>
    [...othersRef.current.map((o) => o.line), ...linesRef.current].filter((l) => l.id !== lineId).sort((a, b) => a.date.localeCompare(b.date));
  const history = [...others.map((o) => o.line), ...lines].sort((a, b) => a.date.localeCompare(b.date));

  // Writes changes to a row on screen, and saves them shortly after.
  const applyLineChanges = (lineId: string, changes: LineChanges) => {
    setLines((current) => current.map((l) => (l.id === lineId ? { ...l, ...changes } : l)));
    lineChanges.current = { ...lineChanges.current, [lineId]: { ...lineChanges.current[lineId], ...changes } };
    scheduleSave();
  };

  // A change the employee made. An edited value is theirs, so its Suggested
  // mark goes (D-078); a vendor they typed brings in vendor memory (D-074).
  const changeLine = (lineId: string, requested: LineChanges) => {
    const current = lines.find((l) => l.id === lineId);
    if (!current) return;
    if (requested.paymentType !== undefined) paidWithChosen.current[lineId] = true;
    let changes: LineChanges = { ...requested };
    const marks = marksAfterEdit(current, Object.keys(requested));
    if (marks) changes.suggested = marks;
    if (requested.vendor !== undefined) {
      const memory = vendorMemoryChanges(requested.vendor, { ...current, ...changes }, historyFor(lineId), {
        paidWithChosen: !!paidWithChosen.current[lineId],
        vendorSuggested: false
      });
      changes = { ...changes, ...memory };
    }
    applyLineChanges(lineId, changes);
    setTouchedLines((t) => ({ ...t, [lineId]: true }));
  };

  const confirmLine = (lineId: string) => applyLineChanges(lineId, { suggested: [] });

  // Reads receipts one after another and fills in their rows' empty fields
  // (D-074). Returns how many rows got suggestions.
  const readReceipts = async (jobs: { lineId: string; file: File }[]): Promise<number> => {
    const reader = app.reader;
    if (!reader) return 0;
    let filled = 0;
    for (const job of jobs) {
      const before = linesRef.current.find((l) => l.id === job.lineId);
      if (!mounted.current) return filled;
      if (!before || !shouldReadReceipt(before) || !reader.available) continue;
      setReadingLineIds((ids) => new Set(ids).add(job.lineId));
      const guess = await reader.read(job.file, job.file.name);
      if (!mounted.current) return filled;
      setReadingLineIds((ids) => {
        const next = new Set(ids);
        next.delete(job.lineId);
        return next;
      });
      // The employee may have typed or deleted the row meanwhile: use it as it is now.
      const line = linesRef.current.find((l) => l.id === job.lineId);
      if (!guess || !line) continue;
      const changes = readingChanges(line, guess, historyFor(line.id), todayIso(), !!paidWithChosen.current[line.id]);
      if (changes) {
        applyLineChanges(line.id, changes);
        filled += 1;
      }
    }
    if (mounted.current && !reader.available && !readerWarningShown) {
      readerWarningShown = true;
      app.toast(messages.readerUnavailable, 'warning');
    }
    return filled;
  };

  // Runs a change that adds or removes rows or files, then reloads. Errors are
  // shown to the employee; it never throws.
  const structural = async (work: () => Promise<unknown>): Promise<void> => {
    setBusy(true);
    try {
      await flush();
      await work();
      await load();
    } catch (e) {
      app.reportError(e);
    } finally {
      setBusy(false);
    }
  };

  const addFiles = (files: File[]) => {
    const accepted: File[] = [];
    for (const f of files) {
      const check = checkReceiptFile(f.name, f.size);
      if (check.ok) accepted.push(f);
      else
        app.toast(
          check.reason === 'type' ? messages.fileWrongType(f.name) : check.reason === 'size' ? messages.fileTooLarge(f.name) : messages.fileEmpty(f.name),
          'warning'
        );
    }
    if (accepted.length === 0) return;
    let added: ExpenseLine[] = [];
    void structural(async () => {
      added = await service.addLinesFromFiles(report.id, accepted);
      if (added[0]) setSelectedLineId(added[0].id);
      app.toast(added.length === 1 ? '1 receipt added as a new row.' : `${added.length} receipts added as new rows.`);
    }).then(async () => {
      // The service adds one row per file, in order (it may rename the file).
      const jobs = added.length === accepted.length ? added.map((line, i) => ({ lineId: line.id, file: accepted[i] })) : [];
      const filled = await readReceipts(jobs);
      if (filled > 0) app.toast(messages.receiptsRead(filled));
    });
  };

  const goStep = (step: ReportStep) => app.navigate({ name: 'report', reportId: report.id, step });

  const submit = async () => {
    setConfirm(null);
    setBusy(true);
    try {
      await flush();
      await service.submitReport(report.id, messages.certification);
      await load();
      app.toast('Report submitted. The administrator has been notified.');
      app.refreshAdminCounts();
    } catch (e) {
      if (e instanceof SubmissionBlockedError) {
        setShowAllIssues(true);
        app.toast(e.message, 'warning');
      } else app.reportError(e);
    } finally {
      setBusy(false);
    }
  };

  const deleteDraft = async (): Promise<void> => {
    setConfirm(null);
    try {
      await flush();
      await service.deleteReport(report.id);
      app.toast(`${report.reportNumber} deleted.`);
      app.navigate({ name: 'home' });
    } catch (e) {
      app.reportError(e);
    }
  };

  const status = REPORT_STATUS_DISPLAY[report.status];
  const freshReport = !report.tripName && !report.destination && !report.businessPurpose && !report.tripPurpose && !report.tripStart && lines.length === 0;
  const statusMetric = editable
    ? undefined
    : {
        label: 'Status',
        value: <Badge tone={status.tone}>{status.label}</Badge>,
        note: report.status === 'Processed' ? `Processed ${report.processedOn}` : report.status === 'Submitted' ? `Submitted ${report.submittedOn}` : ''
      };
  const sidePreview = wide && showPreview;
  const openReceipt = (lineId: string) => {
    setSelectedLineId(lineId);
    if (wide) setShowPreview(true);
    else setOverlayOpen(true);
  };
  const title = report.tripName || 'New trip report';
  const subtitle = `${report.reportNumber}, step ${STEP_NUMBER[props.step]} of 3${editable ? '' : `. ${status.help}`}`;
  const instructionsButton = (
    <button className="ctx-btn ctx-btn-secondary" onClick={app.openInstructions}>
      <Icon name="book" size={16} />
      Instructions
    </button>
  );

  let primary: React.ReactNode = null;
  if (props.step === 'trip')
    primary = (
      <button className="ctx-btn ctx-btn-primary" onClick={() => goStep('expenses')}>
        Next: Expenses
        <Icon name="arrowRight" size={16} />
      </button>
    );
  else if (props.step === 'expenses')
    primary = (
      <button className="ctx-btn ctx-btn-primary" onClick={() => goStep('review')}>
        Next: Review
        <Icon name="arrowRight" size={16} />
      </button>
    );
  else if (editable)
    primary = (
      <button
        className="ctx-btn ctx-btn-primary"
        disabled={blocking.length > 0 || busy}
        onClick={() => {
          setCertified(false);
          setConfirm('submit');
        }}
      >
        <Icon name="send" size={16} />
        Submit report
      </button>
    );

  return (
    <>
      <HeaderCard
        title={title}
        subtitle={subtitle}
        badges={
          <>
            <Badge tone={status.tone}>{status.label}</Badge>
            {editable ? <SavedIndicator saving={saving} /> : null}
          </>
        }
        actions={
          <>
            {instructionsButton}
            {primary}
          </>
        }
      />
      <StatusBanner report={report} latest={latest} />
      <TotalsStrip totals={totals} blockingCount={blocking.length} warningCount={warnings.length} fresh={freshReport} status={statusMetric} />

      {props.step === 'trip' ? (
        <TripDetailsStep report={report} issues={shownIssues} editable={editable} onChange={changeReport} destinationOptions={destinationOptions} />
      ) : null}

      {props.step === 'expenses' ? (
        <div className={`ctx-expenses-layout ${sidePreview ? '' : 'no-preview'}`}>
          <div className="ctx-stack">
            {editable ? <DropZone onFiles={addFiles} disabled={busy} /> : null}
            <Card
              title={`Expenses (${lines.length})`}
              actions={
                !sidePreview && lines.length > 0 ? (
                  <button className="ctx-btn ctx-btn-ghost ctx-btn-small" onClick={() => (wide ? setShowPreview(true) : setOverlayOpen(true))}>
                    <Icon name="eye" size={15} />
                    Show receipt
                  </button>
                ) : null
              }
            >
              {lines.length === 0 ? (
                <div className="ctx-empty">
                  <Icon name="upload" size={28} />
                  <h3>No expenses yet</h3>
                  Drop your receipts in the box above. Each one becomes a row.
                </div>
              ) : (
                <ExpenseGrid
                  lines={lines}
                  issues={shownIssues}
                  readOnly={!editable}
                  selectedLineId={selectedLineId}
                  onSelect={setSelectedLineId}
                  onChange={changeLine}
                  onDelete={(id) => structural(() => service.deleteLine(id))}
                  onAddFile={(id, f) => {
                    const check = checkReceiptFile(f.name, f.size);
                    if (!check.ok) {
                      app.toast(
                        check.reason === 'type'
                          ? messages.fileWrongType(f.name)
                          : check.reason === 'size'
                            ? messages.fileTooLarge(f.name)
                            : messages.fileEmpty(f.name),
                        'warning'
                      );
                      return;
                    }
                    void structural(() => service.addFileToLine(id, f)).then(async () => {
                      if ((await readReceipts([{ lineId: id, file: f }])) > 0) app.toast(messages.receiptsRead(1));
                    });
                  }}
                  onRemoveFile={(id, receiptId) => structural(() => service.removeFileFromLine(id, receiptId))}
                  onOpenReceipt={openReceipt}
                  vendorOptions={vendorSuggestions(history)}
                  readingLineIds={readingLineIds}
                  onConfirm={confirmLine}
                />
              )}
              {lines.some((l) => isFresh(l) && !touchedLines[l.id]) && !showAllIssues ? (
                <div className="ctx-hint" style={{ marginTop: 10 }}>
                  New rows: fill in the date, vendor, category, amount and how it was paid.
                </div>
              ) : null}
              {editable ? (
                <div className="ctx-grid-footer">
                  <button className="ctx-btn ctx-btn-secondary ctx-btn-small" disabled={busy} onClick={() => structural(() => service.addEmptyLine(report.id))}>
                    <Icon name="plus" size={15} />
                    Add expense without receipt
                  </button>
                  <span className="ctx-hint">Enter moves down a column. Ctrl+D copies the row above. You can paste several rows from a spreadsheet.</span>
                </div>
              ) : null}
            </Card>
            {report.hasMileage ? (
              <MileageCard
                trips={report.mileageTrips}
                issues={shownIssues.filter((i) => i.scope === 'mileage')}
                editable={editable}
                onChange={(trips) => changeReport({ mileageTrips: trips })}
              />
            ) : null}
          </div>
          {sidePreview ? <ReceiptPreview line={lines.find((l) => l.id === selectedLineId)} lines={lines} onHide={() => setShowPreview(false)} /> : null}
          {!wide && overlayOpen ? (
            <ReceiptPreview overlay line={lines.find((l) => l.id === selectedLineId)} lines={lines} onHide={() => setOverlayOpen(false)} />
          ) : null}
        </div>
      ) : null}

      {props.step === 'review' ? (
        <ReviewStep
          report={report}
          latest={latest}
          lines={lines}
          issues={issues}
          editable={editable}
          onConfirm={confirmLine}
          onFix={(issue) => {
            if (issue.scope === 'report' && issue.field !== 'rows') goStep('trip');
            else {
              if (issue.lineId) setSelectedLineId(issue.lineId);
              goStep('expenses');
            }
          }}
          onDelete={() => setConfirm('delete')}
        />
      ) : null}

      {confirm === 'submit' ? (
        <Dialog
          title={`Submit ${report.reportNumber}?`}
          onClose={() => setConfirm(null)}
          actions={
            <>
              <button className="ctx-btn ctx-btn-secondary" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button className="ctx-btn ctx-btn-primary" onClick={submit} disabled={!certified} title={certified ? undefined : messages.certificationRequired}>
                Submit report
              </button>
            </>
          }
        >
          <p style={{ margin: 0 }}>{messages.submitConfirm}</p>
          <p style={{ margin: 0 }} className="ctx-hint">
            To reimburse: {formatCents(totals.reimburseCents)}. Trip total: {formatCents(totals.tripCents)}.
            {warnings.length > 0 ? ` ${warnings.length === 1 ? '1 warning' : `${warnings.length} warnings`} will be passed to the administrator.` : ''}
          </p>
          <label className="ctx-certify">
            <input type="checkbox" checked={certified} onChange={(e) => setCertified(e.target.checked)} />
            <span>{messages.certification}</span>
          </label>
          <p style={{ margin: 0 }} className="ctx-hint">
            Recorded with your account: {app.user.displayName} ({app.user.email}).
          </p>
        </Dialog>
      ) : null}
      {confirm === 'delete' ? (
        <Dialog
          title={`Delete ${report.reportNumber}?`}
          onClose={() => setConfirm(null)}
          actions={
            <>
              <button className="ctx-btn ctx-btn-secondary" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button className="ctx-btn ctx-btn-danger" onClick={deleteDraft}>
                Delete draft
              </button>
            </>
          }
        >
          <p style={{ margin: 0 }}>This draft and its receipts will be deleted. This cannot be undone.</p>
        </Dialog>
      ) : null}
    </>
  );
}

function StatusBanner(props: { report: TravelReport; latest: Submission | undefined }): React.ReactElement | null {
  const { report, latest } = props;
  if (report.status === 'Returned') {
    return (
      <div className="ctx-banner amber">
        <Icon name="undo" />
        <div>
          <strong>Returned by the administrator.</strong> {report.returnNote} Correct the report and submit it again.
        </div>
      </div>
    );
  }
  if (report.status === 'Submitted') {
    const pkg = latest ? PACKAGE_STATUS_DISPLAY[latest.packageStatus] : null;
    return (
      <div className="ctx-banner purple">
        <Icon name="send" />
        <div>
          <strong>Submitted {report.submittedOn}.</strong> The report is locked while it is processed.
          {pkg ? (
            <>
              {' '}
              <Badge tone={pkg.tone}>{pkg.label}</Badge>
            </>
          ) : null}
        </div>
      </div>
    );
  }
  if (report.status === 'Processed') {
    return (
      <div className="ctx-banner green">
        <Icon name="check" />
        <div>
          <strong>Processed {report.processedOn}</strong> by {report.processedBy}. This report is closed.
        </div>
      </div>
    );
  }
  return null;
}

function fieldError(issues: Issue[], field: ReportField): string | undefined {
  return issues.find((i) => i.scope === 'report' && i.field === field && i.severity === 'blocking')?.message;
}

function TripDetailsStep(props: {
  report: TravelReport;
  issues: Issue[];
  editable: boolean;
  onChange: (c: ReportChanges) => void;
  destinationOptions: string[];
}): React.ReactElement {
  const { report, issues, editable, onChange } = props;
  const field = (id: ReportField, label: string, input: React.ReactElement, span2 = false) => {
    const error = fieldError(issues, id);
    return (
      <div className={`ctx-field ${span2 ? 'ctx-span-2' : ''}`}>
        <label htmlFor={`trip-${id}`}>{label}</label>
        {React.cloneElement(input, { id: `trip-${id}`, className: `${input.props.className} ${error ? 'blocking' : ''}`, disabled: !editable })}
        {error ? <div className="ctx-field-error">{error}</div> : null}
      </div>
    );
  };
  const purposeError = fieldError(issues, 'tripPurpose');
  return (
    <div className="ctx-two-col">
      <Card title="Trip details">
        <datalist id="ctx-destination-options">
          {props.destinationOptions.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
        <div className="ctx-field-grid">
          {field(
            'tripName',
            'Trip name',
            <input
              className="ctx-input"
              placeholder="For example: Boston Conference"
              maxLength={TEXT_MAX_LENGTH}
              value={report.tripName}
              onChange={(e) => onChange({ tripName: e.target.value })}
            />
          )}
          {field(
            'destination',
            'Destination',
            <input
              className="ctx-input"
              placeholder="City, state or country"
              maxLength={TEXT_MAX_LENGTH}
              list="ctx-destination-options"
              value={report.destination}
              onChange={(e) => onChange({ destination: e.target.value })}
            />
          )}
          {field(
            'tripStart',
            'Trip start',
            <input type="date" className="ctx-input" value={report.tripStart} onChange={(e) => onChange({ tripStart: e.target.value })} />
          )}
          {field(
            'tripEnd',
            'Trip end',
            <input
              type="date"
              className="ctx-input"
              min={report.tripStart || undefined}
              value={report.tripEnd}
              onChange={(e) => onChange({ tripEnd: e.target.value })}
            />
          )}
          {field(
            'businessPurpose',
            'Business purpose',
            <textarea
              className="ctx-textarea"
              placeholder="What was the trip for? A sentence or two."
              value={report.businessPurpose}
              onChange={(e) => onChange({ businessPurpose: e.target.value })}
            />,
            true
          )}
        </div>
      </Card>
      <Card title="What was this trip for?">
        <div className="ctx-hint" style={{ marginBottom: 12 }}>
          This suggests how the trip is recorded in the accounts. Choose &quot;Not sure&quot; if you are unsure; the administrator decides.
        </div>
        <div className="ctx-choice-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }} role="radiogroup" aria-label="What was this trip for?">
          {TRIP_PURPOSES.map((p) => (
            <button
              key={p.id}
              role="radio"
              aria-checked={report.tripPurpose === p.id}
              className={`ctx-choice ${report.tripPurpose === p.id ? 'selected' : ''}`}
              disabled={!editable}
              onClick={() => onChange({ tripPurpose: p.id })}
            >
              <span className="ctx-choice-dot" />
              <span>
                <span className="ctx-choice-label">{p.label}</span>
              </span>
            </button>
          ))}
        </div>
        {purposeError ? <div className="ctx-field-error">{purposeError}</div> : null}
      </Card>
      <Card title="Mileage">
        <label className="ctx-option-row">
          <input type="checkbox" checked={report.hasMileage} disabled={!editable} onChange={(e) => onChange({ hasMileage: e.target.checked })} />
          <span>
            <strong>I drove my own car on this trip.</strong> Turn this on to add your drives on the Expenses step. They are paid at the GSA mileage rate, and
            no receipt is needed.
          </span>
        </label>
      </Card>
    </div>
  );
}

function ReviewStep(props: {
  report: TravelReport;
  latest: Submission | undefined;
  lines: ExpenseLine[];
  issues: Issue[];
  editable: boolean;
  onFix: (issue: Issue) => void;
  /** Confirms a row's suggested values (D-078). */
  onConfirm: (lineId: string) => void;
  onDelete: () => void;
}): React.ReactElement {
  const { report, lines, issues, editable } = props;
  const trips = activeTrips(report);
  // In the order they appear: report first, then rows, then drives.
  const position = (i: Issue) => (i.rowNumber ?? 0) + (i.tripLabel ? 10000 + Number(i.tripLabel.slice(1)) : 0);
  const blocking = issues.filter((i) => i.severity === 'blocking').sort((a, b) => position(a) - position(b));
  const warnings = issues.filter((i) => i.severity === 'warning').sort((a, b) => position(a) - position(b));
  const purpose = findTripPurpose(report.tripPurpose);
  return (
    <div className="ctx-stack">
      <div className="ctx-two-col">
        <Card title="Trip">
          <dl className="ctx-dl">
            <dt>Trip name</dt>
            <dd>{report.tripName || <span className="ctx-muted">Not entered</span>}</dd>
            <dt>Destination</dt>
            <dd>{report.destination || <span className="ctx-muted">Not entered</span>}</dd>
            <dt>Dates</dt>
            <dd>{report.tripStart && report.tripEnd ? `${report.tripStart} to ${report.tripEnd}` : <span className="ctx-muted">Not entered</span>}</dd>
            <dt>Business purpose</dt>
            <dd>{report.businessPurpose || <span className="ctx-muted">Not entered</span>}</dd>
            <dt>Trip was for</dt>
            <dd>{purpose ? purpose.label : <span className="ctx-muted">Not chosen</span>}</dd>
          </dl>
        </Card>
        {editable ? (
          <div className="ctx-stack">
            <Card title="Before you submit">
              {blocking.length === 0 && warnings.length === 0 ? (
                <div className="ctx-banner green">
                  <Icon name="check" />
                  Everything is complete. You can submit.
                </div>
              ) : null}
              {blocking.length > 0 ? (
                <>
                  <div className="ctx-hint" style={{ marginBottom: 8 }}>
                    Fix these before submitting:
                  </div>
                  <ul className="ctx-issue-list">
                    {blocking.map((issue, i) => (
                      <li key={i} className="ctx-issue-item blocking">
                        <IssueLine severity="blocking">
                          {issuePrefix(issue)}
                          {issue.message}
                        </IssueLine>
                        {issue.field === 'suggested' && issue.lineId ? (
                          <>
                            <button className="ctx-btn ctx-btn-ghost ctx-btn-small" onClick={() => props.onFix(issue)}>
                              View
                            </button>
                            <button
                              className="ctx-btn ctx-btn-secondary ctx-btn-small"
                              style={{ marginLeft: 0 }}
                              aria-label={`Confirm row ${issue.rowNumber}`}
                              onClick={() => issue.lineId && props.onConfirm(issue.lineId)}
                            >
                              <Icon name="check" size={14} />
                              Confirm
                            </button>
                          </>
                        ) : (
                          <button className="ctx-btn ctx-btn-ghost ctx-btn-small" onClick={() => props.onFix(issue)}>
                            Fix
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {warnings.length > 0 ? (
                <>
                  <div className="ctx-hint" style={{ margin: '12px 0 8px' }}>
                    Check these. You can still submit; they are passed to the administrator:
                  </div>
                  <ul className="ctx-issue-list">
                    {warnings.map((issue, i) => (
                      <li key={i} className="ctx-issue-item warning">
                        <IssueLine severity="warning">
                          {issuePrefix(issue)}
                          {issue.message}
                        </IssueLine>
                        <button className="ctx-btn ctx-btn-ghost ctx-btn-small" onClick={() => props.onFix(issue)}>
                          View
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </Card>
            <Card title="What happens when you submit">
              <ul style={{ margin: 0, paddingLeft: 18 }} className="ctx-hint">
                <li>The report is locked.</li>
                <li>A folder with copies of your receipts and an expense file is created for processing.</li>
                <li>The administrator is emailed.</li>
                <li>If something needs correcting, the report comes back to you with a note.</li>
              </ul>
              {report.status === 'Draft' ? (
                <div style={{ marginTop: 14 }}>
                  <button className="ctx-btn ctx-btn-ghost ctx-btn-small" style={{ color: 'var(--c-error)' }} onClick={props.onDelete}>
                    <Icon name="trash" size={15} />
                    Delete this draft
                  </button>
                </div>
              ) : null}
            </Card>
          </div>
        ) : (
          <Card title="What happens next">
            <ul style={{ margin: 0, paddingLeft: 18 }} className="ctx-hint">
              {report.status === 'Processed' ? (
                <li>This report has been processed and is closed.</li>
              ) : (
                <>
                  <li>
                    The administrator processes your report{props.latest && props.latest.packageStatus !== 'Packaged' ? ' once its folder is ready' : ''}.
                  </li>
                  <li>When it is done, the status here changes to Processed.</li>
                  <li>If something needs correcting, the report comes back to you with a note.</li>
                </>
              )}
            </ul>
          </Card>
        )}
      </div>
      <Card title={`Expenses (${lines.length + trips.length})`}>
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
                <td className="nowrap">{l.date}</td>
                <td>{l.vendor}</td>
                <td>{findCategory(l.category)?.label ?? ''}</td>
                <td className="nowrap">{findPaymentType(l.paymentType)?.shortLabel ?? ''}</td>
                <td className="nowrap">
                  {hasReceipt(l, lines) ? l.sameReceiptAsRow !== null ? `Row ${l.sameReceiptAsRow}` : 'Yes' : <span className="ctx-muted">None</span>}
                </td>
                <td className="num">{l.amountCents === null ? '' : formatCents(l.amountCents)}</td>
              </tr>
            ))}
            {trips.map((t, i) => {
              const cents = mileageAmountCents(t);
              return (
                <tr key={t.id}>
                  <td>{tripLabel(i)}</td>
                  <td className="nowrap">{t.date}</td>
                  <td>
                    {t.from} to {t.to}, {t.miles ?? ''} miles
                  </td>
                  <td>{MILEAGE.label}</td>
                  <td className="nowrap">Own car</td>
                  <td className="nowrap ctx-muted">Not needed</td>
                  <td className="num">{cents === null ? '' : formatCents(cents)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
