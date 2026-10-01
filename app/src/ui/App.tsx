import * as React from 'react';
import { CurrentUser } from '../domain/types';
import { PurchaseDataService } from '../data/PurchaseDataService';
import { AppContext, AppContextValue } from './AppContext';
import { InstructionsDrawer } from './components/InstructionsDrawer';
import { AdminCounts, AdminList, RequestNav, Sidebar } from './components/Sidebar';
import { Toast, Toasts } from './components/common';
import { MyRequestsPage } from './pages/MyRequestsPage';
import { RequestWorkspace, WIDE_LAYOUT_PX } from './pages/RequestWorkspace';
import { AdminRequestPage } from './pages/admin/AdminRequestPage';
import { AllRequestsPage } from './pages/admin/AllRequestsPage';
import { ApprovalsPage } from './pages/admin/ApprovalsPage';
import { SetupPage } from './pages/admin/SetupPage';
import { SetupStatus } from '../data/setup';
import { NeedsAttentionPage } from './pages/admin/NeedsAttentionPage';
import { RequestsToProcessPage } from './pages/admin/RequestsToProcessPage';
import { requestsAwaitingApproval, requestsToProcess, stuckSubmissions } from './pages/admin/adminData';
import { Route, useLocation } from './routing';
import { injectTheme } from './theme';
import { errorText } from './errors';
import { messages } from '../domain/messages';
import { ReceiptReader } from '../reading/ReceiptReader';
import { NotAllowedError } from '../data/sharepoint/serviceRules';

const COLLAPSE_KEY = 'ctx-sidebar-collapsed';
const NARROW_WIDTH = 1280;

// The sidebar choice is remembered on this computer only (travel D-033). Storage can be
// unavailable (private windows, blocked site data), so every access is guarded.
function readCollapsed(): boolean | null {
  try {
    const v = window.localStorage.getItem(COLLAPSE_KEY);
    return v === null ? null : v === 'true';
  } catch {
    return null;
  }
}
function writeCollapsed(value: boolean): void {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, String(value));
  } catch {
    // Not remembered; the app still works.
  }
}

const ADMIN_LISTS: readonly string[] = ['adminApprovals', 'adminProcess', 'adminAttention', 'adminAll'];

export function App(props: { service: PurchaseDataService; logoUrl: string; reader?: ReceiptReader | null }): React.ReactElement {
  const { service } = props;
  const [user, setUser] = React.useState<CurrentUser | null>(null);
  const [startError, setStartError] = React.useState('');
  const [setup, setSetup] = React.useState<SetupStatus | null>(null);
  const [location, navigate] = useLocation();
  const [userCollapsed, setUserCollapsed] = React.useState<boolean | null>(readCollapsed);
  const [viewportWidth, setViewportWidth] = React.useState(() => window.innerWidth);
  const [instructionsOpen, setInstructionsOpen] = React.useState(location.panel === 'instructions');
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [requestNav, setRequestNav] = React.useState<RequestNav | null>(null);
  const [adminCounts, setAdminCounts] = React.useState<AdminCounts>({ approvals: 0, process: 0, attention: 0 });
  const [adminListOpenedFrom, setAdminListOpenedFrom] = React.useState<AdminList | null>(null);
  const toastId = React.useRef(0);

  React.useEffect(() => {
    injectTheme();
    // Who is signed in, and whether this site's lists are ready (travel D-063).
    Promise.all([service.getCurrentUser(), service.getSetupStatus()])
      .then(([u, s]) => {
        setSetup(s);
        setUser(u);
      })
      .catch((e: unknown) => setStartError(errorText(e)));
  }, [service]);

  React.useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  React.useEffect(() => {
    if (location.panel === 'instructions') setInstructionsOpen(true);
  }, [location.panel]);

  // On a request's own administrator page, the sidebar keeps the list it was opened from highlighted.
  React.useEffect(() => {
    if (ADMIN_LISTS.includes(location.route.name)) setAdminListOpenedFrom(location.route.name as AdminList);
  }, [location.route.name]);

  // Background refresh of the sidebar counts. A failure leaves the last counts
  // in place; the administrator pages show their own errors.
  const refreshAdminCounts = React.useCallback(async (): Promise<void> => {
    if (!user || !user.isAdministrator || !setup || !setup.ready) return;
    try {
      const [requests, submissions] = await Promise.all([service.listAllRequests(), service.listSubmissions()]);
      setAdminCounts({
        approvals: requestsAwaitingApproval(requests).length,
        process: requestsToProcess(requests).length,
        attention: stuckSubmissions(requests, submissions).length
      });
    } catch {
      // Keep the last counts.
    }
  }, [service, user, setup]);

  React.useEffect(() => {
    void refreshAdminCounts();
    const t = window.setInterval(() => {
      void refreshAdminCounts();
    }, 5000);
    return () => window.clearInterval(t);
  }, [refreshAdminCounts]);

  const toast = React.useCallback((text: string, tone: 'info' | 'warning' = 'info') => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  // Once the lists are ready the administrator stays on Set-up for step 2.
  const onSetupReady = React.useCallback(
    (status: SetupStatus) => {
      setSetup(status);
      navigate({ name: 'setup' });
    },
    [navigate]
  );

  // A refusal by the app's own rules already says what to do, so it is shown as it is; anything else is a failure to try again.
  const reportError = React.useCallback(
    (e: unknown) => toast(e instanceof NotAllowedError ? errorText(e) : messages.actionFailed(errorText(e)), 'warning'),
    [toast]
  );

  const openInstructions = React.useCallback(() => setInstructionsOpen(true), []);

  if (startError) {
    return (
      <div className="ctx-app">
        <main className="ctx-main">
          <div className="ctx-banner red" role="alert">
            {messages.startFailed} ({startError})
          </div>
        </main>
      </div>
    );
  }
  if (!user || !setup) return <div />;
  if (!setup.ready && !user.isAdministrator) {
    return (
      <div className="ctx-app">
        <main className="ctx-main">
          <div className="ctx-banner amber" role="status">
            {messages.notSetUp}
          </div>
        </main>
      </div>
    );
  }

  const context: AppContextValue = {
    service,
    reader: props.reader ?? null,
    user,
    navigate,
    toast,
    reportError,
    openInstructions,
    setRequestNav,
    refreshAdminCounts: () => {
      void refreshAdminCounts();
    }
  };
  // Until the lists are ready, an administrator is kept on Set-up (travel D-063).
  const route: Route = setup.ready ? location.route : { name: 'setup' };
  // The sidebar narrows on smaller screens, and on the Purchases step when the
  // grid needs the width, unless the employee has chosen otherwise (travel D-033).
  const onPurchases = route.name === 'request' && route.step === 'purchases';
  const collapsed = userCollapsed ?? (viewportWidth < NARROW_WIDTH || (onPurchases && viewportWidth < WIDE_LAYOUT_PX));
  const adminOnly =
    route.name === 'adminApprovals' ||
    route.name === 'adminProcess' ||
    route.name === 'adminAttention' ||
    route.name === 'adminAll' ||
    route.name === 'adminRequest' ||
    route.name === 'setup';

  let page: React.ReactNode;
  // Until the lists are ready, an administrator sees only the Set-up page.
  if (!setup.ready) page = <SetupPage onReady={onSetupReady} />;
  else if (adminOnly && !user.isAdministrator) page = <MyRequestsPage />;
  else if (route.name === 'request') page = <RequestWorkspace key={route.requestId} requestId={route.requestId} step={route.step} />;
  else if (route.name === 'adminApprovals') page = <ApprovalsPage />;
  else if (route.name === 'adminProcess') page = <RequestsToProcessPage />;
  else if (route.name === 'adminAttention') page = <NeedsAttentionPage />;
  else if (route.name === 'adminAll') page = <AllRequestsPage />;
  else if (route.name === 'adminRequest') page = <AdminRequestPage key={route.requestId} requestId={route.requestId} />;
  else if (route.name === 'setup') page = <SetupPage onReady={onSetupReady} />;
  else page = <MyRequestsPage />;

  return (
    <AppContext.Provider value={context}>
      <div className={`ctx-app ${collapsed ? 'ctx-collapsed' : ''}`}>
        <Sidebar
          user={user}
          route={route}
          collapsed={collapsed}
          onToggleCollapsed={() => {
            setUserCollapsed(!collapsed);
            writeCollapsed(!collapsed);
          }}
          navigate={navigate}
          requestNav={requestNav}
          adminCounts={adminCounts}
          adminListOpenedFrom={adminListOpenedFrom}
          logoUrl={props.logoUrl}
        />
        <main className="ctx-main">{page}</main>
        {instructionsOpen ? <InstructionsDrawer onClose={() => setInstructionsOpen(false)} /> : null}
        <Toasts toasts={toasts} />
      </div>
    </AppContext.Provider>
  );
}
