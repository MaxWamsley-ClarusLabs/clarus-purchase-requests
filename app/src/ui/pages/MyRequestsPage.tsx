import * as React from 'react';
import { formatCents } from '../../domain/money';
import { REQUEST_STATUS_DISPLAY, isEditable } from '../../domain/statuses';
import { PurchaseRequest } from '../../domain/types';
import { useApp } from '../AppContext';
import { useMountedRef } from '../hooks';
import { Badge, Card, DateTime, HeaderCard, Tag, openRowProps } from '../components/common';
import { Icon } from '../components/Icon';

/** Who sent a request back, from the step the return came at (docs/DATA_MODEL.md). */
function returnedBy(request: PurchaseRequest): string {
  return request.returnStage === 'approval' ? 'the approver' : request.returnStage === 'processing' ? 'the administrator' : 'the approver or administrator';
}

export function MyRequestsPage(): React.ReactElement {
  const app = useApp();
  const [requests, setRequests] = React.useState<PurchaseRequest[] | null>(null);
  const [creating, setCreating] = React.useState(false);
  const mounted = useMountedRef();

  React.useEffect(() => {
    app.service
      .listMyRequests()
      .then((mine) => {
        if (mounted.current) setRequests(mine);
      })
      .catch(app.reportError);
  }, [app.service]);

  const create = async (): Promise<void> => {
    setCreating(true);
    try {
      const request = await app.service.createRequest();
      app.navigate({ name: 'request', requestId: request.id, step: 'details' });
    } catch (e) {
      if (mounted.current) setCreating(false);
      app.reportError(e);
    }
  };

  // A request still being worked on opens at its purchases (or its details, if it has no business purpose yet); a sent one opens at Review.
  const open = (r: PurchaseRequest) =>
    app.navigate({ name: 'request', requestId: r.id, step: isEditable(r.status) ? (r.businessPurpose ? 'purchases' : 'details') : 'review' });
  const returned = (requests ?? []).filter((r) => r.status === 'Returned');
  const approved = (requests ?? []).filter((r) => r.status === 'Approved');

  return (
    <>
      <HeaderCard
        title="My requests"
        subtitle="One request per business purpose. Drafts save automatically."
        actions={
          <>
            <button className="ctx-btn ctx-btn-secondary" onClick={app.openInstructions}>
              <Icon name="book" size={16} />
              Instructions
            </button>
            <button className="ctx-btn ctx-btn-primary" onClick={create} disabled={creating}>
              <Icon name="plus" size={16} />
              New request
            </button>
          </>
        }
      />
      {returned.map((r) => (
        <div key={r.id} className="ctx-banner amber">
          <Icon name="undo" />
          <div style={{ flex: 1 }}>
            <strong>
              {r.requestNumber} {r.businessPurpose} was returned to you by {returnedBy(r)}.
            </strong>{' '}
            {r.returnNote}
          </div>
          <button className="ctx-btn ctx-btn-secondary ctx-btn-small" onClick={() => open(r)}>
            Correct it
          </button>
        </div>
      ))}
      {approved.map((r) => (
        <div key={r.id} className="ctx-banner green">
          <Icon name="check" />
          <div style={{ flex: 1 }}>
            <strong>
              {r.requestNumber} {r.businessPurpose} is approved.
            </strong>{' '}
            Buy, attach your receipts and submit it.
          </div>
          <button className="ctx-btn ctx-btn-secondary ctx-btn-small" onClick={() => open(r)}>
            Open
          </button>
        </div>
      ))}
      <Card title="Requests">
        {requests === null ? (
          <div className="ctx-empty">Loading</div>
        ) : requests.length === 0 ? (
          <div className="ctx-empty">
            <Icon name="list" size={28} />
            <h3>No requests yet</h3>
            Click New request to start your first purchase request.
          </div>
        ) : (
          <div className="ctx-table-wrap">
            <table className="ctx-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Business purpose</th>
                  <th>Status</th>
                  <th className="num">To reimburse</th>
                  <th className="num">Request total</th>
                  <th>Last change</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => {
                  const s = REQUEST_STATUS_DISPLAY[r.status];
                  return (
                    <tr key={r.id} {...openRowProps(`Open ${r.requestNumber}`, () => open(r))}>
                      <td className="ctx-strong nowrap">{r.requestNumber}</td>
                      <td>{r.businessPurpose || <span className="ctx-muted">Untitled draft</span>}</td>
                      <td>
                        <Badge tone={s.tone}>{s.label}</Badge>
                        {r.boughtBeforeApproval ? (
                          <>
                            {' '}
                            <Tag>Bought before approval</Tag>
                          </>
                        ) : null}
                      </td>
                      <td className="num">{formatCents(r.totalReimburseCents)}</td>
                      <td className="num">{formatCents(r.totalRequestCents)}</td>
                      <td className="ctx-muted">
                        <DateTime value={r.lastChanged} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
