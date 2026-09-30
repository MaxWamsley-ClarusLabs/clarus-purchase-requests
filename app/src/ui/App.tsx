import * as React from 'react';
import { CurrentUser } from '../domain/types';
import { TravelDataService } from '../data/TravelDataService';
import { AppContext, AppContextValue } from './AppContext';
import { InstructionsDrawer } from './components/InstructionsDrawer';
import { ReportNav, Sidebar } from './components/Sidebar';
import { Toast, Toasts } from './components/common';
import { MyReportsPage } from './pages/MyReportsPage';
import { ReportWorkspace, WIDE_LAYOUT_PX } from './pages/ReportWorkspace';
import { AdminReportPage } from './pages/admin/AdminReportPage';
import { AllReportsPage } from './pages/admin/AllReportsPage';
import { SetupPage } from './pages/admin/SetupPage';
import { SetupStatus } from '../data/setup';
import { NeedsAttentionPage } from './pages/admin/NeedsAttentionPage';
import { ReportsToProcessPage } from './pages/admin/ReportsToProcessPage';
import { latestByReport, needsAttention, reportsToProcess } from './pages/admin/adminData';
import { Route, useLocation } from './routing';
import { injectTheme } from './theme';
import { errorText } from './errors';
import { messages } from '../domain/messages';
import { ReceiptReader } from '../reading/ReceiptReader';

const COLLAPSE_KEY = 'ctx-sidebar-collapsed';
const NARROW_WIDTH = 1280;

// The sidebar choice is remembered on this computer only (D-033). Storage can be
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

export function App(props: { service: TravelDataService; logoUrl: string; reader?: ReceiptReader | null }): React.ReactElement {
  const { service } = props;
  const [user, setUser] = React.useState<CurrentUser | null>(null);
  const [startError, setStartError] = React.useState('');
  const [setup, setSetup] = React.useState<SetupStatus | null>(null);
  const [location, navigate] = useLocation();
  const [userCollapsed, setUserCollapsed] = React.useState<boolean | null>(readCollapsed);
  const [viewportWidth, setViewportWidth] = React.useState(() => window.innerWidth);
  const [instructionsOpen, setInstructionsOpen] = React.useState(location.panel === 'instructions');
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [reportNav, setReportNav] = React.useState<ReportNav | null>(null);
  const [adminCounts, setAdminCounts] = React.useState({ process: 0, attention: 0 });
  const toastId = React.useRef(0);

  React.useEffect(() => {
    injectTheme();
    // Who is signed in, and whether this site's lists are ready (D-063).
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

  // Background refresh of the sidebar counts. A failure leaves the last counts
  // in place; the administrator pages show their own errors.
  const refreshAdminCounts = React.useCallback(async (): Promise<void> => {
    if (!user || !user.isAdministrator || !setup || !setup.ready) return;
    try {
      const [reports, submissions] = await Promise.all([service.listAllReports(), service.listSubmissions()]);
      const latest = Array.from(latestByReport(submissions).values());
      setAdminCounts({ process: reportsToProcess(reports).length, attention: latest.filter((s) => needsAttention(s)).length });
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

  const reportError = React.useCallback((e: unknown) => toast(messages.actionFailed(errorText(e)), 'warning'), [toast]);

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
    setReportNav,
    refreshAdminCounts: () => {
      void refreshAdminCounts();
    }
  };
  // Until the lists are ready, an administrator is kept on Set-up (D-063).
  const route: Route = setup.ready ? location.route : { name: 'setup' };
  // The sidebar narrows on smaller screens, and on the Expenses step when the
  // grid needs the width, unless the employee has chosen otherwise (D-033).
  const onExpenses = route.name === 'report' && route.step === 'expenses';
  const collapsed = userCollapsed ?? (viewportWidth < NARROW_WIDTH || (onExpenses && viewportWidth < WIDE_LAYOUT_PX));
  const adminOnly =
    route.name === 'adminProcess' || route.name === 'adminAttention' || route.name === 'adminAll' || route.name === 'adminReport' || route.name === 'setup';

  let page: React.ReactNode;
  // Until the lists are ready, an administrator sees only the Set-up page.
  if (!setup.ready) page = <SetupPage onReady={onSetupReady} />;
  else if (adminOnly && !user.isAdministrator) page = <MyReportsPage />;
  else if (route.name === 'report') page = <ReportWorkspace key={route.reportId} reportId={route.reportId} step={route.step} />;
  else if (route.name === 'adminProcess') page = <ReportsToProcessPage />;
  else if (route.name === 'adminAttention') page = <NeedsAttentionPage />;
  else if (route.name === 'adminAll') page = <AllReportsPage />;
  else if (route.name === 'adminReport') page = <AdminReportPage key={route.reportId} reportId={route.reportId} />;
  else if (route.name === 'setup') page = <SetupPage onReady={onSetupReady} />;
  else page = <MyReportsPage />;

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
          reportNav={reportNav}
          adminCounts={adminCounts}
          logoUrl={props.logoUrl}
        />
        <main className="ctx-main">{page}</main>
        {instructionsOpen ? <InstructionsDrawer onClose={() => setInstructionsOpen(false)} /> : null}
        <Toasts toasts={toasts} />
      </div>
    </AppContext.Provider>
  );
}
