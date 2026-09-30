import * as React from 'react';
import { formatCents } from '../../../domain/money';
import { REPORT_STATUS_DISPLAY } from '../../../domain/statuses';
import { ReportStatus, TravelReport } from '../../../domain/types';
import { useApp } from '../../AppContext';
import { Badge, Card, HeaderCard } from '../../components/common';

const FILTERS: (ReportStatus | 'All')[] = ['All', 'Draft', 'Submitted', 'Returned', 'Processed'];

export function AllReportsPage(): React.ReactElement {
  const app = useApp();
  const [reports, setReports] = React.useState<TravelReport[]>([]);
  const [filter, setFilter] = React.useState<ReportStatus | 'All'>('All');
  React.useEffect(() => {
    app.service.listAllReports().then(setReports).catch(app.reportError);
  }, [app.service]);
  const shown = reports.filter((r) => filter === 'All' || r.status === filter);
  return (
    <>
      <HeaderCard title="All reports" subtitle="Every employee's reports." />
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
              <th>Report</th>
              <th>Employee</th>
              <th>Trip</th>
              <th>Dates</th>
              <th>Status</th>
              <th className="num">Trip total</th>
              <th>Last change</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="clickable" onClick={() => app.navigate({ name: 'adminReport', reportId: r.id })}>
                <td className="ctx-strong">{r.reportNumber}</td>
                <td>{r.ownerName}</td>
                <td>{r.tripName}</td>
                <td>{r.tripStart && r.tripEnd ? `${r.tripStart} to ${r.tripEnd}` : ''}</td>
                <td>
                  <Badge tone={REPORT_STATUS_DISPLAY[r.status].tone}>{REPORT_STATUS_DISPLAY[r.status].label}</Badge>
                </td>
                <td className="num">{formatCents(r.totalTripCents)}</td>
                <td className="ctx-muted">{r.lastChanged}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
