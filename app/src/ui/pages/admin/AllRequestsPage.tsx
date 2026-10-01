import * as React from 'react';
import { formatCents } from '../../../domain/money';
import { REQUEST_STATUSES, REQUEST_STATUS_DISPLAY } from '../../../domain/statuses';
import { PurchaseRequest, RequestStatus } from '../../../domain/types';
import { useApp } from '../../AppContext';
import { useMountedRef } from '../../hooks';
import { Badge, Card, DateTime, HeaderCard, Tag, openRowProps } from '../../components/common';
import { Icon } from '../../components/Icon';

const FILTERS: (RequestStatus | 'All')[] = ['All', ...REQUEST_STATUSES];

export function AllRequestsPage(): React.ReactElement {
  const app = useApp();
  const [requests, setRequests] = React.useState<PurchaseRequest[] | null>(null);
  const [filter, setFilter] = React.useState<RequestStatus | 'All'>('All');
  const mounted = useMountedRef();
  React.useEffect(() => {
    app.service
      .listAllRequests()
      .then((all) => {
        if (mounted.current) setRequests(all);
      })
      .catch(app.reportError);
  }, [app.service]);
  const shown = (requests ?? []).filter((r) => filter === 'All' || r.status === filter);
  return (
    <>
      <HeaderCard title="All requests" subtitle="Every employee's requests." />
      <Card>
        <div className="ctx-tabs" role="tablist" aria-label="Show requests that are">
          {FILTERS.map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={`ctx-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        {requests === null ? (
          <div className="ctx-empty">Loading</div>
        ) : shown.length === 0 ? (
          <div className="ctx-empty">
            <Icon name="folder" size={28} />
            <h3>{filter === 'All' ? 'No requests yet' : 'None with this status'}</h3>
            {filter === 'All'
              ? 'Requests appear here when employees create them.'
              : `No request has the status ${REQUEST_STATUS_DISPLAY[filter].label}. Choose another status above.`}
          </div>
        ) : (
          <div className="ctx-table-wrap">
            <table className="ctx-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Employee</th>
                  <th>Business purpose</th>
                  <th>Status</th>
                  <th className="num">Request total</th>
                  <th>Last change</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} {...openRowProps(`Open ${r.requestNumber}`, () => app.navigate({ name: 'adminRequest', requestId: r.id }))}>
                    <td className="ctx-strong nowrap">{r.requestNumber}</td>
                    <td>{r.ownerName}</td>
                    <td>{r.businessPurpose || <span className="ctx-muted">Untitled draft</span>}</td>
                    <td>
                      <Badge tone={REQUEST_STATUS_DISPLAY[r.status].tone}>{REQUEST_STATUS_DISPLAY[r.status].label}</Badge>
                      {r.boughtBeforeApproval ? (
                        <>
                          {' '}
                          <Tag>Bought before approval</Tag>
                        </>
                      ) : null}
                    </td>
                    <td className="num">{formatCents(r.totalRequestCents)}</td>
                    <td className="ctx-muted">
                      <DateTime value={r.lastChanged} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
