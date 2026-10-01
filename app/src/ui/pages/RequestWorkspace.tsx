import * as React from 'react';
import { LineRef } from '../../domain/duplicates';
import { departmentSuggestions, vendorSuggestions } from '../../domain/defaults';
import { dateRangeText, todayIso } from '../../domain/dates';
import { messages } from '../../domain/messages';
import { formatCents } from '../../domain/money';
import {
  APPROVAL_THRESHOLD_TEXT,
  CERTIFICATION,
  OVERRUN_TOLERANCE_PERCENT,
  PROJECT_QUICK_PICKS,
  QUOTE_THRESHOLD_TEXT,
  ApprovalState,
  categoryText,
  findPaidBy,
  groupsForApproval,
  isSelfApproved,
  lineApprovals,
  mustSendForApproval
} from '../../domain/purchaseRules';
import { checkReceiptFile, hasReceipt } from '../../domain/receipts';
import { marksAfterEdit, readingChanges, shouldReadReceipt, vendorMemoryChanges } from '../../domain/suggestions';
import { APPROVAL_STATE_DISPLAY, LINE_APPROVAL_DISPLAY, REQUEST_STATUS_DISPLAY, isEditable, submissionStatusDisplay } from '../../domain/statuses';
import { computeTotals } from '../../domain/totals';
import { FileKind, PurchaseLine, PurchaseRequest, Submission, TEXT_MAX_LENGTH } from '../../domain/types';
import { Issue, RequestField, approvalStateOf, blockingIssues, issuePrefix, validateRequest, validationStage } from '../../domain/validation';
import { LineChanges, RequestChanges } from '../../data/PurchaseDataService';
import { ApprovalRequiredError, SubmissionBlockedError } from '../../export/submission';
import { useApp } from '../AppContext';
import { Badge, Card, Dialog, HeaderCard, IssueLine, SavedIndicator, Tag, TotalsStrip } from '../components/common';
import { DropZone } from '../components/DropZone';
import { Icon } from '../components/Icon';
import { PurchaseGrid } from '../components/PurchaseGrid';
import { ReceiptPreview } from '../components/ReceiptPreview';
import { RequestNav } from '../components/Sidebar';
import { VendorTotals } from '../components/VendorTotals';
import { RequestStep } from '../routing';
import { VENDOR_APPROVAL_LABEL, changedMessages, quoteText, rowsText, vendorRows } from '../vendorRows';
import { latestSubmission } from './admin/adminData';

const SAVE_DELAY_MS = 500;
/** From this window width the files sit beside the grid; below it, they slide over (travel D-033). */
export const WIDE_LAYOUT_PX = 1600;
const STEP_NUMBER: Record<RequestStep, number> = { details: 1, purchases: 2, review: 3 };

/** Shown once per page load if the receipt reader cannot start (travel D-074). */
let readerWarningShown = false;

/** A row nobody has started filling in yet: shown as "to fill in", not in red. "Who paid" does not count, because new rows start with one. */
function isFresh(line: PurchaseLine): boolean {
  return !line.date && !line.vendor && !line.description && !line.category && line.amountCents === null;
}

const sameEmail = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The toast for a file that was refused. */
function fileProblem(name: string, reason: 'type' | 'size' | 'empty'): string {
  return reason === 'type' ? messages.fileWrongType(name) : reason === 'size' ? messages.fileTooLarge(name) : messages.fileEmpty(name);
}

const inProgress = (s: Submission | undefined): boolean => !!s && s.packageStatus !== 'Packaged' && s.packageStatus !== 'Failed';

export function RequestWorkspace(props: { requestId: number; step: RequestStep }): React.ReactElement {
  const app = useApp();
  const { service } = app;
  const [request, setRequest] = React.useState<PurchaseRequest | null>(null);
  const [lines, setLines] = React.useState<PurchaseLine[]>([]);
  const [others, setOthers] = React.useState<LineRef[]>([]);
  const [submissions, setSubmissions] = React.useState<Submission[]>([]);
  const [departmentOptions, setDepartmentOptions] = React.useState<string[]>([]);
  const [approvers, setApprovers] = React.useState<string[]>([]);
  const [loadError, setLoadError] = React.useState('');
  const [selectedLineId, setSelectedLineId] = React.useState<string | null>(null);
  const [focusFileId, setFocusFileId] = React.useState<string | undefined>(undefined);
  const [wide, setWide] = React.useState(() => window.innerWidth >= WIDE_LAYOUT_PX);
  const [showPreview, setShowPreview] = React.useState(true);
  const [overlayOpen, setOverlayOpen] = React.useState(false);
  const [touchedFields, setTouchedFields] = React.useState<Record<string, boolean>>({});
  const [touchedLines, setTouchedLines] = React.useState<Record<string, boolean>>({});
  const [showAllIssues, setShowAllIssues] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [confirm, setConfirm] = React.useState<'send' | 'submit' | 'delete' | null>(null);
  const [certified, setCertified] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  // Receipt suggestions (travel D-074, D-078): rows being read, and rows where the
  // employee has chosen "Who paid" themselves, so vendor memory leaves it alone.
  const [readingLineIds, setReadingLineIds] = React.useState<ReadonlySet<string>>(new Set());
  const paidByChosen = React.useRef<Record<string, boolean>>({});
  const linesRef = React.useRef<PurchaseLine[]>([]);
  linesRef.current = lines;
  const othersRef = React.useRef<LineRef[]>([]);
  othersRef.current = others;
  // Reading stops if the employee leaves the request; rows already filled are saved.
  const mounted = React.useRef(true);
  React.useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  // Automatic saving (travel D-033): changes are collected and written shortly after the last keystroke.
  const requestChanges = React.useRef<RequestChanges>({});
  const lineChanges = React.useRef<Record<string, LineChanges>>({});
  const timer = React.useRef<number | undefined>(undefined);
  const inflight = React.useRef(0);

  const load = React.useCallback(async () => {
    try {
      const [data, other, subs, approverNames] = await Promise.all([
        service.getRequest(props.requestId),
        service.getOwnerOtherLines(props.requestId),
        service.listSubmissionsForRequest(props.requestId),
        service.listApprovers().catch((): string[] => [])
      ]);
      if (sameEmail(data.request.ownerEmail, app.user.email)) {
        const mine = await service.listMyRequests();
        setDepartmentOptions(departmentSuggestions(mine.filter((r) => r.id !== props.requestId)));
      }
      setRequest(data.request);
      setLines(data.lines);
      setOthers(other);
      setSubmissions(subs);
      setApprovers(approverNames);
      setSelectedLineId((current) => (current && data.lines.some((l) => l.id === current) ? current : data.lines[0] ? data.lines[0].id : null));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, [service, props.requestId]);

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
    const rc = requestChanges.current;
    const lc = lineChanges.current;
    requestChanges.current = {};
    lineChanges.current = {};
    const jobs: Promise<unknown>[] = [];
    if (Object.keys(rc).length > 0) jobs.push(service.updateRequest(props.requestId, rc));
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
      setSaving(inflight.current > 0 || Object.keys(requestChanges.current).length > 0 || Object.keys(lineChanges.current).length > 0);
    }
  }, [service, props.requestId, app]);

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

  // While an approval email or a package is being created, check its progress.
  const latestApproval = latestSubmission(submissions, 'approval');
  const latestPackage = latestSubmission(submissions, 'package');
  const waitingOnFlow = inProgress(latestApproval) || inProgress(latestPackage);
  React.useEffect(() => {
    if (!waitingOnFlow) return;
    const t = window.setInterval(async () => {
      try {
        setSubmissions(await service.listSubmissionsForRequest(props.requestId));
      } catch {
        // Checked again on the next tick.
      }
    }, 1200);
    return () => window.clearInterval(t);
  }, [waitingOnFlow, service, props.requestId]);

  const editable = !!request && isEditable(request.status) && sameEmail(request.ownerEmail, app.user.email);
  // A request already sent is checked as of the day it was sent (it is the day the "bought before approval" test used).
  const asOf =
    request && !editable ? (request.status === 'Awaiting approval' ? request.sentForApprovalOn : request.submittedOn).slice(0, 10) || todayIso() : todayIso();
  const issues: Issue[] = React.useMemo(() => (request ? validateRequest(request, lines, others, asOf) : []), [request, lines, others, asOf]);
  const blocking = blockingIssues(issues);
  const warnings = issues.filter((i) => i.severity === 'warning');
  const totals = computeTotals(lines);
  const state: ApprovalState = request ? approvalStateOf(request, lines) : 'notRequired';
  const stage = request ? validationStage(request, lines) : 'submit';

  // Issues shown on screen: rows nobody has started are "to fill in", not red.
  const shownIssues = issues.filter((i) => {
    if (i.scope === 'request') return showAllIssues || touchedFields[i.field];
    const line = lines.find((l) => l.id === i.lineId);
    return !!line && (showAllIssues || touchedLines[line.id] || !isFresh(line));
  });

  // Sidebar steps.
  React.useEffect(() => {
    if (!request) return;
    const requestIssues = issues.filter((i) => i.scope === 'request' && i.field !== 'rows' && i.severity === 'blocking').length;
    const detailsEmpty = !request.businessPurpose.trim();
    const rowBlocking = new Set(blocking.filter((i) => i.scope === 'row').map((i) => i.lineId)).size;
    const counted = lines.length === 1 ? '1 purchase' : `${lines.length} purchases`;
    const locked = !editable;
    const nav: RequestNav = {
      requestId: request.id,
      requestNumber: request.requestNumber,
      steps: {
        details: locked
          ? { state: 'done', status: 'Read-only' }
          : requestIssues > 0
            ? { state: detailsEmpty ? 'waiting' : 'attention', status: detailsEmpty ? 'To fill in' : `${requestIssues} to fix` }
            : { state: 'done', status: 'Complete' },
        purchases: locked
          ? { state: 'done', status: counted }
          : lines.length === 0
            ? { state: 'waiting', status: 'No purchases yet' }
            : rowBlocking > 0
              ? { state: 'attention', status: `${counted}, ${rowBlocking} to fix` }
              : { state: 'done', status: `${counted}, all complete` },
        review: locked
          ? { state: 'done', status: REQUEST_STATUS_DISPLAY[request.status].label }
          : blocking.length === 0
            ? { state: 'current', status: mustSendForApproval(state) ? 'Ready to send for approval' : 'Ready to submit' }
            : { state: 'waiting', status: `${blocking.length} to fix first` }
      }
    };
    app.setRequestNav(nav);
  }, [request, lines, issues, editable, state]);

  React.useEffect(() => () => app.setRequestNav(null), []);

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
  if (!request) return <div className="ctx-empty">Loading</div>;

  const changeRequest = (changes: RequestChanges) => {
    setRequest({ ...request, ...changes });
    requestChanges.current = { ...requestChanges.current, ...changes };
    setTouchedFields((t) => ({ ...t, ...Object.fromEntries(Object.keys(changes).map((k) => [k, true])) }));
    scheduleSave();
  };

  // Past rows of this employee, oldest first, for vendor suggestions and vendor memory (travel D-057, D-074).
  const historyFor = (lineId: string): PurchaseLine[] =>
    [...othersRef.current.map((o) => o.line), ...linesRef.current].filter((l) => l.id !== lineId).sort((a, b) => a.date.localeCompare(b.date));
  const history = [...others.map((o) => o.line), ...lines].sort((a, b) => a.date.localeCompare(b.date));

  // Writes changes to a row on screen, and saves them shortly after.
  const applyLineChanges = (lineId: string, changes: LineChanges) => {
    setLines((current) => current.map((l) => (l.id === lineId ? { ...l, ...changes } : l)));
    lineChanges.current = { ...lineChanges.current, [lineId]: { ...lineChanges.current[lineId], ...changes } };
    scheduleSave();
  };

  // A change the employee made. An edited value is theirs, so its Suggested
  // mark goes (travel D-078); a vendor they typed brings in vendor memory (travel D-074).
  const changeLine = (lineId: string, requested: LineChanges) => {
    const current = lines.find((l) => l.id === lineId);
    if (!current) return;
    if (requested.paidBy !== undefined) paidByChosen.current[lineId] = true;
    let changes: LineChanges = { ...requested };
    const marks = marksAfterEdit(current, Object.keys(requested));
    if (marks) changes.suggested = marks;
    if (requested.vendor !== undefined) {
      const memory = vendorMemoryChanges(requested.vendor, { ...current, ...changes }, historyFor(lineId), {
        paidByChosen: !!paidByChosen.current[lineId],
        vendorSuggested: false
      });
      changes = { ...changes, ...memory };
    }
    applyLineChanges(lineId, changes);
    setTouchedLines((t) => ({ ...t, [lineId]: true }));
  };

  const confirmLine = (lineId: string) => applyLineChanges(lineId, { suggested: [] });

  // Reads receipts one after another and fills in their rows' empty fields
  // (travel D-074). Returns how many rows got suggestions. Only receipts and
  // invoices are read; quotes are typed (P-021).
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
      const changes = readingChanges(line, guess, historyFor(line.id), todayIso(), !!paidByChosen.current[line.id]);
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

  const addFiles = (files: File[], kind: FileKind) => {
    const accepted: File[] = [];
    for (const f of files) {
      const check = checkReceiptFile(f.name, f.size);
      if (check.ok) accepted.push(f);
      else app.toast(fileProblem(f.name, check.reason), 'warning');
    }
    if (accepted.length === 0) return;
    let added: PurchaseLine[] = [];
    void structural(async () => {
      added = await service.addLinesFromFiles(request.id, accepted, kind);
      if (added[0]) setSelectedLineId(added[0].id);
      const noun = kind === 'quote' ? 'quote' : 'receipt';
      app.toast(added.length === 1 ? `1 ${noun} added as a new row.` : `${added.length} ${noun}s added as new rows.`);
    }).then(async () => {
      if (kind !== 'receipt') return;
      // The service adds one row per file, in order (it may rename the file).
      const jobs = added.length === accepted.length ? added.map((line, i) => ({ lineId: line.id, file: accepted[i] })) : [];
      const filled = await readReceipts(jobs);
      if (filled > 0) app.toast(messages.receiptsRead(filled));
    });
  };

  const addFileToRow = (lineId: string, file: File, kind: FileKind) => {
    const check = checkReceiptFile(file.name, file.size);
    if (!check.ok) {
      app.toast(fileProblem(file.name, check.reason), 'warning');
      return;
    }
    void structural(() => service.addFileToLine(lineId, file, kind)).then(async () => {
      if (kind === 'receipt' && (await readReceipts([{ lineId, file }])) > 0) app.toast(messages.receiptsRead(1));
    });
  };

  const goStep = (step: RequestStep) => app.navigate({ name: 'request', requestId: request.id, step });

  const send = async () => {
    setConfirm(null);
    setBusy(true);
    try {
      await flush();
      await service.sendForApproval(request.id);
      await load();
      app.toast('Sent for approval. The approver has been emailed.');
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

  const submit = async () => {
    setConfirm(null);
    setBusy(true);
    try {
      await flush();
      await service.submitRequest(request.id, CERTIFICATION);
      await load();
      app.toast('Request submitted. The administrator has been notified.');
      app.refreshAdminCounts();
    } catch (e) {
      if (e instanceof SubmissionBlockedError) {
        setShowAllIssues(true);
        app.toast(e.message, 'warning');
      } else if (e instanceof ApprovalRequiredError) {
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
      await service.deleteRequest(request.id);
      app.toast(`${request.requestNumber} deleted.`);
      app.navigate({ name: 'home' });
    } catch (e) {
      app.reportError(e);
    }
  };

  const status = REQUEST_STATUS_DISPLAY[request.status];
  const freshRequest = !request.businessPurpose && !request.projectCode && lines.length === 0;
  // The approval state is worth a note when something is still to be done about it.
  const approvalNote = state === 'needed' || state === 'pending' || state === 'changed' ? APPROVAL_STATE_DISPLAY[state].label : undefined;
  const statusMetric = editable
    ? undefined
    : {
        label: 'Status',
        value: <Badge tone={status.tone}>{status.label}</Badge>,
        note:
          state === 'pending' && approvalNote
            ? `${approvalNote}${request.sentForApprovalOn ? `, sent ${request.sentForApprovalOn}` : ''}`
            : (approvalNote ??
              (request.status === 'Processed' ? `Processed ${request.processedOn}` : request.status === 'Submitted' ? `Submitted ${request.submittedOn}` : ''))
      };
  const sidePreview = wide && showPreview;
  const openFile = (lineId: string, fileId: string) => {
    setSelectedLineId(lineId);
    setFocusFileId(fileId || undefined);
    if (wide) setShowPreview(true);
    else setOverlayOpen(true);
  };
  const selectedLine = lines.find((l) => l.id === selectedLineId);
  const title = request.businessPurpose || 'New purchase request';
  const subtitle = `${request.requestNumber}, step ${STEP_NUMBER[props.step]} of 3${editable ? '' : `. ${status.help}`}`;
  const instructionsButton = (
    <button className="ctx-btn ctx-btn-secondary" onClick={app.openInstructions}>
      <Icon name="book" size={16} />
      Instructions
    </button>
  );

  const sending = mustSendForApproval(state);
  let primary: React.ReactNode = null;
  if (props.step === 'details')
    primary = (
      <button className="ctx-btn ctx-btn-primary" onClick={() => goStep('purchases')}>
        Next: Purchases
        <Icon name="arrowRight" size={16} />
      </button>
    );
  else if (props.step === 'purchases')
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
          setConfirm(sending ? 'send' : 'submit');
        }}
      >
        <Icon name="send" size={16} />
        {sending ? 'Send for approval' : 'Submit request'}
      </button>
    );

  // What the send dialog lists: each vendor total that needs approval, flagged if it looks already bought (P-017).
  const sentGroups = groupsForApproval(
    lines.map((l) => ({ id: l.id, vendor: l.vendor, amountCents: l.amountCents, date: l.date, hasReceipt: hasReceipt(l, lines) })),
    todayIso()
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
      <StatusBanner request={request} lines={lines} state={state} latestApproval={latestApproval} latestPackage={latestPackage} />
      <TotalsStrip
        totals={totals}
        blockingCount={blocking.length}
        warningCount={warnings.length}
        fresh={freshRequest}
        status={statusMetric}
        approvalNote={approvalNote}
      />

      {props.step === 'details' ? (
        <DetailsStep
          request={request}
          lines={lines}
          issues={shownIssues}
          editable={editable}
          onChange={changeRequest}
          departmentOptions={departmentOptions}
          approvers={approvers}
        />
      ) : null}

      {props.step === 'purchases' ? (
        <div className={`ctx-expenses-layout ${sidePreview ? '' : 'no-preview'}`}>
          <div className="ctx-stack">
            {editable ? <DropZone onFiles={addFiles} disabled={busy} quoteHint={sending} /> : null}
            <Card
              title={`Purchases (${lines.length})`}
              actions={
                !sidePreview && lines.length > 0 ? (
                  <button className="ctx-btn ctx-btn-ghost ctx-btn-small" onClick={() => (wide ? setShowPreview(true) : setOverlayOpen(true))}>
                    <Icon name="eye" size={15} />
                    Show files
                  </button>
                ) : null
              }
            >
              {lines.length === 0 ? (
                <div className="ctx-empty">
                  <Icon name="upload" size={28} />
                  <h3>No purchases yet</h3>
                  {editable ? 'Drop your files in the box above. Each file becomes a row. Or add a purchase without a file.' : 'This request has no purchases.'}
                </div>
              ) : (
                <PurchaseGrid
                  lines={lines}
                  issues={shownIssues}
                  readOnly={!editable}
                  stage={stage}
                  approvals={lineApprovals(lines, request.status, request.approval)}
                  selectedLineId={selectedLineId}
                  onSelect={setSelectedLineId}
                  onChange={changeLine}
                  onDelete={(id) => structural(() => service.deleteLine(id))}
                  onAddFile={addFileToRow}
                  onRemoveFile={(id, fileId) => structural(() => service.removeFileFromLine(id, fileId))}
                  onOpenFile={openFile}
                  vendorOptions={vendorSuggestions(history)}
                  readingLineIds={readingLineIds}
                  onConfirm={confirmLine}
                />
              )}
              {lines.some((l) => isFresh(l) && !touchedLines[l.id]) && !showAllIssues ? (
                <div className="ctx-hint" style={{ marginTop: 10 }}>
                  New rows: fill in the date, vendor, what was bought and why, category, amount and who paid.
                </div>
              ) : null}
              {editable ? (
                <div className="ctx-grid-footer">
                  <button
                    className="ctx-btn ctx-btn-secondary ctx-btn-small"
                    disabled={busy}
                    onClick={() => structural(() => service.addEmptyLine(request.id))}
                  >
                    <Icon name="plus" size={15} />
                    Add purchase without a file
                  </button>
                  <span className="ctx-hint">Enter moves down a column. Ctrl+D copies the row above. You can paste several rows from a spreadsheet.</span>
                </div>
              ) : null}
            </Card>
            <Card title="Vendor totals">
              <VendorTotals lines={lines} request={request} showIntro />
            </Card>
          </div>
          {sidePreview ? <ReceiptPreview line={selectedLine} lines={lines} focusFileId={focusFileId} onHide={() => setShowPreview(false)} /> : null}
          {!wide && overlayOpen ? (
            <ReceiptPreview overlay line={selectedLine} lines={lines} focusFileId={focusFileId} onHide={() => setOverlayOpen(false)} />
          ) : null}
        </div>
      ) : null}

      {props.step === 'review' ? (
        <ReviewStep
          request={request}
          lines={lines}
          issues={issues}
          editable={editable}
          state={state}
          stage={stage}
          approvers={approvers}
          onConfirm={confirmLine}
          onFix={(issue) => {
            if (issue.scope === 'request' && issue.field !== 'rows') goStep('details');
            else {
              if (issue.lineId) setSelectedLineId(issue.lineId);
              goStep('purchases');
            }
          }}
          onDelete={() => setConfirm('delete')}
        />
      ) : null}

      {confirm === 'send' ? (
        <Dialog
          title={`Send ${request.requestNumber} for approval?`}
          onClose={() => setConfirm(null)}
          actions={
            <>
              <button className="ctx-btn ctx-btn-secondary" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button className="ctx-btn ctx-btn-primary" onClick={send}>
                Send for approval
              </button>
            </>
          }
        >
          <p style={{ margin: 0 }}>{messages.sendConfirm}</p>
          <div>
            <div className="ctx-hint" style={{ marginBottom: 6 }}>
              Vendor totals for approval:
            </div>
            <ul className="ctx-send-list">
              {sentGroups.map((g) => (
                <li key={g.key}>
                  <span className="ctx-strong">{g.vendor || 'A purchase with no vendor'}</span>
                  <span className="ctx-send-amount">{formatCents(g.cents)}</span>
                </li>
              ))}
            </ul>
          </div>
          {sentGroups.some((g) => g.bought) ? (
            <div className="ctx-banner amber" role="note">
              <Icon name="alert" />
              <div>This looks already bought. It will be flagged Bought before approval. You can still send it.</div>
            </div>
          ) : null}
        </Dialog>
      ) : null}
      {confirm === 'submit' ? (
        <Dialog
          title={`Submit ${request.requestNumber}?`}
          onClose={() => setConfirm(null)}
          actions={
            <>
              <button className="ctx-btn ctx-btn-secondary" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button className="ctx-btn ctx-btn-primary" onClick={submit} disabled={!certified} title={certified ? undefined : messages.certificationRequired}>
                Submit request
              </button>
            </>
          }
        >
          <p style={{ margin: 0 }}>{messages.submitConfirm}</p>
          <p style={{ margin: 0 }} className="ctx-hint">
            To reimburse: {formatCents(totals.reimburseCents)}. Paid by Clarus: {formatCents(totals.companyCents)}. Request total:{' '}
            {formatCents(totals.requestCents)}.
            {warnings.length > 0 ? ` ${warnings.length === 1 ? '1 warning' : `${warnings.length} warnings`} will be passed to the administrator.` : ''}
          </p>
          <label className="ctx-certify">
            <input type="checkbox" checked={certified} onChange={(e) => setCertified(e.target.checked)} />
            <span>{CERTIFICATION}</span>
          </label>
          <p style={{ margin: 0 }} className="ctx-hint">
            Recorded with your account: {app.user.displayName} ({app.user.email}).
          </p>
        </Dialog>
      ) : null}
      {confirm === 'delete' ? (
        <Dialog
          title={`Delete ${request.requestNumber}?`}
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
          <p style={{ margin: 0 }}>This draft and its files will be deleted. This cannot be undone.</p>
        </Dialog>
      ) : null}
    </>
  );
}

function StatusBanner(props: {
  request: PurchaseRequest;
  lines: PurchaseLine[];
  state: ApprovalState;
  latestApproval: Submission | undefined;
  latestPackage: Submission | undefined;
}): React.ReactElement | null {
  const { request, latestApproval, latestPackage } = props;
  if (request.status === 'Returned') {
    const by =
      request.returnStage === 'approval' ? 'the approver' : request.returnStage === 'processing' ? 'the administrator' : 'the approver or administrator';
    const next =
      request.returnStage === 'approval' ? 'send it for approval again' : request.returnStage === 'processing' ? 'submit it again' : 'send or submit it again';
    return (
      <div className="ctx-banner amber">
        <Icon name="undo" />
        <div>
          <strong>Returned by {by}.</strong> {request.returnNote} Correct the request and {next}.
        </div>
      </div>
    );
  }
  if (request.status === 'Awaiting approval') {
    const email = latestApproval ? submissionStatusDisplay('approval', latestApproval.packageStatus) : null;
    return (
      <div className="ctx-banner purple">
        <Icon name="clock" />
        <div>
          <strong>Sent for approval{request.sentForApprovalOn ? ` ${request.sentForApprovalOn}` : ''}.</strong> The approver has been emailed. The request is
          locked until it is approved or returned.
          {email ? (
            <>
              {' '}
              <Badge tone={email.tone}>{email.label}</Badge>
            </>
          ) : null}
        </div>
      </div>
    );
  }
  if (request.status === 'Approved') {
    const self = isSelfApproved(request.ownerEmail, request.approvedByEmail) ? ' (self-approved)' : '';
    const changed = changedMessages(vendorRows(props.lines, request));
    return (
      <>
        <div className="ctx-banner green">
          <Icon name="check" />
          <div>
            <strong>
              Approved by {request.approvedBy}
              {self} on {request.approvedOn}.
            </strong>{' '}
            {request.approvalNote.trim() ? `Note: ${request.approvalNote.trim()} ` : ''}
            {request.boughtBeforeApproval ? 'Flagged: bought before approval. ' : ''}
            Buy, attach your receipts and invoices, then submit.
          </div>
        </div>
        {props.state === 'changed' && changed.length > 0 ? (
          <div className="ctx-banner amber">
            <Icon name="alert" />
            <div>{changed.join(' ')}</div>
          </div>
        ) : null}
      </>
    );
  }
  if (request.status === 'Submitted') {
    const pkg = latestPackage ? submissionStatusDisplay('package', latestPackage.packageStatus) : null;
    return (
      <div className="ctx-banner purple">
        <Icon name="send" />
        <div>
          <strong>Submitted {request.submittedOn}.</strong> The request is locked while it is processed.
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
  if (request.status === 'Processed') {
    return (
      <div className="ctx-banner green">
        <Icon name="check" />
        <div>
          <strong>Processed {request.processedOn}</strong> by {request.processedBy}. This request is closed.
        </div>
      </div>
    );
  }
  return null;
}

function fieldError(issues: Issue[], field: RequestField): string | undefined {
  return issues.find((i) => i.scope === 'request' && i.field === field && i.severity === 'blocking')?.message;
}

/** The approver as the employee sees it: the site Owners, with their names when they can be read (P-020). */
function approverLabel(approvers: readonly string[]): string {
  return approvers.length > 0 ? `Site Owners (${approvers.join(', ')})` : 'Site Owners';
}

function DetailsStep(props: {
  request: PurchaseRequest;
  lines: PurchaseLine[];
  issues: Issue[];
  editable: boolean;
  onChange: (c: RequestChanges) => void;
  departmentOptions: string[];
  approvers: string[];
}): React.ReactElement {
  const { request, issues, editable, onChange } = props;
  const input = (id: RequestField | 'projectCode', label: string, element: React.ReactElement, span2 = false) => {
    const error = id === 'projectCode' ? undefined : fieldError(issues, id);
    return (
      <div className={`ctx-field ${span2 ? 'ctx-span-2' : ''}`}>
        <label htmlFor={`request-${id}`}>{label}</label>
        {React.cloneElement(element, { id: `request-${id}`, className: `${element.props.className} ${error ? 'blocking' : ''}`, disabled: !editable })}
        {error ? <div className="ctx-field-error">{error}</div> : null}
      </div>
    );
  };
  const fixed = (id: string, label: string, value: React.ReactNode) => (
    <div className="ctx-field">
      <div className="ctx-label" id={`request-${id}-label`}>
        {label}
      </div>
      <div className="ctx-static" aria-labelledby={`request-${id}-label`}>
        {value}
      </div>
    </div>
  );
  const dates = dateRangeText(props.lines.map((l) => l.date));
  return (
    <div className="ctx-two-col">
      <Card title="Request details">
        <datalist id="ctx-department-options">
          {props.departmentOptions.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
        <div className="ctx-field-grid">
          {fixed('employee', 'Employee', `${request.ownerName} (${request.ownerEmail})`)}
          {input(
            'department',
            'Department',
            <input
              className="ctx-input"
              maxLength={TEXT_MAX_LENGTH}
              list="ctx-department-options"
              value={request.department}
              onChange={(e) => onChange({ department: e.target.value })}
            />
          )}
          {input(
            'businessPurpose',
            'Business purpose',
            <input
              className="ctx-input"
              placeholder="For example: Lab supplies for the Phase 1 assay"
              maxLength={TEXT_MAX_LENGTH}
              value={request.businessPurpose}
              onChange={(e) => onChange({ businessPurpose: e.target.value })}
            />,
            true
          )}
          <div className="ctx-field">
            <label htmlFor="request-projectCode">Project or grant code</label>
            <input
              id="request-projectCode"
              className="ctx-input"
              placeholder="Optional"
              maxLength={TEXT_MAX_LENGTH}
              disabled={!editable}
              value={request.projectCode}
              onChange={(e) => onChange({ projectCode: e.target.value })}
            />
            {PROJECT_QUICK_PICKS.length > 0 ? (
              <div className="ctx-quick-picks">
                <span className="ctx-hint">Quick pick:</span>
                {PROJECT_QUICK_PICKS.map((pick) => (
                  <button
                    key={pick}
                    type="button"
                    className="ctx-btn ctx-btn-secondary ctx-btn-small"
                    disabled={!editable}
                    onClick={() => onChange({ projectCode: pick })}
                  >
                    {pick}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {fixed('approver', 'Approver', approverLabel(props.approvers))}
          {fixed('submitted', 'Date submitted', request.submittedOn || <span className="ctx-muted">Not submitted yet</span>)}
          {fixed('dates', 'Purchase dates', dates || <span className="ctx-muted">Add purchases to see the dates</span>)}
        </div>
      </Card>
      <Card title="How approval works">
        <ul className="ctx-plain-list">
          <li>
            A vendor total of <strong>{APPROVAL_THRESHOLD_TEXT} or more</strong> needs the approver&apos;s approval before you buy. You also attach a quote, or
            say why there is none (a vendor total of {QUOTE_THRESHOLD_TEXT} or more).
          </li>
          <li>Totals are by vendor within this request, so splitting a purchase across rows does not avoid the limit.</li>
          <li>Under {APPROVAL_THRESHOLD_TEXT}, no approval is needed. You still submit the request with your receipts.</li>
          <li>When you send a request for approval, the approver is emailed. After approval, buy, attach your receipts and invoices, then submit.</li>
        </ul>
      </Card>
    </div>
  );
}

/** What the employee should expect next, for each place a request can be in. */
function nextSteps(request: PurchaseRequest, state: ApprovalState): string[] {
  if (request.status === 'Processed') return ['This request has been processed and is closed.'];
  if (request.status === 'Submitted')
    return [
      'The administrator processes your request once its folder is ready.',
      'When it is done, the status here changes to Processed.',
      'If something needs correcting, the request comes back to you with a note. Correct it and submit it again.'
    ];
  if (state === 'pending')
    return [
      'The approver has been emailed. The request is locked while they decide.',
      'When it is approved, buy what was approved, attach your receipts and invoices, then submit.',
      'If it is returned, you will see their note. Correct the request and send it for approval again.'
    ];
  const returned = request.status === 'Returned' ? ['It was returned to you. Correct it first, using the note above.'] : [];
  const afterwards = [
    'When you submit, the request is locked, a folder with your files is created for the administrator, and the administrator is emailed.',
    'If something needs correcting, the request comes back to you with a note.'
  ];
  switch (state) {
    case 'notRequired':
      return [
        ...returned,
        `No approval is needed: every vendor total is under ${APPROVAL_THRESHOLD_TEXT}.`,
        'Attach your receipts and invoices, then submit the request.',
        ...afterwards
      ];
    case 'needed':
      return [
        ...returned,
        `A vendor total is ${APPROVAL_THRESHOLD_TEXT} or more, so the request needs approval before you buy.`,
        'Choose Send for approval. The request is locked and the approver is emailed.',
        'After it is approved, buy, attach your receipts and invoices, then submit. If it is returned, correct it and send it again.'
      ];
    case 'changed':
      return [
        ...returned,
        'A vendor total is now above what was approved, so the request needs approval again.',
        'Choose Send for approval. After it is approved, attach your receipts and invoices, then submit.'
      ];
    default:
      return [
        ...returned,
        'The request is approved. Buy what was approved, attach your receipts and invoices, then submit.',
        `If a vendor total rises more than ${OVERRUN_TOLERANCE_PERCENT}% above what was approved, or another vendor reaches ${APPROVAL_THRESHOLD_TEXT}, send it for approval again.`,
        ...afterwards
      ];
  }
}

function ReviewStep(props: {
  request: PurchaseRequest;
  lines: PurchaseLine[];
  issues: Issue[];
  editable: boolean;
  state: ApprovalState;
  stage: 'approval' | 'submit';
  approvers: string[];
  onFix: (issue: Issue) => void;
  /** Confirms a row's suggested values (travel D-078). */
  onConfirm: (lineId: string) => void;
  onDelete: () => void;
}): React.ReactElement {
  const { request, lines, issues, editable, state, stage } = props;
  // In the order they appear: the request first, then rows.
  const position = (i: Issue) => i.rowNumber ?? 0;
  const blocking = issues.filter((i) => i.severity === 'blocking').sort((a, b) => position(a) - position(b));
  const warnings = issues.filter((i) => i.severity === 'warning').sort((a, b) => position(a) - position(b));
  const action = stage === 'approval' ? 'send' : 'submit';
  const approvalDisplay = APPROVAL_STATE_DISPLAY[state];
  const needing = vendorRows(lines, request).filter((r) => r.group.needsApproval);
  const dates = dateRangeText(lines.map((l) => l.date));
  const approvalIsKept = request.approvedBy && (state === 'approved' || state === 'changed');
  const self = isSelfApproved(request.ownerEmail, request.approvedByEmail) ? ' (self-approved)' : '';
  return (
    <div className="ctx-stack">
      <div className="ctx-two-col">
        <div className="ctx-stack">
          <Card title="Request">
            <dl className="ctx-dl">
              <dt>Business purpose</dt>
              <dd>{request.businessPurpose || <span className="ctx-muted">Not entered</span>}</dd>
              <dt>Department</dt>
              <dd>{request.department || <span className="ctx-muted">Not entered</span>}</dd>
              <dt>Project or grant code</dt>
              <dd>{request.projectCode || <span className="ctx-muted">None</span>}</dd>
              <dt>Purchase dates</dt>
              <dd>{dates || <span className="ctx-muted">No dates yet</span>}</dd>
              <dt>Approver</dt>
              <dd>{approverLabel(props.approvers)}</dd>
            </dl>
          </Card>
          {editable ? (
            <Card title={stage === 'approval' ? 'Before you send' : 'Before you submit'}>
              {blocking.length === 0 && warnings.length === 0 ? (
                <div className="ctx-banner green">
                  <Icon name="check" />
                  {stage === 'approval' ? 'Everything is complete. You can send the request for approval.' : 'Everything is complete. You can submit.'}
                </div>
              ) : null}
              {blocking.length > 0 ? (
                <>
                  <div className="ctx-hint" style={{ marginBottom: 8 }}>
                    Fix these before you {action}:
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
                    {stage === 'approval'
                      ? 'Check these. You can still send the request for approval:'
                      : 'Check these. You can still submit; they are passed to the administrator:'}
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
          ) : null}
        </div>
        <div className="ctx-stack">
          <Card title="Approval">
            <div className="ctx-row-flex" style={{ marginBottom: needing.length === 0 ? 0 : 10 }}>
              <Badge tone={approvalDisplay.tone}>{approvalDisplay.label}</Badge>
              <span className="ctx-hint">
                {needing.length === 0 ? `Every vendor total is under ${APPROVAL_THRESHOLD_TEXT}, so no approval is needed.` : approvalDisplay.help}
              </span>
            </div>
            {needing.length === 0 ? null : (
              <ul className="ctx-vendor-list">
                {needing.map((r) => {
                  const total = formatCents(r.group.totalCents);
                  const message =
                    r.approval === 'needed'
                      ? messages.vendorNeedsApproval(r.group.vendor, total)
                      : r.approval === 'changed'
                        ? r.approvedCents === null
                          ? messages.notApproved(r.group.vendor, total)
                          : messages.changedSinceApproval(r.group.vendor, total, formatCents(r.approvedCents))
                        : '';
                  return (
                    <li key={r.group.key}>
                      <div className="ctx-vendor-head">
                        <span className="ctx-strong">{r.group.vendor || 'A purchase with no vendor'}</span>
                        <span className="ctx-strong">{total}</span>
                      </div>
                      <div className="ctx-hint">
                        {rowsText(r.rows)}. Quote: {quoteText(r.quote) || 'not needed'}. Approval: {VENDOR_APPROVAL_LABEL[r.approval]}
                        {r.approvedCents !== null ? ` (${formatCents(r.approvedCents)} approved)` : ''}.{' '}
                        {r.boughtBefore ? (
                          <Tag title="The purchase looked already made when the request was sent for approval">Bought before approval</Tag>
                        ) : null}
                      </div>
                      {message ? <div className="ctx-vendor-message">{message}</div> : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {approvalIsKept ? (
              <div className="ctx-hint" style={{ marginTop: 10 }}>
                Approved by {request.approvedBy}
                {self} on {request.approvedOn}.{request.approvalNote.trim() ? ` Note: ${request.approvalNote.trim()}` : ''}
              </div>
            ) : null}
          </Card>
          <Card title="What happens next">
            <ul style={{ margin: 0, paddingLeft: 18 }} className="ctx-hint">
              {nextSteps(request, state).map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ul>
            {editable && request.status === 'Draft' ? (
              <div style={{ marginTop: 14 }}>
                <button className="ctx-btn ctx-btn-ghost ctx-btn-small" style={{ color: 'var(--c-error)' }} onClick={props.onDelete}>
                  <Icon name="trash" size={15} />
                  Delete this draft
                </button>
              </div>
            ) : null}
          </Card>
        </div>
      </div>
      <Card title={`Purchases (${lines.length})`}>
        <div className="ctx-grid-wrap">
          <table className="ctx-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Vendor</th>
                <th>What was bought and why</th>
                <th>Category</th>
                <th>Who paid</th>
                <th>Approval</th>
                <th>Receipt</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const approval = lineApprovals(lines, request.status, request.approval).get(l.id);
                const display = approval ? LINE_APPROVAL_DISPLAY[approval.status] : undefined;
                return (
                  <tr key={l.id}>
                    <td>{l.rowNumber}</td>
                    <td className="nowrap">{l.date}</td>
                    <td>{l.vendor}</td>
                    <td>{l.description}</td>
                    <td>{categoryText(l.category, l.categoryOther)}</td>
                    <td className="nowrap">{findPaidBy(l.paidBy)?.shortLabel ?? ''}</td>
                    <td className="nowrap">{display ? <Badge tone={display.tone}>{display.label}</Badge> : null}</td>
                    <td className="nowrap">
                      {hasReceipt(l, lines) ? l.sameReceiptAsRow !== null ? `Row ${l.sameReceiptAsRow}` : 'Yes' : <span className="ctx-muted">None</span>}
                    </td>
                    <td className="num">{l.amountCents === null ? '' : formatCents(l.amountCents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
