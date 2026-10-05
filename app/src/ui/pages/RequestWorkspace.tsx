import * as React from 'react';
import { LineRef } from '../../domain/duplicates';
import { departmentSuggestions, vendorSuggestions } from '../../domain/defaults';
import { dateRangeText, todayIso } from '../../domain/dates';
import { messages } from '../../domain/messages';
import { formatCents } from '../../domain/money';
import {
  APPROVAL_THRESHOLD_TEXT,
  BUYER_OPTIONS,
  CERTIFICATION,
  OVERRUN_TOLERANCE_PERCENT,
  PROJECT_QUICK_PICKS,
  QUOTE_THRESHOLD_TEXT,
  ApprovalState,
  categoryText,
  findPaidBy,
  isSelfApproved,
  lineApprovals,
  mustSendForApproval
} from '../../domain/purchaseRules';
import { checkReceiptFile, hasReceipt } from '../../domain/receipts';
import { marksAfterEdit, readingChanges, shouldReadReceipt, vendorMemoryChanges } from '../../domain/suggestions';
import { LINE_APPROVAL_DISPLAY, approvalStateDisplay, isEditable, mayBuy, requestStatusDisplay, submissionStatusDisplay } from '../../domain/statuses';
import { computeTotals } from '../../domain/totals';
import { FileKind, PurchaseLine, PurchaseRequest, Submission, TEXT_MAX_LENGTH } from '../../domain/types';
import {
  Issue,
  RequestField,
  approvalGroupsToSend,
  approvalStateOf,
  blockingIssues,
  issuePrefix,
  looksBoughtNow,
  validateRequest,
  validationStage
} from '../../domain/validation';
import { LineChanges, RequestChanges } from '../../data/PurchaseDataService';
import { ApprovalRequiredError, SubmissionBlockedError } from '../../export/submission';
import { useApp } from '../AppContext';
import { errorText } from '../errors';
import { useElementWidth, useMountedRef } from '../hooks';
import {
  ChangeSet,
  NO_CHANGES,
  SaveQueue,
  SaveRecord,
  addChanges,
  changeAsKept,
  forRows,
  hasChanges,
  keptAsSent,
  savesNotYetRead,
  withChanges
} from '../pendingChanges';
import { Badge, Card, Dialog, HeaderCard, IssueLine, ItemLinkText, SavedIndicator, Tag, TotalsStrip } from '../components/common';
import { DropZone } from '../components/DropZone';
import { SentRowsCard } from '../components/SentRowsCard';
import { Icon } from '../components/Icon';
import { PurchaseGrid } from '../components/PurchaseGrid';
import { ReceiptPreview } from '../components/ReceiptPreview';
import { RequestNav } from '../components/Sidebar';
import { VendorTotals } from '../components/VendorTotals';
import { RequestStep } from '../routing';
import { asSentence } from '../text';
import { filesBesideGrid, gridMinWidth } from '../theme';
import { VENDOR_APPROVAL_LABEL, boughtBeforeNote, changedMessages, quoteSummary, rowsText, vendorRows } from '../vendorRows';
import { latestSubmission } from './admin/adminData';

const SAVE_DELAY_MS = 500;
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
  // The app gives a new context each time it draws (the sidebar steps are set from this page),
  // so the callbacks below read it from here: saving must not restart whenever it changes.
  const appRef = React.useRef(app);
  appRef.current = app;
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
  // The files sit beside the grid only when the grid keeps its full width there, measured on the
  // Purchases step itself (the sidebar, the page around the app and a scroll bar all take room);
  // otherwise they slide over the page (travel D-033).
  const [layoutRef, layoutWidth] = useElementWidth<HTMLDivElement>();
  const [wide, setWide] = React.useState(false);
  // The grid is narrower when the approver buys, because nobody is asked who paid (P-037).
  const [gridWidth, setGridWidth] = React.useState(gridMinWidth(false));
  React.useLayoutEffect(() => {
    if (layoutWidth !== null) setWide((beside) => filesBesideGrid(layoutWidth, beside, gridWidth));
  }, [layoutWidth, gridWidth]);
  const [showPreview, setShowPreview] = React.useState(true);
  const [overlayOpen, setOverlayOpen] = React.useState(false);
  const [touchedFields, setTouchedFields] = React.useState<Record<string, boolean>>({});
  const [touchedLines, setTouchedLines] = React.useState<Record<string, boolean>>({});
  const [showAllIssues, setShowAllIssues] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [confirm, setConfirm] = React.useState<'send' | 'submit' | 'purchase' | 'delete' | null>(null);
  const [certified, setCertified] = React.useState(false);
  // While a row or a file is added or removed, or the request is sent or submitted. A count, so one
  // that ends while another still runs does not end it.
  const [busy, setBusy] = React.useState(false);
  const busyCount = React.useRef(0);
  // Receipt suggestions (travel D-074, D-078): rows being read, and rows where the
  // employee has chosen "Who paid" themselves, so vendor memory leaves it alone.
  const [readingLineIds, setReadingLineIds] = React.useState<ReadonlySet<string>>(new Set());
  const paidByChosen = React.useRef<Record<string, boolean>>({});
  // The rows as on screen, updated with every change before React draws it, so code that
  // runs after an await (receipt reading, saving, reading back) always has the latest rows.
  const linesRef = React.useRef<PurchaseLine[]>([]);
  const showLines = (next: PurchaseLine[]) => {
    linesRef.current = next;
    setLines(next);
  };
  const othersRef = React.useRef<LineRef[]>([]);
  othersRef.current = others;
  // Reading stops if the employee leaves the request; rows already filled are saved.
  const mounted = useMountedRef();

  // Automatic saving (travel D-033): changes are collected and written shortly after the last
  // keystroke. Until what is read back holds them, they are put back on top of it, so the
  // screen always shows what is saved or about to be (pendingChanges.ts).
  const pending = React.useRef<ChangeSet>(NO_CHANGES);
  const saves = React.useRef<SaveRecord[]>([]);
  // Saves run one after another, so two saves of one row are written in the order they were made,
  // and the data layer judges each against the one before it (a category description is kept only
  // once its category, saved first, needs one).
  const [queue] = React.useState(() => new SaveQueue());
  // Saves that failed, counted, so sending or submitting can tell whether the saves it waited for went through.
  const failedSaves = React.useRef(0);
  // One counter orders reads and finished saves; a read started before a save finished may not hold it.
  const clock = React.useRef(0);
  const runningReads = React.useRef<Set<number>>(new Set());
  // The newest read on screen, so an older read that arrives late is not shown over it.
  const readCount = React.useRef(0);
  const shownRead = React.useRef(0);
  const timer = React.useRef<number | undefined>(undefined);

  const unsaved = (): boolean => hasChanges(pending.current) || saves.current.some((s) => s.finishedAt === null);
  /** Forgets the saves that every read still running started after. */
  const forgetReadSaves = () => {
    const oldest = Math.min(...Array.from(runningReads.current), Infinity);
    saves.current = saves.current.filter((s) => s.finishedAt === null || s.finishedAt > oldest);
  };
  /** Records when a save finished, on the counter that also orders the reads. */
  const finishSave = (save: SaveRecord) => {
    save.finishedAt = ++clock.current;
    forgetReadSaves();
  };

  /** Reads the request again. `quiet`: a failure leaves the page as it is, instead of showing the error in its place. */
  const load = React.useCallback(
    async (quiet = false): Promise<void> => {
      const read = ++readCount.current;
      const startedAt = ++clock.current;
      runningReads.current.add(startedAt);
      try {
        const [data, other, subs, approverNames] = await Promise.all([
          service.getRequest(props.requestId),
          service.getOwnerOtherLines(props.requestId),
          service.listSubmissionsForRequest(props.requestId),
          service.listApprovers().catch((): string[] => [])
        ]);
        const mine = sameEmail(data.request.ownerEmail, appRef.current.user.email) ? await service.listMyRequests() : null;
        if (!mounted.current || read < shownRead.current) return;
        shownRead.current = read;
        if (mine) setDepartmentOptions(departmentSuggestions(mine.filter((r) => r.id !== props.requestId)));
        // What was typed meanwhile, being saved or still waiting, goes back on top. Changes to a
        // row that has been deleted are dropped: there is nothing left to save them to.
        pending.current = forRows(pending.current, new Set(data.lines.map((l) => l.id)));
        const shown = withChanges(data.request, data.lines, [...savesNotYetRead(saves.current, startedAt), pending.current]);
        setRequest(shown.request);
        showLines(shown.lines);
        setOthers(other);
        setSubmissions(subs);
        setApprovers(approverNames);
        setSelectedLineId((current) => (current && data.lines.some((l) => l.id === current) ? current : data.lines[0] ? data.lines[0].id : null));
      } catch (e) {
        if (!quiet && mounted.current) setLoadError(e instanceof Error ? e.message : String(e));
      } finally {
        runningReads.current.delete(startedAt);
        forgetReadSaves();
      }
    },
    [service, props.requestId]
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  /**
   * Writes one save. The page reads back what is saved when a write failed, and also when the
   * data layer kept something other than what was sent (such as a category description it
   * cleared), so the screen never shows a value that is not saved.
   */
  const write = React.useCallback(
    async (save: SaveRecord): Promise<void> => {
      const { changes } = save;
      const jobs: Promise<boolean>[] = [];
      if (Object.keys(changes.request).length > 0)
        jobs.push(service.updateRequest(props.requestId, changes.request).then((kept) => keptAsSent(changes.request, kept)));
      for (const [id, c] of Object.entries(changes.lines)) jobs.push(service.updateLine(id, c).then((kept) => keptAsSent(c, kept)));
      // Every write is waited for, so a failure does not hide a write still running.
      const results = await Promise.all(
        jobs.map((job) =>
          job.then(
            (asSent) => ({ failed: false, asSent, error: null as unknown }),
            (error: unknown) => ({ failed: true, asSent: false, error })
          )
        )
      );
      finishSave(save);
      const failure = results.find((r) => r.failed);
      if (failure) {
        failedSaves.current += 1;
        appRef.current.toast(`Could not save: ${errorText(failure.error)} The page shows what is saved.`, 'warning');
      }
      // Choosing who buys changes every row's "who paid" and the totals, so the page reads them back (P-037).
      const buyerChanged = changes.request.buyer !== undefined;
      if ((failure || buyerChanged || results.some((r) => !r.asSent)) && mounted.current) void load(true);
    },
    [service, props.requestId, load]
  );

  /**
   * Starts saving what is waiting, then waits until every save made so far has finished, those
   * running and those queued. Resolves to false if one of them failed. Never throws: a failure is
   * shown, and the page goes back to what is saved.
   */
  const flush = React.useCallback((): Promise<boolean> => {
    window.clearTimeout(timer.current);
    const failuresBefore = failedSaves.current;
    const changes = pending.current;
    pending.current = NO_CHANGES;
    if (hasChanges(changes)) {
      const save: SaveRecord = { changes, finishedAt: null };
      saves.current = [...saves.current, save];
      queue.add(() => write(save));
    }
    return queue.idle().then(() => {
      if (mounted.current) setSaving(unsaved());
      return failedSaves.current === failuresBefore;
    });
  }, [queue, write]);
  const flushRef = React.useRef(flush);
  flushRef.current = flush;

  const scheduleSave = () => {
    setSaving(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void flushRef.current();
    }, SAVE_DELAY_MS);
  };

  // Leaving the request saves what is waiting, once.
  React.useEffect(
    () => () => {
      void flushRef.current();
    },
    []
  );

  // Closing or reloading the page saves what is waiting at once. While anything is not yet
  // saved, the browser first asks whether to leave, so the save can finish.
  React.useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!unsaved()) return;
      void flushRef.current();
      e.preventDefault();
      e.returnValue = '';
    };
    const onPageHide = () => {
      void flushRef.current();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  // While an approval email or a package is being created, check its progress.
  const latestApproval = latestSubmission(submissions, 'approval');
  const latestPackage = latestSubmission(submissions, 'package');
  const waitingOnFlow = inProgress(latestApproval) || inProgress(latestPackage);
  React.useEffect(() => {
    if (!waitingOnFlow) return;
    const t = window.setInterval(async () => {
      try {
        const subs = await service.listSubmissionsForRequest(props.requestId);
        if (mounted.current) setSubmissions(subs);
      } catch {
        // Checked again on the next tick.
      }
    }, 1200);
    return () => window.clearInterval(t);
  }, [waitingOnFlow, service, props.requestId]);

  // The owner changes a request while it is theirs to change (P-027); the approver who approved a request the approver
  // buys changes its rows and files while buying it (P-037, P-040). Only the owner changes the request's details.
  const approverBuys = request?.buyer === 'approver';
  const buying = !!request && mayBuy(request, app.user);
  const ownerEdits = !!request && isEditable(request.status, request.buyer) && sameEmail(request.ownerEmail, app.user.email);
  const editable = ownerEdits || buying;
  React.useEffect(() => {
    setGridWidth(gridMinWidth(approverBuys));
  }, [approverBuys]);
  // A request already sent is checked as of the day it was sent (it is the day the "bought before approval" test used).
  const asOf =
    request && !editable ? (request.status === 'Awaiting approval' ? request.sentForApprovalOn : request.submittedOn).slice(0, 10) || todayIso() : todayIso();
  // The receipts are the buyer's to attach (P-040): nobody else is asked for one on an approved request the approver buys.
  const receiptsNotAskedHere = !!request && approverBuys && request.status === 'Approved' && !buying;
  const issues: Issue[] = React.useMemo(() => {
    if (!request) return [];
    const all = validateRequest(request, lines, others, asOf);
    return receiptsNotAskedHere ? all.filter((i) => i.field !== 'receipt') : all;
  }, [request, lines, others, asOf, receiptsNotAskedHere]);
  const blocking = blockingIssues(issues);
  const warnings = issues.filter((i) => i.severity === 'warning');
  const totals = computeTotals(lines, request?.buyer);
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
      names: request.buyer === 'approver' ? { review: buying ? 'Review and mark purchased' : 'Review and send' } : undefined,
      steps: {
        details: !ownerEdits
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
          ? { state: 'done', status: requestStatusDisplay(request.status, request.buyer).label }
          : blocking.length === 0
            ? {
                state: 'current',
                status: buying
                  ? 'Ready to mark purchased'
                  : mustSendForApproval(state)
                    ? request.buyer === 'approver'
                      ? 'Ready to send to the approver'
                      : 'Ready to send for approval'
                    : 'Ready to submit'
              }
            : { state: 'waiting', status: `${blocking.length} to fix first` }
      }
    };
    app.setRequestNav(nav);
  }, [request, lines, issues, editable, ownerEdits, buying, state]);

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
    setRequest((current) => (current ? { ...current, ...changes } : current));
    pending.current = addChanges(pending.current, { request: changes, lines: {} });
    setTouchedFields((t) => ({ ...t, ...Object.fromEntries(Object.keys(changes).map((k) => [k, true])) }));
    scheduleSave();
  };

  // Past rows of this employee, oldest first, for vendor suggestions and vendor memory (travel D-057, D-074).
  const historyFor = (lineId: string): PurchaseLine[] =>
    [...othersRef.current.map((o) => o.line), ...linesRef.current].filter((l) => l.id !== lineId).sort((a, b) => a.date.localeCompare(b.date));
  const history = [...others.map((o) => o.line), ...lines].sort((a, b) => a.date.localeCompare(b.date));

  // Writes changes to a row on screen, and saves them shortly after. A change is made the way the
  // data layer keeps it: a category that needs no description clears the row's (P-024).
  const applyLineChanges = (lineId: string, requested: LineChanges) => {
    const current = linesRef.current.find((l) => l.id === lineId);
    // The company pays for what the approver buys, so "who paid" is never changed (P-037): the data layer would keep it as the company.
    let asked: LineChanges = request.buyer === 'approver' && requested.paidBy !== undefined ? { ...requested, paidBy: 'company' } : requested;
    // Nobody can confirm "who paid" when the approver buys, so it is never left as a suggestion (P-037).
    if (request.buyer === 'approver' && asked.suggested !== undefined) asked = { ...asked, suggested: asked.suggested.filter((f) => f !== 'paidBy') };
    const changes = current ? changeAsKept(current, asked) : asked;
    showLines(linesRef.current.map((l) => (l.id === lineId ? { ...l, ...changes } : l)));
    pending.current = addChanges(pending.current, { request: {}, lines: { [lineId]: changes } });
    scheduleSave();
  };

  // A change the employee made. An edited value is theirs, so its Suggested
  // mark goes (travel D-078); a vendor they typed brings in vendor memory (travel D-074).
  const changeLine = (lineId: string, requested: LineChanges) => {
    const current = linesRef.current.find((l) => l.id === lineId);
    if (!current) return;
    if (requested.paidBy !== undefined) paidByChosen.current[lineId] = true;
    let changes: LineChanges = { ...requested };
    const marks = marksAfterEdit(current, Object.keys(requested));
    if (marks) changes.suggested = marks;
    if (requested.vendor !== undefined) {
      const memory = vendorMemoryChanges(requested.vendor, { ...current, ...changes }, historyFor(lineId), {
        // When the approver buys, "who paid" is not asked, so vendor memory leaves it alone (P-037).
        paidByChosen: request.buyer === 'approver' || !!paidByChosen.current[lineId],
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
      const changes = readingChanges(line, guess, historyFor(line.id), todayIso(), request.buyer === 'approver' || !!paidByChosen.current[line.id]);
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

  const beginBusy = () => {
    busyCount.current += 1;
    setBusy(true);
  };
  const endBusy = () => {
    busyCount.current -= 1;
    if (mounted.current) setBusy(busyCount.current > 0);
  };

  /**
   * Saves everything before the request is sent or submitted, including anything typed while
   * the saves run. False if a save failed: the page then shows what is saved, and nothing is sent.
   */
  const saveEverything = async (): Promise<boolean> => {
    let ok = await flush();
    while (ok && mounted.current && unsaved()) ok = await flush();
    return ok;
  };

  // Runs a change that adds or removes rows or files, after every save, then reloads. Anything
  // typed meanwhile stays on screen and is saved (load). Errors are shown to the
  // employee; it never throws.
  const structural = async (work: () => Promise<unknown>): Promise<void> => {
    beginBusy();
    try {
      await flush();
      await work();
      await load();
    } catch (e) {
      app.reportError(e);
    } finally {
      endBusy();
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
      if (added[0] && mounted.current) setSelectedLineId(added[0].id);
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
    beginBusy();
    try {
      if (!(await saveEverything())) {
        app.toast('Nothing was sent. Check the request, then send it for approval again.', 'warning');
        return;
      }
      // When the approver buys, the employee certifies now, because there is nothing for them to submit later (P-037).
      await service.sendForApproval(request.id, request.buyer === 'approver' ? CERTIFICATION : undefined);
      await load();
      app.toast(request.buyer === 'approver' ? 'Sent to the approver. They have been emailed.' : 'Sent for approval. The approver has been emailed.');
      app.refreshAdminCounts();
    } catch (e) {
      if (e instanceof SubmissionBlockedError) {
        setShowAllIssues(true);
        app.toast(e.message, 'warning');
      } else app.reportError(e);
    } finally {
      endBusy();
    }
  };

  const submit = async () => {
    setConfirm(null);
    beginBusy();
    try {
      if (!(await saveEverything())) {
        app.toast('Nothing was submitted. Check the request, then submit it again.', 'warning');
        return;
      }
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
      endBusy();
    }
  };

  const markPurchased = async () => {
    setConfirm(null);
    beginBusy();
    try {
      if (!(await saveEverything())) {
        app.toast('Nothing was marked purchased. Check the request, then mark it purchased again.', 'warning');
        return;
      }
      await service.markPurchased(request.id);
      await load();
      app.toast('Marked purchased. The administrator has been notified.');
      app.refreshAdminCounts();
    } catch (e) {
      if (e instanceof SubmissionBlockedError) {
        setShowAllIssues(true);
        app.toast(e.message, 'warning');
      } else app.reportError(e);
    } finally {
      endBusy();
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

  const status = requestStatusDisplay(request.status, request.buyer);
  const freshRequest = !request.businessPurpose.trim() && !request.projectCode.trim() && lines.length === 0;
  // The approval state is worth a note when something is still to be done about it.
  const approvalNote = state === 'needed' || state === 'pending' || state === 'changed' ? approvalStateDisplay(state, request.buyer).label : undefined;
  const statusMetric = editable
    ? undefined
    : {
        label: 'Status',
        value: <Badge tone={status.tone}>{status.label}</Badge>,
        note:
          state === 'pending' && approvalNote
            ? `${approvalNote}${request.sentForApprovalOn ? `, sent ${request.sentForApprovalOn}` : ''}`
            : (approvalNote ??
              (request.status === 'Processed'
                ? `Processed ${request.processedOn}`
                : request.status === 'Submitted'
                  ? `${request.buyer === 'approver' ? 'Purchased' : 'Submitted'} ${request.submittedOn}`
                  : ''))
      };
  const sidePreview = wide && showPreview;
  const openFile = (lineId: string, fileId: string) => {
    setSelectedLineId(lineId);
    setFocusFileId(fileId || undefined);
    if (wide) setShowPreview(true);
    else setOverlayOpen(true);
  };
  const selectedLine = lines.find((l) => l.id === selectedLineId);
  const title = request.businessPurpose.trim() || 'New purchase request';
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
          setConfirm(buying ? 'purchase' : sending ? 'send' : 'submit');
        }}
      >
        <Icon name="send" size={16} />
        {buying ? 'Mark purchased' : sending ? (approverBuys ? 'Send to the approver' : 'Send for approval') : 'Submit request'}
      </button>
    );

  // What the send dialog lists: each vendor total that needs approval, flagged if it counts as bought
  // before approval (P-017), worked out as sending will record it. The note names the flagged ones.
  const today = todayIso();
  const sentGroups = approvalGroupsToSend(request, lines, today);
  const flaggedGroups = sentGroups.filter((g) => g.bought);
  const boughtNote = boughtBeforeNote(
    flaggedGroups.filter((g) => looksBoughtNow(lines, g.key, today)).map((g) => g.vendor),
    flaggedGroups.filter((g) => !looksBoughtNow(lines, g.key, today)).map((g) => g.vendor)
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
      <StatusBanner request={request} lines={lines} state={state} latestApproval={latestApproval} latestPackage={latestPackage} buying={buying} />
      <TotalsStrip
        totals={totals}
        blockingCount={blocking.length}
        warningCount={warnings.length}
        fresh={freshRequest}
        status={statusMetric}
        approvalNote={approvalNote}
        approverBuys={approverBuys}
      />

      {props.step === 'details' ? (
        <DetailsStep
          request={request}
          lines={lines}
          issues={shownIssues}
          editable={ownerEdits}
          onChange={changeRequest}
          departmentOptions={departmentOptions}
          approvers={approvers}
        />
      ) : null}

      {props.step === 'purchases' ? (
        <div className={`ctx-expenses-layout ${sidePreview ? '' : 'no-preview'}`} ref={layoutRef}>
          <div className="ctx-stack">
            {/* The employee of a request the approver buys sends quotes; the approver attaches the receipts one row at a time (P-037). */}
            {ownerEdits ? <DropZone onFiles={addFiles} disabled={busy} quoteHint={sending || approverBuys} only={approverBuys ? 'quote' : undefined} /> : null}
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
                  {ownerEdits
                    ? approverBuys
                      ? 'Drop a quote in the box above and it becomes a row. Or add a purchase without a file.'
                      : 'Drop your files in the box above. Each file becomes a row. Or add a purchase without a file.'
                    : buying
                      ? 'Add the purchases you made.'
                      : 'This request has no purchases.'}
                </div>
              ) : (
                <PurchaseGrid
                  lines={lines}
                  issues={shownIssues}
                  readOnly={!editable}
                  buyer={request.buyer}
                  buying={buying}
                  stage={stage}
                  approvals={lineApprovals(lines, request.status, request.approval, request.buyer)}
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
                  onWarning={(text) => app.toast(text, 'warning')}
                  busy={busy}
                />
              )}
              {lines.some((l) => isFresh(l) && !touchedLines[l.id]) && !showAllIssues ? (
                <div className="ctx-hint" style={{ marginTop: 10 }}>
                  {approverBuys
                    ? 'New rows: fill in the vendor, what to buy and why, category, amount and the item link. The date starts as today; the approver sets it when buying.'
                    : 'New rows: fill in the date, vendor, what was bought and why, category, amount and who paid.'}
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
                    {buying ? 'Add a row, such as shipping or tax' : 'Add purchase without a file'}
                  </button>
                  <span className="ctx-hint">
                    Enter moves down a column. Ctrl+D copies the row above. You can paste rows from a spreadsheet, its columns in the grid&apos;s order (Date to{' '}
                    {approverBuys ? 'Amount' : 'Who paid'}), dates like 2026-10-14 or 10/14/2026.
                  </span>
                </div>
              ) : null}
            </Card>
            <Card title="Vendor totals">
              <VendorTotals lines={lines} request={request} showIntro />
            </Card>
            <SentRowsCard request={request} lines={lines} forApprover={buying || app.user.isAdministrator} />
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
          buying={buying}
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
          title={approverBuys ? `Send ${request.requestNumber} to the approver?` : `Send ${request.requestNumber} for approval?`}
          onClose={() => setConfirm(null)}
          actions={
            <>
              <button className="ctx-btn ctx-btn-secondary" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                className="ctx-btn ctx-btn-primary"
                onClick={send}
                disabled={approverBuys && !certified}
                title={approverBuys && !certified ? messages.certificationRequiredToSend : undefined}
              >
                {approverBuys ? 'Send to the approver' : 'Send for approval'}
              </button>
            </>
          }
        >
          <p style={{ margin: 0 }}>{approverBuys ? messages.sendToApproverConfirm : messages.sendConfirm}</p>
          <div>
            <div className="ctx-hint" style={{ marginBottom: 6 }}>
              {approverBuys ? 'What you are asking the approver to buy, by vendor:' : 'Vendor totals for approval:'}
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
          {boughtNote ? (
            <div className="ctx-banner amber" role="note">
              <Icon name="alert" />
              <div>{boughtNote}</div>
            </div>
          ) : null}
          {approverBuys ? (
            <>
              <label className="ctx-certify">
                <input type="checkbox" checked={certified} onChange={(e) => setCertified(e.target.checked)} />
                <span>{CERTIFICATION}</span>
              </label>
              <p style={{ margin: 0 }} className="ctx-hint">
                Recorded with your account: {app.user.displayName} ({app.user.email}).
              </p>
            </>
          ) : null}
        </Dialog>
      ) : null}
      {confirm === 'purchase' ? (
        <Dialog
          title={`Mark ${request.requestNumber} purchased?`}
          onClose={() => setConfirm(null)}
          actions={
            <>
              <button className="ctx-btn ctx-btn-secondary" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button className="ctx-btn ctx-btn-primary" onClick={markPurchased}>
                Mark purchased
              </button>
            </>
          }
        >
          <p style={{ margin: 0 }}>{messages.markPurchasedConfirm}</p>
          <p style={{ margin: 0 }} className="ctx-hint">
            Paid by Clarus: {formatCents(totals.companyCents)}. Request total: {formatCents(totals.requestCents)}. The date on each row is the purchase date,
            and the earliest one names the folder.
            {warnings.length > 0 ? ` ${warnings.length === 1 ? '1 warning' : `${warnings.length} warnings`} will be passed to the administrator.` : ''}
          </p>
          <p style={{ margin: 0 }} className="ctx-hint">
            {request.ownerName} certified the request when they sent it. Marked purchased by {app.user.displayName} ({app.user.email}).
          </p>
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
  /** The signed-in approver is buying this request (P-037). */
  buying: boolean;
}): React.ReactElement | null {
  const { request, latestApproval, latestPackage } = props;
  const approverBuys = request.buyer === 'approver';
  if (request.status === 'Returned') {
    const by =
      request.returnStage === 'approval' ? 'the approver' : request.returnStage === 'processing' ? 'the administrator' : 'the approver or administrator';
    // What to do next follows the request as it is now, not the step it was returned at: a
    // vendor total may have risen past what was approved since (P-019), or fallen under the threshold.
    const next = mustSendForApproval(props.state)
      ? `send it ${approverBuys ? 'to the approver' : 'for approval'}${request.approvalRounds > 0 ? ' again' : ''}`
      : `submit it${request.submissionCount > 0 ? ' again' : ''}`;
    return (
      <div className="ctx-banner amber">
        <Icon name="undo" />
        <div>
          <strong>Returned by {by}.</strong> {asSentence(request.returnNote)} Correct the request and {next}.
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
          <strong>
            Sent {approverBuys ? 'to the approver' : 'for approval'}
            {request.sentForApprovalOn ? ` ${request.sentForApprovalOn}` : ''}.
          </strong>{' '}
          The approver has been emailed. The request is locked until it is approved or returned.
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
    if (approverBuys) {
      // A request the administrator returned at processing comes back to the approver, who buys it again (P-037).
      const returned =
        request.returnStage === 'processing' && request.returnNote.trim() ? (
          <div className="ctx-banner amber">
            <Icon name="undo" />
            <div>
              <strong>Returned by the administrator.</strong> {asSentence(request.returnNote)}{' '}
              {props.buying ? 'Fix it, then mark it purchased again.' : `${request.approvedBy || 'The approver'} fixes it and marks it purchased again.`}
            </div>
          </div>
        ) : null;
      return (
        <>
          {returned}
          <div className="ctx-banner green">
            <Icon name="check" />
            <div>
              <strong>
                Approved by {request.approvedBy}
                {self} on {request.approvedOn}.
              </strong>{' '}
              {request.approvalNote.trim() ? `Note: ${asSentence(request.approvalNote)} ` : ''}
              {props.buying
                ? 'You buy it. Change each row to what you bought, attach the receipt or invoice, then mark it purchased.'
                : `${request.approvedBy || 'The approver'} buys it and finishes the request. You have nothing to do.`}
            </div>
          </div>
        </>
      );
    }
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
            {request.approvalNote.trim() ? `Note: ${asSentence(request.approvalNote)} ` : ''}
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
          {approverBuys ? (
            <>
              <strong>
                Purchased {request.submittedOn}
                {request.approvedBy ? ` by ${request.approvedBy}` : ''}.
              </strong>{' '}
              The request is locked while it is processed.
            </>
          ) : (
            <>
              <strong>Submitted {request.submittedOn}.</strong> The request is locked while it is processed.
            </>
          )}
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
  // Who buys is chosen while the request is made or corrected, not after it has been approved (P-037).
  const canChooseBuyer = request.status === 'Draft' || request.status === 'Returned';
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
          <div className="ctx-field ctx-span-2">
            <div className="ctx-label" id="request-buyer-label">
              Who buys this?
            </div>
            <div className="ctx-radio-group" role="radiogroup" aria-labelledby="request-buyer-label">
              {BUYER_OPTIONS.map((b) => (
                <label key={b.id} className={`ctx-option-row ${request.buyer === b.id ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="request-buyer"
                    value={b.id}
                    checked={request.buyer === b.id}
                    disabled={!editable || !canChooseBuyer}
                    onChange={() => onChange({ buyer: b.id })}
                  />
                  <span>
                    <strong>{b.label}</strong>
                    <span className="ctx-hint">{b.help}</span>
                  </span>
                </label>
              ))}
            </div>
            {editable && !canChooseBuyer ? <div className="ctx-hint">Who buys this cannot be changed once the request has been approved.</div> : null}
          </div>
          {fixed('approver', 'Approver', approverLabel(props.approvers))}
          {fixed(
            'submitted',
            request.buyer === 'approver' ? 'Date sent' : 'Date submitted',
            (request.buyer === 'approver' ? request.sentForApprovalOn : request.submittedOn) || (
              <span className="ctx-muted">{request.buyer === 'approver' ? 'Not sent yet' : 'Not submitted yet'}</span>
            )
          )}
          {fixed('dates', 'Purchase dates', dates || <span className="ctx-muted">Add purchases to see the dates</span>)}
        </div>
      </Card>
      <Card title="How approval works">
        {request.buyer === 'approver' ? (
          <ul className="ctx-plain-list">
            <li>
              The approver approves your request and <strong>buys it</strong>. Every request goes to the approver, whatever the amount.
            </li>
            <li>
              Say what to buy: the vendor, what it is and why, an estimated amount, the category and the item&apos;s web address. A vendor total of{' '}
              {QUOTE_THRESHOLD_TEXT} or more needs a quote, or a reason why there is none.
            </li>
            <li>When you send it, you certify the request and the approver is emailed. You do not buy anything, attach a receipt or submit.</li>
            <li>If the approver returns it, you will see their note. Correct the request and send it again.</li>
          </ul>
        ) : (
          <ul className="ctx-plain-list">
            {APPROVAL_THRESHOLD_TEXT === QUOTE_THRESHOLD_TEXT ? (
              <li>
                A vendor total of <strong>{APPROVAL_THRESHOLD_TEXT} or more</strong> needs the approver&apos;s approval before you buy, and a quote or a reason
                why there is none.
              </li>
            ) : (
              <li>
                A vendor total of <strong>{APPROVAL_THRESHOLD_TEXT} or more</strong> needs the approver&apos;s approval before you buy. A vendor total of{' '}
                {QUOTE_THRESHOLD_TEXT} or more needs a quote, or a reason why there is none.
              </li>
            )}
            <li>Totals are by vendor within this request, so splitting a purchase across rows does not avoid the limit.</li>
            <li>Under {APPROVAL_THRESHOLD_TEXT}, no approval is needed. You still submit the request with your receipts.</li>
            <li>When you send a request for approval, the approver is emailed. After approval, buy, attach your receipts and invoices, then submit.</li>
          </ul>
        )}
      </Card>
    </div>
  );
}

/** What the person should expect next, for each place a request can be in. */
function nextSteps(request: PurchaseRequest, state: ApprovalState, buying: boolean): string[] {
  if (request.status === 'Processed') return ['This request has been processed and is closed.'];
  if (request.buyer === 'approver') return nextStepsWhenApproverBuys(request, state, buying);
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

/** The same, when the approver buys the request (P-037): the employee sends it and has nothing more to do, and the approver buys and finishes it. */
function nextStepsWhenApproverBuys(request: PurchaseRequest, state: ApprovalState, buying: boolean): string[] {
  if (request.status === 'Submitted')
    return [
      `${request.approvedBy || 'The approver'} bought it. The administrator processes it once its folder is ready.`,
      'When it is done, the status here changes to Processed.',
      'You have nothing to do.'
    ];
  if (request.status === 'Approved' && buying)
    return [
      'Buy what was approved. Change each row to what you bought: the amount, the date, and extra rows for shipping or tax.',
      'Attach the receipt or invoice to each row, or point a row at another row that shares it.',
      'Choose Mark purchased. A folder with the receipts and the CSV is made for the administrator, who is emailed.',
      'If you cannot buy it, return it to the employee with a note from its page under Approvals.'
    ];
  if (request.status === 'Approved')
    return [
      `The request is approved. ${request.approvedBy || 'The approver'} buys it, attaches the receipt and finishes the request.`,
      'You have nothing to do. If something is wrong, the approver will return it to you with a note.'
    ];
  if (state === 'pending')
    return [
      'The approver has been emailed. The request is locked while they decide.',
      'When it is approved, the approver buys it. You do not buy anything or attach a receipt.',
      'If it is returned, you will see their note. Correct the request and send it again.'
    ];
  const returned = request.status === 'Returned' ? ['It was returned to you. Correct it first, using the note above.'] : [];
  return [
    ...returned,
    'Every request goes to the approver, whatever the amount. Choose Send to the approver.',
    'When you send it, you certify it, the request is locked and the approver is emailed.',
    'The approver approves it, buys it, attaches the receipt and finishes it. If it is returned, correct it and send it again.'
  ];
}

function ReviewStep(props: {
  request: PurchaseRequest;
  lines: PurchaseLine[];
  issues: Issue[];
  editable: boolean;
  /** The signed-in approver is buying this request (P-037): the last step is "Mark purchased". */
  buying: boolean;
  state: ApprovalState;
  stage: 'approval' | 'submit';
  approvers: string[];
  onFix: (issue: Issue) => void;
  /** Confirms a row's suggested values (travel D-078). */
  onConfirm: (lineId: string) => void;
  onDelete: () => void;
}): React.ReactElement {
  const { request, lines, issues, editable, state, stage, buying } = props;
  const approverBuys = request.buyer === 'approver';
  // In the order they appear: the request first, then rows.
  const position = (i: Issue) => i.rowNumber ?? 0;
  const blocking = issues.filter((i) => i.severity === 'blocking').sort((a, b) => position(a) - position(b));
  const warnings = issues.filter((i) => i.severity === 'warning').sort((a, b) => position(a) - position(b));
  const action = buying ? 'mark it purchased' : stage === 'approval' ? 'send' : 'submit';
  const approvalDisplay = approvalStateDisplay(state, request.buyer);
  const needing = vendorRows(lines, request).filter((r) => r.group.needsApproval);
  const dates = dateRangeText(lines.map((l) => l.date));
  const approvalIsKept = request.approvedBy && (state === 'approved' || state === 'changed');
  const self = isSelfApproved(request.ownerEmail, request.approvedByEmail) ? ' (self-approved)' : '';
  const approvals = lineApprovals(lines, request.status, request.approval, request.buyer);
  // The employee of a request the approver buys has no receipts to show; they are the approver's, added when buying.
  const showReceipts = !approverBuys || buying || request.status === 'Submitted' || request.status === 'Processed';
  return (
    <div className="ctx-stack">
      <div className="ctx-two-col">
        <div className="ctx-stack">
          <Card title="Request">
            <dl className="ctx-dl">
              <dt>Business purpose</dt>
              <dd>{request.businessPurpose.trim() || <span className="ctx-muted">Not entered</span>}</dd>
              <dt>Department</dt>
              <dd>{request.department.trim() || <span className="ctx-muted">Not entered</span>}</dd>
              <dt>Project or grant code</dt>
              <dd>{request.projectCode.trim() || <span className="ctx-muted">None</span>}</dd>
              <dt>Purchase dates</dt>
              <dd>{dates || <span className="ctx-muted">No dates yet</span>}</dd>
              <dt>Who buys</dt>
              <dd>{approverBuys ? 'The approver' : 'The employee'}</dd>
              <dt>Approver</dt>
              <dd>{approverLabel(props.approvers)}</dd>
            </dl>
          </Card>
          {editable ? (
            <Card title={buying ? 'Before you mark it purchased' : stage === 'approval' ? 'Before you send' : 'Before you submit'}>
              {blocking.length === 0 && warnings.length === 0 ? (
                <div className="ctx-banner green">
                  <Icon name="check" />
                  {buying
                    ? 'Everything is complete. You can mark it purchased.'
                    : stage === 'approval'
                      ? approverBuys
                        ? 'Everything is complete. You can send the request to the approver.'
                        : 'Everything is complete. You can send the request for approval.'
                      : 'Everything is complete. You can submit.'}
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
                      ? `Check these. You can still send the request${approverBuys ? '' : ' for approval'}:`
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
                {needing.length === 0
                  ? approverBuys
                    ? 'Add purchases to see what goes to the approver.'
                    : `Every vendor total is under ${APPROVAL_THRESHOLD_TEXT}, so no approval is needed.`
                  : approvalDisplay.help}
              </span>
            </div>
            {needing.length === 0 ? null : (
              <ul className="ctx-vendor-list">
                {needing.map((r) => {
                  const total = formatCents(r.group.totalCents);
                  const message =
                    r.approval === 'needed'
                      ? approverBuys
                        ? ''
                        : messages.vendorNeedsApproval(r.group.vendor, total)
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
                        {rowsText(r.rows)}. Quote: {quoteSummary(r.quote)}. Approval: {VENDOR_APPROVAL_LABEL[r.approval]}
                        {r.approvedCents !== null && !approverBuys ? ` (${formatCents(r.approvedCents)} approved)` : ''}.{' '}
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
                {self} on {request.approvedOn}.{request.approvalNote.trim() ? ` Note: ${asSentence(request.approvalNote)}` : ''}
              </div>
            ) : null}
          </Card>
          <Card title="What happens next">
            <ul style={{ margin: 0, paddingLeft: 18 }} className="ctx-hint">
              {nextSteps(request, state, buying).map((text, i) => (
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
                {approverBuys ? <th>Item link</th> : <th>Who paid</th>}
                <th>Approval</th>
                {showReceipts ? <th>Receipt</th> : null}
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const approval = approvals.get(l.id);
                const display = approval ? LINE_APPROVAL_DISPLAY[approval.status] : undefined;
                return (
                  <tr key={l.id}>
                    <td>{l.rowNumber}</td>
                    <td className="nowrap">{l.date}</td>
                    <td>{l.vendor}</td>
                    <td>{l.description}</td>
                    <td>{categoryText(l.category, l.categoryOther)}</td>
                    {approverBuys ? (
                      <td>
                        {l.itemLink.trim() ? (
                          <ItemLinkText value={l.itemLink} maxChars={30} />
                        ) : l.noLinkReason.trim() ? (
                          <span className="ctx-muted">No web page: {l.noLinkReason}</span>
                        ) : (
                          <span className="ctx-muted">None</span>
                        )}
                      </td>
                    ) : (
                      <td className="nowrap">{findPaidBy(l.paidBy)?.shortLabel ?? ''}</td>
                    )}
                    <td className="nowrap">{display ? <Badge tone={display.tone}>{display.label}</Badge> : null}</td>
                    {showReceipts ? (
                      <td className="nowrap">
                        {hasReceipt(l, lines) ? l.sameReceiptAsRow !== null ? `Row ${l.sameReceiptAsRow}` : 'Yes' : <span className="ctx-muted">None</span>}
                      </td>
                    ) : null}
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
