import * as React from 'react';
import { formatCents } from '../../domain/money';
import { REPORT_STATUS_DISPLAY } from '../../domain/statuses';
import { TravelReport } from '../../domain/types';
import { useApp } from '../AppContext';
import { Badge, Card, HeaderCard } from '../components/common';
import { Icon } from '../components/Icon';

export function MyReportsPage(): React.ReactElement {
  const app = useApp();
  const [reports, setReports] = React.useState<TravelReport[] | null>(null);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    app.service.listMyReports().then(setReports).catch(app.reportError);
  }, [app.service]);

  const create = async (): Promise<void> => {
    setCreating(true);
    try {
      const report = await app.service.createReport();
      app.navigate({ name: 'report', reportId: report.id, step: 'trip' });
    } catch (e) {
      setCreating(false);
      app.reportError(e);
    }
  };

  const open = (r: TravelReport) =>
    app.navigate({ name: 'report', reportId: r.id, step: r.status === 'Draft' || r.status === 'Returned' ? (r.tripName ? 'expenses' : 'trip') : 'review' });
  const returned = (reports ?? []).filter((r) => r.status === 'Returned');

  return (
    <>
      <HeaderCard
        title="My reports"
        subtitle="One report per trip. Drafts save automatically."
        actions={
          <>
            <button className="ctx-btn ctx-btn-secondary" onClick={app.openInstructions}>
              <Icon name="book" size={16} />
              Instructions
            </button>
            <button className="ctx-btn ctx-btn-primary" onClick={create} disabled={creating}>
              <Icon name="plus" size={16} />
              New report
            </button>
          </>
        }
      />
      {returned.map((r) => (
        <div key={r.id} className="ctx-banner amber">
          <Icon name="undo" />
          <div style={{ flex: 1 }}>
            <strong>
              {r.reportNumber} {r.tripName} was returned to you.
            </strong>{' '}
            {r.returnNote}
          </div>
          <button className="ctx-btn ctx-btn-secondary ctx-btn-small" onClick={() => open(r)}>
            Correct it
          </button>
        </div>
      ))}
      <Card title="Reports">
        {reports === null ? (
          <div className="ctx-empty">Loading</div>
        ) : reports.length === 0 ? (
          <div className="ctx-empty">
            <Icon name="list" size={28} />
            <h3>No reports yet</h3>
            Click New report to start your first trip report.
          </div>
        ) : (
          <table className="ctx-table">
            <thead>
              <tr>
                <th>Report</th>
                <th>Trip</th>
                <th>Dates</th>
                <th>Status</th>
                <th className="num">To reimburse</th>
                <th className="num">Trip total</th>
                <th>Last change</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const s = REPORT_STATUS_DISPLAY[r.status];
                return (
                  <tr key={r.id} className="clickable" onClick={() => open(r)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && open(r)}>
                    <td className="ctx-strong">{r.reportNumber}</td>
                    <td>{r.tripName || <span className="ctx-muted">Untitled draft</span>}</td>
                    <td>{r.tripStart && r.tripEnd ? `${r.tripStart} to ${r.tripEnd}` : ''}</td>
                    <td>
                      <Badge tone={s.tone}>{s.label}</Badge>
                    </td>
                    <td className="num">{formatCents(r.totalReimburseCents)}</td>
                    <td className="num">{formatCents(r.totalTripCents)}</td>
                    <td className="ctx-muted">{r.lastChanged}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
