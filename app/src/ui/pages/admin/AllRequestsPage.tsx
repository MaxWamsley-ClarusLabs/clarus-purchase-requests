import * as React from 'react';
import { formatCents } from '../../../domain/money';
import { REQUEST_STATUSES, REQUEST_STATUS_DISPLAY } from '../../../domain/statuses';
import { PurchaseRequest, RequestStatus } from '../../../domain/types';
import { useApp } from '../../AppContext';
import { Badge, Card, HeaderCard, Tag } from '../../components/common';

const FILTERS: (RequestStatus | 'All')[] = ['All', ...REQUEST_STATUSES];

export function AllRequestsPage(): React.ReactElement {
  const app = useApp();
  const [requests, setRequests] = React.useState<PurchaseRequest[]>([]);
  const [filter, setFilter] = React.useState<RequestStatus | 'All'>('All');
  React.useEffect(() => {
    app.service.listAllRequests().then(setRequests).catch(app.reportError);
  }, [app.service]);
  const shown = requests.filter((r) => filter === 'All' || r.status === filter);
  return (
    <>
      <HeaderCard title="All requests" subtitle="Every employee's requests." />
      <Card>
        <div className="ctx-tabs" role="tablist">
          {FILTERS.map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className={`ctx-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
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
              <tr key={r.id} className="clickable" onClick={() => app.navigate({ name: 'adminRequest', requestId: r.id })}>
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
                <td className="ctx-muted">{r.lastChanged}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
