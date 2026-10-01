import * as React from 'react';
import { CurrentUser } from '../../domain/types';
import { Route, RequestStep } from '../routing';
import { Icon } from './Icon';

export type StepState = 'done' | 'attention' | 'current' | 'waiting' | 'locked';

export interface RequestNav {
  requestId: number;
  requestNumber: string;
  steps: Record<RequestStep, { state: StepState; status: string }>;
  /** Names that differ from the usual ones, such as the last step when the approver buys (P-037). */
  names?: Partial<Record<RequestStep, string>>;
}

/** The administrator list a request page was opened from, so the sidebar can keep it highlighted. */
export type AdminList = 'adminApprovals' | 'adminProcess' | 'adminAttention' | 'adminAll';

export interface AdminCounts {
  /** Requests awaiting approval, and approved requests the signed-in approver is to buy (P-037). */
  approvals: number;
  /** Submitted requests waiting to be processed. */
  process: number;
  /** Approval emails and packages that failed or are stuck. */
  attention: number;
}

interface Props {
  user: CurrentUser;
  route: Route;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  navigate: (route: Route) => void;
  requestNav: RequestNav | null;
  adminCounts: AdminCounts;
  /** The list an administrator came from to the request page they are on; null when unknown. */
  adminListOpenedFrom: AdminList | null;
  logoUrl: string;
}

const STEPS: { step: RequestStep; number: number; name: string }[] = [
  { step: 'details', number: 1, name: 'Request details' },
  { step: 'purchases', number: 2, name: 'Purchases' },
  { step: 'review', number: 3, name: 'Review and submit' }
];

export function Sidebar(props: Props): React.ReactElement {
  const { route, navigate, requestNav, collapsed } = props;
  const item = (active: boolean, extra = '') => `ctx-nav-item ${active ? 'active' : ''} ${extra}`;
  // On a request's own page, the list it was opened from stays highlighted.
  const onList = (list: AdminList) => route.name === list || (route.name === 'adminRequest' && props.adminListOpenedFrom === list);

  const adminItem = (list: AdminList, label: string, icon: string, count: number) => (
    <button className={item(onList(list))} onClick={() => navigate({ name: list })} title={label}>
      <span className="ctx-nav-icon">
        <Icon name={icon} size={15} />
      </span>
      <span className="ctx-nav-text ctx-hide-collapsed">
        <span className="ctx-nav-name">{label}</span>
      </span>
      {count > 0 ? <span className="ctx-nav-count ctx-hide-collapsed">{count}</span> : null}
    </button>
  );

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
        <button className={item(route.name === 'home')} onClick={() => navigate({ name: 'home' })} title="My requests">
          <span className="ctx-nav-icon">
            <Icon name="list" size={15} />
          </span>
          <span className="ctx-nav-text ctx-hide-collapsed">
            <span className="ctx-nav-name">My requests</span>
          </span>
        </button>
      </div>

      {requestNav && route.name === 'request' ? (
        <div className="ctx-nav">
          <div className="ctx-nav-label ctx-hide-collapsed">Request {requestNav.requestNumber}</div>
          {STEPS.map((s) => {
            const info = requestNav.steps[s.step];
            const active = route.step === s.step;
            const extra = info.state === 'done' ? 'done' : info.state === 'attention' ? 'attention' : '';
            const name = requestNav.names?.[s.step] ?? s.name;
            return (
              <button
                key={s.step}
                className={item(active, extra)}
                onClick={() => navigate({ name: 'request', requestId: requestNav.requestId, step: s.step })}
                title={`${s.number}. ${name}`}
              >
                <span className="ctx-nav-icon">{info.state === 'done' ? <Icon name="check" size={14} /> : s.number}</span>
                <span className="ctx-nav-text ctx-hide-collapsed">
                  <span className="ctx-nav-name">{name}</span>
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
          {adminItem('adminApprovals', 'Approvals', 'approve', props.adminCounts.approvals)}
          {adminItem('adminProcess', 'Requests to process', 'inbox', props.adminCounts.process)}
          {adminItem('adminAttention', 'Needs attention', 'alert', props.adminCounts.attention)}
          {adminItem('adminAll', 'All requests', 'folder', 0)}
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
