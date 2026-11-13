// Pages are addressed by the part of the web address after "#", so a link or
// a refresh opens the same page. The flow's emails link to the administrator
// addresses below (#/admin/request/<id>, #/admin/approvals), so they must not
// change without changing the flow.

import * as React from 'react';

export type RequestStep = 'details' | 'purchases' | 'review';

export type Route =
  | { name: 'home' }
  | { name: 'request'; requestId: number; step: RequestStep }
  | { name: 'adminApprovals' }
  | { name: 'adminProcess' }
  | { name: 'adminAttention' }
  | { name: 'adminAll' }
  | { name: 'adminRequest'; requestId: number }
  | { name: 'setup' };

export interface Location {
  route: Route;
  /** Optional panel to open, for example "#/request/41/purchases?panel=instructions". */
  panel: string;
}

/** A request number in an address: digits only, so "41" but not "41x", "", "-1" or "4.1". */
function requestId(part: string | undefined): number | null {
  return part !== undefined && /^\d+$/.test(part) ? Number(part) : null;
}

export function parseHash(hash: string): Location {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter((p) => p.length > 0);
  const panel = new URLSearchParams(query).get('panel') ?? '';
  let route: Route = { name: 'home' };
  if (parts[0] === 'request' && requestId(parts[1]) !== null) {
    const step = parts[2] === 'purchases' || parts[2] === 'review' ? parts[2] : 'details';
    route = { name: 'request', requestId: Number(parts[1]), step };
  } else if (parts[0] === 'admin') {
    if (parts[1] === 'approvals') route = { name: 'adminApprovals' };
    else if (parts[1] === 'process') route = { name: 'adminProcess' };
    else if (parts[1] === 'attention') route = { name: 'adminAttention' };
    else if (parts[1] === 'all') route = { name: 'adminAll' };
    else if (parts[1] === 'setup') route = { name: 'setup' };
    else if (parts[1] === 'request' && requestId(parts[2]) !== null) route = { name: 'adminRequest', requestId: Number(parts[2]) };
  }
  return { route, panel };
}

export function toHash(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'request':
      return `#/request/${route.requestId}/${route.step}`;
    case 'adminApprovals':
      return '#/admin/approvals';
    case 'adminProcess':
      return '#/admin/process';
    case 'adminAttention':
      return '#/admin/attention';
    case 'adminAll':
      return '#/admin/all';
    case 'adminRequest':
      return `#/admin/request/${route.requestId}`;
    case 'setup':
      return '#/admin/setup';
  }
}

export function useLocation(): [Location, (route: Route) => void] {
  const [location, setLocation] = React.useState<Location>(() => parseHash(window.location.hash));
  React.useEffect(() => {
    const onChange = () => setLocation(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const navigate = React.useCallback((route: Route) => {
    window.location.hash = toHash(route);
  }, []);
  return [location, navigate];
}
