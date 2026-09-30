import * as React from 'react';
import { CurrentUser } from '../domain/types';
import { TravelDataService } from '../data/TravelDataService';
import { ReceiptReader } from '../reading/ReceiptReader';
import { ReportNav } from './components/Sidebar';
import { Route } from './routing';

export interface AppContextValue {
  service: TravelDataService;
  /** Reads receipts for suggestions (D-074); null where there is no reader, as in tests. */
  reader: ReceiptReader | null;
  user: CurrentUser;
  navigate: (route: Route) => void;
  toast: (text: string, tone?: 'info' | 'warning') => void;
  /** Shows a warning for a failed action or load. */
  reportError: (e: unknown) => void;
  openInstructions: () => void;
  setReportNav: (nav: ReportNav | null) => void;
  refreshAdminCounts: () => void;
}

export const AppContext = React.createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = React.useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppContext.');
  return value;
}
