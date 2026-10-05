import * as React from 'react';
import { dateRange } from '../../../domain/dates';
import { messages } from '../../../domain/messages';
import { formatCents } from '../../../domain/money';
import {
  APPROVAL_THRESHOLD_TEXT,
  CATEGORIES,
  QUICKBOOKS_MAPPING_STATUS,
  anyBoughtBefore,
  categoryNeedsDescription,
  categoryNeedsReview,
  categoryText,
  findCategory,
  findPaidBy,
  lineApprovals
} from '../../../domain/purchaseRules';
import { hasReceipt, quoteFiles, receiptFiles } from '../../../domain/receipts';
import {
  LINE_APPROVAL_DISPLAY,
  PACKAGE_ATTENTION_MINUTES,
  approvalStateDisplay,
  canConfirmCategories,
  mayBuy,
  requestStatusDisplay,
  submissionStatusDisplay
} from '../../../domain/statuses';
import { CategoryId, PurchaseLine, PurchaseRequest, Submission } from '../../../domain/types';
import { approvalStateOf } from '../../../domain/validation';
import { CategoryChoice } from '../../../data/PurchaseDataService';
import { retryRefusal, rowsPhrase, rowsToReview } from '../../../data/sharepoint/serviceRules';
import { CSV_COLUMNS, approverText } from '../../../export/csv';
import { useApp } from '../../AppContext';
import { useMountedRef } from '../../hooks';
import { Badge, Card, Dialog, FileChip, FullTextSelect, HeaderCard, ItemLinkText } from '../../components/common';
import { Icon } from '../../components/Icon';
import { ReceiptPreview } from '../../components/ReceiptPreview';
import { SentRowsCard } from '../../components/SentRowsCard';
import { VendorTotals } from '../../components/VendorTotals';
import { changedMessages, vendorRows } from '../../vendorRows';
import { latestSubmission } from './adminData';

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

type Tab = 'purchases' | 'vendors' | 'approvalEmail' | 'submissionEmail' | 'csv' | 'folder';

const TABS: [Tab, string][] = [
  ['purchases', 'Purchases'],
  ['vendors', 'Vendor totals'],
  ['approvalEmail', 'Approval email'],
  ['submissionEmail', 'Submission email'],
  ['csv', 'CSV file'],
  ['folder', 'Folder contents']
];

/** Where the flow puts a request's folder (P-008). */
const TO_PROCESS = 'Accounting > Purchases > Purchases_To_Process';

/** The vendors flagged "bought before approval", with their totals, from the approved totals if there are any, else those sent (P-017). */
function boughtBeforeText(request: PurchaseRequest): string {
  const groups = anyBoughtBefore(request.approval.approved) ? request.approval.approved : request.approval.sent;
  return groups
    .filter((g) => g.bought)
    .map((g) => `${g.vendor || 'a purchase with no vendor'} (${formatCents(g.cents)})`)
    .join(', ');
}

export function AdminRequestPage(props: { requestId: number }): React.ReactElement {
  const app = useApp();
  const [request, setRequest] = React.useState<PurchaseRequest | null>(null);
  const [lines, setLines] = React.useState<PurchaseLine[]>([]);
  const [submissions, setSubmissions] = React.useState<Submission[]>([]);
  const [csv, setCsv] = React.useState('');
  const [tab, setTab] = React.useState<Tab>('purchases');
  const [dialog, setDialog] = React.useState<'return' | 'approve' | null>(null);
  const [returnNote, setReturnNote] = React.useState('');
  const [approveNote, setApproveNote] = React.useState('');
  // Categories the approver or administrator has changed on screen and not yet confirmed, by line ID (P-024).
  const [edits, setEdits] = React.useState<Record<string, CategoryChoice>>({});
  const [busy, setBusy] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);
  // The file the approver or administrator opened from the purchases table: a receipt or a quote (P-021).
  const [preview, setPreview] = React.useState<{ lineId: string; fileId: string } | null>(null);
  const mounted = useMountedRef();

  const load = React.useCallback(async (): Promise<void> => {
    const data = await app.service.getRequest(props.requestId);
    const subs = await app.service.listSubmissionsForRequest(props.requestId);
    const pkg = latestSubmission(subs, 'package');
    // A package whose files are not ready has no CSV to show yet; that is not a failure to load the request.
    const csvText = pkg ? await app.service.getSubmissionCsv(pkg.id).catch(() => '') : '';
    if (!mounted.current) return;
    setRequest(data.request);
    setLines(data.lines);
    setSubmissions(subs);
    setCsv(csvText);
  }, [app.service, props.requestId]);

  React.useEffect(() => {
    load().catch(() => {
      if (mounted.current) setLoadError(true);
    });
  }, [load]);

  // While an approval email or a package is being created, check its progress.
  const latestApproval = latestSubmission(submissions, 'approval');
  const latestPackage = latestSubmission(submissions, 'package');
  const waitingOnFlow = [latestApproval, latestPackage].some((s) => !!s && s.packageStatus !== 'Packaged' && s.packageStatus !== 'Failed');
  React.useEffect(() => {
    if (!waitingOnFlow) return;
    const t = window.setInterval(async () => {
      try {
        const subs = await app.service.listSubmissionsForRequest(props.requestId);
        if (mounted.current) setSubmissions(subs);
      } catch {
        // Checked again on the next tick.
      }
    }, 1200);
    return () => window.clearInterval(t);
  }, [waitingOnFlow, app.service, props.requestId]);

  if (!request) {
    return loadError ? (
      <div className="ctx-banner red" role="alert">
        {messages.loadFailed}
      </div>
    ) : (
      <div className="ctx-empty">Loading</div>
    );
  }

  const status = requestStatusDisplay(request.status, request.buyer);
  const approverBuys = request.buyer === 'approver';
  // The approver who approved a request the approver buys is the one who buys it (P-037).
  const buys = mayBuy(request, app.user);
  const packageBadge = latestPackage ? submissionStatusDisplay('package', latestPackage.packageStatus) : null;
  const approvalBadge = latestApproval ? submissionStatusDisplay('approval', latestApproval.packageStatus) : null;
  const state = approvalStateOf(request, lines);
  const approvals = lineApprovals(lines, request.status, request.approval, request.buyer);
  // Equipment and Other rows need a decision before the request can be marked processed (P-038).
  const toReview = rowsToReview(lines);
  const csvRows = csv ? parseCsv(csv) : [];
  // Retry is offered exactly when the services allow it (P-030): for the newest approval email or
  // package, while the request is still at that step, once it has failed or has not finished
  // within PACKAGE_ATTENTION_MINUTES. Worked out again each time the page is drawn, so a stuck one
  // shows as the minutes pass while its progress is checked.
  const now = new Date();
  const retryApproval = latestApproval && retryRefusal(latestApproval, submissions, request.status, now) === '' ? latestApproval : undefined;
  const retryPackage = latestPackage && retryRefusal(latestPackage, submissions, request.status, now) === '' ? latestPackage : undefined;
  const noValidApproval =
    (request.status === 'Approved' || request.status === 'Submitted' || request.status === 'Processed') && (state === 'needed' || state === 'changed');
  const year = dateRange(lines.map((l) => l.date)).first.slice(0, 4);

  // Category edits: the choices that differ from what is stored, and any that cannot be saved (P-024).
  const canEditCategories = canConfirmCategories(request.status);
  const choiceFor = (l: PurchaseLine): { category: CategoryId | ''; categoryOther: string } =>
    edits[l.id] ?? { category: l.category, categoryOther: l.categoryOther };
  const changes: Record<string, CategoryChoice> = {};
  for (const l of lines) {
    const edit = edits[l.id];
    if (edit && (edit.category !== l.category || edit.categoryOther !== l.categoryOther)) changes[l.id] = edit;
  }
  const changedCount = Object.keys(changes).length;
  const editProblems = lines
    .filter((l) => changes[l.id] && categoryNeedsDescription(changes[l.id].category) && !changes[l.id].categoryOther.trim())
    .map((l) => `Row ${l.rowNumber}: ${messages.categoryOtherRequired}`);

  const act = async (work: () => Promise<unknown>, done: string): Promise<void> => {
    setBusy(true);
    try {
      await work();
      app.toast(done);
      app.refreshAdminCounts();
      await load();
    } catch (e) {
      app.reportError(e);
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  const setCategory = (line: PurchaseLine, category: CategoryId | '') => {
    if (category === '') return;
    setEdits((current) => ({
      ...current,
      [line.id]: { category, categoryOther: categoryNeedsDescription(category) ? (current[line.id]?.categoryOther ?? line.categoryOther) : '' }
    }));
  };
  const setCategoryOther = (line: PurchaseLine, category: CategoryId, text: string) =>
    setEdits((current) => ({ ...current, [line.id]: { category, categoryOther: text } }));

  const approve = () => {
    setDialog(null);
    void act(async () => {
      await app.service.approveRequest(request.id, { note: approveNote.trim(), categories: changes });
      if (!mounted.current) return;
      setEdits({});
      setApproveNote('');
    }, `${request.requestNumber} approved.`);
  };

  const confirmCategories = () =>
    act(async () => {
      await app.service.confirmCategories(request.id, changes);
      if (mounted.current) setEdits({});
    }, `Categories confirmed for ${request.requestNumber}.`);

  // Returned at the approval step to the employee; at processing, to the employee, or, when the approver bought it, back to the approver (P-037).
  const returnStage = request.status === 'Awaiting approval' || request.status === 'Approved' ? 'approval' : 'processing';
  const returnsToApprover = returnStage === 'processing' && approverBuys;
  const returnTo = returnsToApprover ? request.approvedBy || 'the approver' : request.ownerName;

  return (
    <>
      <HeaderCard
        title={`${request.requestNumber} ${request.businessPurpose}`}
        subtitle={`Requested by ${request.ownerName}, ${request.department}${approverBuys ? '. The approver buys it.' : ''}`}
        badges={
          <>
            <Badge tone={status.tone}>{status.label}</Badge>
            {packageBadge ? <Badge tone={packageBadge.tone}>{packageBadge.label}</Badge> : null}
            {approvalBadge ? <Badge tone={approvalBadge.tone}>{approvalBadge.label}</Badge> : null}
          </>
        }
        actions={
          <>
            {retryApproval ? (
              <button
                className="ctx-btn ctx-btn-secondary"
                disabled={busy}
                onClick={() => act(() => app.service.retryPackaging(retryApproval.id), 'Approval email started again.')}
              >
                <Icon name="refresh" size={16} />
                Retry approval email
              </button>
            ) : null}
            {request.status === 'Awaiting approval' ? (
              <>
                <button className="ctx-btn ctx-btn-secondary" disabled={busy} onClick={() => setDialog('return')}>
                  <Icon name="undo" size={16} />
                  Return with a note
                </button>
                <button className="ctx-btn ctx-btn-primary" disabled={busy} onClick={() => setDialog('approve')}>
                  <Icon name="check" size={16} />
                  Approve
                </button>
              </>
            ) : null}
            {approverBuys && request.status === 'Approved' ? (
              <button className="ctx-btn ctx-btn-secondary" disabled={busy} onClick={() => setDialog('return')}>
                <Icon name="undo" size={16} />
                Return to the employee
              </button>
            ) : null}
            {buys ? (
              <>
                <button
                  className="ctx-btn ctx-btn-primary"
                  disabled={busy}
                  onClick={() => app.navigate({ name: 'request', requestId: request.id, step: 'purchases' })}
                >
                  <Icon name="send" size={16} />
                  Open to buy
                </button>
              </>
            ) : null}
            {request.status === 'Submitted' ? (
              <>
                {retryPackage ? (
                  <button
                    className="ctx-btn ctx-btn-secondary"
                    disabled={busy}
                    onClick={() => act(() => app.service.retryPackaging(retryPackage.id), 'Packaging started again.')}
                  >
                    <Icon name="refresh" size={16} />
                    Retry packaging
                  </button>
                ) : null}
                <button className="ctx-btn ctx-btn-secondary" disabled={busy} onClick={() => setDialog('return')}>
                  <Icon name="undo" size={16} />
                  Return with a note
                </button>
                <button
                  className="ctx-btn ctx-btn-primary"
                  disabled={busy || toReview.length > 0}
                  title={toReview.length > 0 ? `Confirm the category of ${rowsPhrase(toReview)} first` : undefined}
                  onClick={() => act(() => app.service.markProcessed(request.id), `${request.requestNumber} marked processed.`)}
                >
                  <Icon name="check" size={16} />
                  Mark processed
                </button>
              </>
            ) : null}
          </>
        }
      />
      {retryPackage ? (
        <div className="ctx-banner red">
          <Icon name="alert" />
          {retryPackage.packageStatus === 'Failed' ? (
            <div>
              <strong>The folder was not created.</strong> {retryPackage.errorMessage} If a partial folder exists in Purchases_To_Process, delete it first, then
              click Retry packaging.
            </div>
          ) : (
            <div>
              <strong>The folder has not been created for more than {PACKAGE_ATTENTION_MINUTES} minutes.</strong> The flow may be turned off, or it may have
              stopped part-way. Check it in Power Automate. If a partial folder exists in Purchases_To_Process, delete it first, then click Retry packaging.
            </div>
          )}
        </div>
      ) : null}
      {retryApproval ? (
        <div className="ctx-banner red">
          <Icon name="alert" />
          {retryApproval.packageStatus === 'Failed' ? (
            <div>
              <strong>The approval email may not have been sent.</strong> {retryApproval.errorMessage} The request is still waiting under Approvals. Click Retry
              approval email (the approvers may then get it twice), or approve it here.
            </div>
          ) : (
            <div>
              <strong>The approval email has not been sent for more than {PACKAGE_ATTENTION_MINUTES} minutes.</strong> The flow may be turned off, or it may
              have stopped part-way. Check it in Power Automate. The request is still waiting under Approvals. Click Retry approval email (the approvers may
              then get it twice), or approve it here.
            </div>
          )}
        </div>
      ) : null}
      {approverBuys && request.status === 'Approved' ? (
        <div className="ctx-banner green">
          <Icon name="check" />
          <div>
            {buys ? (
              <>
                <strong>You approved this request, and you buy it.</strong> Open it to change each row to what you bought, attach the receipt or invoice, and
                mark it purchased. If you cannot buy it, return it to {request.ownerName}.
              </>
            ) : (
              <>
                <strong>{request.approvedBy || 'The approver'} approved this request and buys it.</strong> Only they can change its rows, attach the receipt or
                mark it purchased. If they cannot buy it, you can return it to {request.ownerName}.
              </>
            )}
            {request.returnStage === 'processing' && request.returnNote.trim() ? ` Returned at processing: ${request.returnNote.trim()}` : ''}
          </div>
        </div>
      ) : null}
      {toReview.length > 0 && request.status === 'Submitted' ? (
        <div className="ctx-banner amber">
          <Icon name="alert" />
          <div>
            <strong>Confirm the category of {rowsPhrase(toReview)} before you mark this processed.</strong> The account depends on a decision: Equipment is
            expensed or capitalized, and Other has no fixed account. Choose the category in the table, then Confirm categories.
          </div>
        </div>
      ) : null}
      {request.boughtBeforeApproval ? (
        <div className="ctx-banner amber">
          <Icon name="flag" />
          <div>
            <strong>Bought before approval: {boughtBeforeText(request)}.</strong> The purchase was already made when the request was sent for approval.
            {request.status === 'Awaiting approval' ? ' You can still approve it or return it.' : ''}
          </div>
        </div>
      ) : null}
      {noValidApproval ? (
        <div className={`ctx-banner ${state === 'needed' ? 'red' : 'amber'}`}>
          <Icon name="alert" />
          <div>
            <strong>This request has no valid approval on record.</strong>{' '}
            {state === 'needed'
              ? approverBuys
                ? 'It was never approved.'
                : `A vendor total of ${APPROVAL_THRESHOLD_TEXT} or more was never approved.`
              : changedMessages(vendorRows(lines, request)).join(' ')}
          </div>
        </div>
      ) : null}
      {request.status === 'Submitted' && latestPackage && latestPackage.packageStatus === 'Packaged' ? (
        <div className="ctx-banner purple">
          <Icon name="folder" />
          <div>
            <strong>Folder:</strong> <span className="ctx-code">{`${TO_PROCESS} > ${latestPackage.folderName}`}</span>
            <br />
            When you have processed it, move the folder into{' '}
            <span className="ctx-code">Accounting &gt; Purchases &gt; {year || '<year of the earliest purchase date>'}</span> and click Mark processed.
          </div>
        </div>
      ) : null}
      <div className="ctx-totals">
        <div className="ctx-metric">
          <div className="ctx-metric-label">To reimburse</div>
          <div className="ctx-metric-value">{formatCents(request.totalReimburseCents)}</div>
          <div className="ctx-metric-note">{approverBuys ? 'The approver buys it' : `To ${request.ownerName}`}</div>
        </div>
        <div className="ctx-metric">
          <div className="ctx-metric-label">Paid by Clarus</div>
          <div className="ctx-metric-value">{formatCents(request.totalCompanyCents)}</div>
          <div className="ctx-metric-note">Company card or invoice</div>
        </div>
        <div className="ctx-metric">
          <div className="ctx-metric-label">Request total</div>
          <div className="ctx-metric-value">{formatCents(request.totalRequestCents)}</div>
          <div className="ctx-metric-note">{lines.length === 1 ? '1 purchase' : `${lines.length} purchases`}</div>
        </div>
        <div className="ctx-metric">
          <div className="ctx-metric-label">Approval</div>
          <div className="ctx-metric-value" style={{ fontSize: '1rem' }}>
            {approvalStateDisplay(state, request.buyer).label}
          </div>
          <div className="ctx-metric-note">
            {request.approvedBy && (state === 'approved' || state === 'changed') ? `approved by ${approverText(request)}` : ''}
          </div>
        </div>
      </div>
      <Card>
        <div className="ctx-tabs" role="tablist">
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={`ctx-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
        {tab === 'purchases' ? (
          <>
            <div className="ctx-table-wrap">
              <table className="ctx-table compact admin-purchases">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Vendor</th>
                    <th>What was bought and why</th>
                    <th>Item link</th>
                    <th>Category</th>
                    <th>Approval</th>
                    <th>Files</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const choice = choiceFor(l);
                    const approval = approvals.get(l.id);
                    const display = approval ? LINE_APPROVAL_DISPLAY[approval.status] : undefined;
                    const describe = categoryNeedsDescription(choice.category);
                    const otherEmpty = describe && !choice.categoryOther.trim();
                    const receipts = receiptFiles(l);
                    const quotes = quoteFiles(l);
                    const sharesReceipt = l.sameReceiptAsRow !== null && hasReceipt(l, lines);
                    const open = (fileId: string) => setPreview({ lineId: l.id, fileId });
                    return (
                      <tr key={l.id}>
                        <td>{l.rowNumber}</td>
                        <td className="nowrap">{l.date}</td>
                        <td className="vendor-cell">{l.vendor}</td>
                        <td>{l.description}</td>
                        <td className="link-cell">
                          {l.itemLink.trim() ? (
                            <ItemLinkText value={l.itemLink} maxChars={26} />
                          ) : l.noLinkReason.trim() ? (
                            <span className="ctx-muted">No web page: {l.noLinkReason}</span>
                          ) : null}
                        </td>
                        <td className="category-cell">
                          {canEditCategories ? (
                            <div className="ctx-category-edit">
                              <FullTextSelect
                                boxClassName="ctx-box"
                                shownText={findCategory(choice.category)?.label ?? 'Choose'}
                                nothingChosen={choice.category === ''}
                                aria-label={`Row ${l.rowNumber} category`}
                                value={choice.category}
                                onChange={(e) => setCategory(l, e.target.value as CategoryId | '')}
                              >
                                {choice.category === '' ? <option value="">Choose</option> : null}
                                {CATEGORIES.map((c) => (
                                  <option key={c.id} value={c.id} title={c.covers}>
                                    {c.label}
                                  </option>
                                ))}
                              </FullTextSelect>
                              {describe ? (
                                <input
                                  className={`ctx-input ${otherEmpty ? 'blocking' : ''}`}
                                  aria-label={`Row ${l.rowNumber} category description`}
                                  placeholder="Describe the category"
                                  title={otherEmpty ? messages.categoryOtherRequired : undefined}
                                  value={choice.categoryOther}
                                  // The box is shown only for a category that needs a description, so one is chosen.
                                  onChange={(e) => setCategoryOther(l, choice.category as CategoryId, e.target.value)}
                                />
                              ) : null}
                            </div>
                          ) : (
                            categoryText(l.category, l.categoryOther)
                          )}
                          <div className="ctx-hint">
                            {changes[l.id]
                              ? 'Changed here, not confirmed yet'
                              : l.categoryConfirmedBy
                                ? `Confirmed by ${l.categoryConfirmedBy}`
                                : 'Suggested by the employee'}
                          </div>
                          {findCategory(choice.category) ? <div className="ctx-hint">{findCategory(choice.category)!.accountText}</div> : null}
                          {categoryNeedsReview(choice.category) && !l.categoryConfirmedBy ? (
                            <div className="ctx-hint" style={{ color: 'var(--c-warning)' }}>
                              The account depends on your decision. Confirm it before processing.
                            </div>
                          ) : null}
                        </td>
                        <td className="approval-cell">
                          {display ? <Badge tone={display.tone}>{display.label}</Badge> : null}
                          {approval && approval.boughtBefore ? (
                            <span className="ctx-flag" role="img" aria-label="Bought before approval" title="Bought before approval">
                              <Icon name="flag" size={14} />
                            </span>
                          ) : null}
                        </td>
                        <td className="files-cell">
                          <div className="ctx-files-cell">
                            {sharesReceipt ? (
                              <button
                                type="button"
                                className="ctx-receipt-chip shared"
                                title={`Uses the receipt on row ${l.sameReceiptAsRow}`}
                                onClick={() => open('')}
                              >
                                <Icon name="link" size={13} />
                                <span>Receipt of row {l.sameReceiptAsRow}</span>
                              </button>
                            ) : (
                              receipts.map((f) => <FileChip key={f.id} file={f} showKind onOpen={() => open(f.id)} />)
                            )}
                            {quotes.map((f) => (
                              <FileChip key={f.id} file={f} onOpen={() => open(f.id)} />
                            ))}
                            {hasReceipt(l, lines) ? null : request.status === 'Submitted' || request.status === 'Processed' ? (
                              <span className="ctx-file-note" style={{ color: 'var(--c-warning)' }}>
                                No receipt: {l.noReceiptReason}
                              </span>
                            ) : (
                              <span className="ctx-file-note ctx-muted">No receipt yet</span>
                            )}
                            {quotes.length === 0 && l.noQuoteReason.trim() ? (
                              <span className="ctx-file-note ctx-muted">No quote: {l.noQuoteReason}</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="num">
                          {l.amountCents === null ? '' : formatCents(l.amountCents)}
                          <div className="ctx-hint">{approverBuys ? '' : (findPaidBy(l.paidBy)?.shortLabel ?? '')}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {approverBuys ? (
              <div style={{ marginTop: 14 }}>
                <SentRowsCard request={request} lines={lines} forApprover />
              </div>
            ) : null}
            {canEditCategories ? (
              <div className="ctx-grid-footer">
                {request.status === 'Approved' || request.status === 'Submitted' ? (
                  <button className="ctx-btn ctx-btn-secondary ctx-btn-small" disabled={busy || editProblems.length > 0} onClick={confirmCategories}>
                    <Icon name="check" size={15} />
                    Confirm categories
                  </button>
                ) : null}
                <span className="ctx-hint">
                  {request.status === 'Awaiting approval'
                    ? 'The employee suggested these categories. Change one here if it is wrong. Approving confirms the categories shown.'
                    : request.status === 'Approved'
                      ? 'Confirming records that you checked the categories. No folder or CSV has been made yet, so a change here goes into it.'
                      : 'Confirming records that you checked the categories. The CSV already in the folder keeps the category as submitted.'}
                </span>
              </div>
            ) : null}
          </>
        ) : null}
        {tab === 'vendors' ? <VendorTotals lines={lines} request={request} showApproved showIntro /> : null}
        {tab === 'approvalEmail' ? (
          latestApproval ? (
            <div className="ctx-email-preview">
              <div className="ctx-hint" style={{ marginBottom: 8 }}>
                <strong>Subject:</strong> {latestApproval.emailSubject}
              </div>
              <h4>{latestApproval.submissionNumber > 1 ? 'Purchase approval needed again' : 'Purchase approval needed'}</h4>
              {/*
                Security: the summary is plain text, shown as text (travel D-067). Employees can edit
                their own list items directly in SharePoint (travel D-002), so stored text is never
                treated as HTML, here or in the email, where the flow escapes it.
              */}
              <div style={{ whiteSpace: 'pre-wrap' }}>{latestApproval.emailSummary}</div>
              <p>
                <strong>Open the request in Purchase Requests to approve it, confirm the categories, or return it with a note:</strong> (link)
              </p>
              <div className="ctx-hint">Sent to the approvers, the site Owners as they were when the flow package was made.</div>
            </div>
          ) : (
            <div className="ctx-empty">No approval request has been sent yet.</div>
          )
        ) : null}
        {tab === 'submissionEmail' ? (
          latestPackage ? (
            <div className="ctx-email-preview">
              <div className="ctx-hint" style={{ marginBottom: 8 }}>
                <strong>Subject:</strong> {latestPackage.emailSubject}
              </div>
              <h4>{latestPackage.submissionNumber > 1 ? 'Purchase request resubmitted' : 'Purchase request submitted'}</h4>
              {/* Stored text, shown as text and never as HTML (see the approval email above). */}
              <div style={{ whiteSpace: 'pre-wrap' }}>{latestPackage.emailSummary}</div>
              <p>
                <strong>Folder:</strong> {TO_PROCESS} &gt; {latestPackage.folderName} (link)
                <br />
                <strong>All requests waiting:</strong> {TO_PROCESS} (link)
                <br />
                <strong>Open the request in Purchase Requests</strong> (link)
              </p>
            </div>
          ) : (
            <div className="ctx-empty">Nothing submitted yet. The email appears here after the employee submits.</div>
          )
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
                {CSV_COLUMNS.length} columns. Opens directly in Excel. The QuickBooks accounts are {QUICKBOOKS_MAPPING_STATUS}; you decide the account for
                Equipment and Other.
              </div>
            </div>
          ) : (
            <div className="ctx-empty">No CSV yet.</div>
          )
        ) : null}
        {tab === 'folder' ? (
          latestPackage ? (
            <div>
              <div className="ctx-hint" style={{ marginBottom: 10 }}>
                <span className="ctx-code">
                  {TO_PROCESS} &gt; {latestPackage.folderName}
                </span>
              </div>
              <table className="ctx-table">
                <tbody>
                  {latestPackage.packageFileNames.map((name) => (
                    <tr key={name}>
                      <td>
                        <Icon name="file" size={14} /> {name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="ctx-empty">No folder yet. It is created when the employee submits.</div>
          )
        ) : null}
      </Card>
      {dialog === 'approve' ? (
        <Dialog
          title={`Approve ${request.requestNumber}?`}
          onClose={() => setDialog(null)}
          actions={
            <>
              <button className="ctx-btn ctx-btn-secondary" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button className="ctx-btn ctx-btn-primary" disabled={editProblems.length > 0} onClick={approve}>
                Approve request
              </button>
            </>
          }
        >
          <p style={{ margin: 0 }}>
            {approverBuys
              ? 'Approving means you buy it. It confirms the categories shown and records each vendor total as approved at its current amount; you may change the amounts when you buy it. '
              : 'Approving confirms the categories shown and records each vendor total as approved at its current amount. '}
            {changedCount === 0 ? 'You have not changed any categories.' : `You changed ${changedCount} ${changedCount === 1 ? 'category' : 'categories'}.`}
          </p>
          {editProblems.length > 0 ? (
            <div className="ctx-field-error" role="alert">
              {editProblems.join(' ')}
            </div>
          ) : null}
          <div>
            <label className="ctx-label" htmlFor="approve-note">
              Note for the employee (optional)
            </label>
            <textarea
              id="approve-note"
              className="ctx-textarea"
              value={approveNote}
              onChange={(e) => setApproveNote(e.target.value)}
              placeholder="For example: OK, use the company card."
            />
          </div>
        </Dialog>
      ) : null}
      {dialog === 'return' ? (
        <Dialog
          title={`Return ${request.requestNumber} to ${returnTo}`}
          onClose={() => setDialog(null)}
          actions={
            <>
              <button className="ctx-btn ctx-btn-secondary" onClick={() => setDialog(null)}>
                Cancel
              </button>
              <button
                className="ctx-btn ctx-btn-primary"
                disabled={!returnNote.trim()}
                onClick={() => {
                  setDialog(null);
                  void act(() => app.service.returnRequest(request.id, returnNote.trim()), `${request.requestNumber} returned to ${returnTo}.`);
                }}
              >
                Return request
              </button>
            </>
          }
        >
          <label className="ctx-label" htmlFor="return-note">
            What needs correcting? {returnsToApprover ? `${returnTo} sees` : 'The employee sees'} this note.
          </label>
          <textarea
            id="return-note"
            className="ctx-textarea"
            value={returnNote}
            onChange={(e) => setReturnNote(e.target.value)}
            placeholder={
              returnStage === 'approval'
                ? 'For example: Please add a quote for Redwood Fabrication, or say why there is none.'
                : 'For example: Row 2, please attach the itemized invoice.'
            }
          />
          <div className="ctx-hint">
            {request.status === 'Approved'
              ? 'The employee sees your note, corrects the request and sends it to the approver again. If you added rows to this request, delete them first.'
              : returnStage === 'approval'
                ? 'The employee sees your note, corrects the request and sends it for approval again.'
                : returnsToApprover
                  ? `The request goes back to ${returnTo}, who fixes it and marks it purchased again. Delete this request's folder from Purchases_To_Process. The corrected request arrives as a new folder ending in _R2.`
                  : "After returning, delete this request's folder from Purchases_To_Process. The corrected request arrives as a new folder ending in _R2."}
          </div>
        </Dialog>
      ) : null}
      {preview ? (
        <ReceiptPreview
          overlay
          line={lines.find((l) => l.id === preview.lineId)}
          lines={lines}
          focusFileId={preview.fileId || undefined}
          onHide={() => setPreview(null)}
        />
      ) : null}
    </>
  );
}
