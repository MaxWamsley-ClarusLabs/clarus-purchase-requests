import * as React from 'react';
import { CurrentUser } from '../../domain/types';
import { Route, ReportStep } from '../routing';
import { Icon } from './Icon';

export type StepState = 'done' | 'attention' | 'current' | 'waiting' | 'locked';

export interface ReportNav {
  reportId: number;
  reportNumber: string;
  steps: Record<ReportStep, { state: StepState; status: string }>;
}

interface Props {
  user: CurrentUser;
  route: Route;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  navigate: (route: Route) => void;
  reportNav: ReportNav | null;
  adminCounts: { process: number; attention: number };
  logoUrl: string;
}

const STEPS: { step: ReportStep; number: number; name: string }[] = [
  { step: 'trip', number: 1, name: 'Trip details' },
  { step: 'expenses', number: 2, name: 'Expenses' },
  { step: 'review', number: 3, name: 'Review and submit' }
];

export function Sidebar(props: Props): React.ReactElement {
  const { route, navigate, reportNav, collapsed } = props;
  const item = (active: boolean, extra = '') => `ctx-nav-item ${active ? 'active' : ''} ${extra}`;

  return (
    <nav className="ctx-sidebar" aria-label="Purchase Requests">
      <div className="ctx-brand">
        <img src={props.logoUrl} alt="Clarus" />
        <div className="ctx-hide-collapsed">
          <div className="ctx-brand-title">Clarus</div>
          <div className="ctx-brand-subtitle">Purchase Requests</div>
        </div>
      </div>

      <div className="ctx-nav">
        <button className={item(route.name === 'home')} onClick={() => navigate({ name: 'home' })} title="My reports">
          <span className="ctx-nav-icon">
            <Icon name="list" size={15} />
          </span>
          <span className="ctx-nav-text ctx-hide-collapsed">
            <span className="ctx-nav-name">My reports</span>
          </span>
        </button>
      </div>

      {reportNav && route.name === 'report' ? (
        <div className="ctx-nav">
          <div className="ctx-nav-label ctx-hide-collapsed">Report {reportNav.reportNumber}</div>
          {STEPS.map((s) => {
            const info = reportNav.steps[s.step];
            const active = route.step === s.step;
            const extra = info.state === 'done' ? 'done' : info.state === 'attention' ? 'attention' : '';
            return (
              <button
                key={s.step}
                className={item(active, extra)}
                onClick={() => navigate({ name: 'report', reportId: reportNav.reportId, step: s.step })}
                title={`${s.number}. ${s.name}`}
              >
                <span className="ctx-nav-icon">{info.state === 'done' ? <Icon name="check" size={14} /> : s.number}</span>
                <span className="ctx-nav-text ctx-hide-collapsed">
                  <span className="ctx-nav-name">{s.name}</span>
                  <span className="ctx-nav-status">{info.status}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {props.user.isAdministrator ? (
        <div className="ctx-nav">
          <div className="ctx-nav-label ctx-hide-collapsed">Administrator</div>
          <button
            className={item(route.name === 'adminProcess' || route.name === 'adminReport')}
            onClick={() => navigate({ name: 'adminProcess' })}
            title="Reports to process"
          >
            <span className="ctx-nav-icon">
              <Icon name="inbox" size={15} />
            </span>
            <span className="ctx-nav-text ctx-hide-collapsed">
              <span className="ctx-nav-name">Reports to process</span>
            </span>
            {props.adminCounts.process > 0 ? <span className="ctx-nav-count ctx-hide-collapsed">{props.adminCounts.process}</span> : null}
          </button>
          <button className={item(route.name === 'adminAttention')} onClick={() => navigate({ name: 'adminAttention' })} title="Needs attention">
            <span className="ctx-nav-icon">
              <Icon name="alert" size={15} />
            </span>
            <span className="ctx-nav-text ctx-hide-collapsed">
              <span className="ctx-nav-name">Needs attention</span>
            </span>
            {props.adminCounts.attention > 0 ? <span className="ctx-nav-count ctx-hide-collapsed">{props.adminCounts.attention}</span> : null}
          </button>
          <button className={item(route.name === 'adminAll')} onClick={() => navigate({ name: 'adminAll' })} title="All reports">
            <span className="ctx-nav-icon">
              <Icon name="folder" size={15} />
            </span>
            <span className="ctx-nav-text ctx-hide-collapsed">
              <span className="ctx-nav-name">All reports</span>
            </span>
          </button>
          <button className={item(route.name === 'setup')} onClick={() => navigate({ name: 'setup' })} title="Set-up">
            <span className="ctx-nav-icon">
              <Icon name="gear" size={15} />
            </span>
            <span className="ctx-nav-text ctx-hide-collapsed">
              <span className="ctx-nav-name">Set-up</span>
            </span>
          </button>
        </div>
      ) : null}

      <div className="ctx-sidebar-footer">
        <div className="ctx-user ctx-hide-collapsed">
          <strong>{props.user.displayName}</strong>
          {props.user.isAdministrator ? 'Administrator' : 'Employee'}
        </div>
        <button
          className="ctx-btn ctx-btn-small ctx-btn-sidebar"
          onClick={props.onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon name={collapsed ? 'expand' : 'collapse'} size={15} />
          <span className="ctx-hide-collapsed">Collapse</span>
        </button>
      </div>
    </nav>
  );
}
