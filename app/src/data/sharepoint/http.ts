// A small wrapper around SharePoint's REST interface. The web part supplies
// the actual request function (SPFx's SPHttpClient, which signs requests as
// the signed-in user); tests supply a fake. Nothing else in the app builds
// SharePoint requests.

import { messages } from '../../domain/messages';

export interface SpResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
  blob(): Promise<Blob>;
}

export interface SpRequestInit {
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string | Blob | ArrayBuffer;
}

export type SpFetch = (url: string, init: SpRequestInit) => Promise<SpResponse>;

/** A failed SharePoint request, with a plain-language message (D-060). */
export class SharePointRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** SharePoint's own error text, for troubleshooting. */
    public readonly detail = ''
  ) {
    super(message);
  }
}

export function messageForStatus(status: number): string {
  if (status === 0) return messages.spOffline;
  if (status === 401 || status === 403) return messages.spForbidden;
  if (status === 404) return messages.spNotFound;
  if (status === 409 || status === 412) return messages.spConflict;
  if (status === 429 || status === 503) return messages.spBusy;
  return messages.spOther(status);
}

/** Makes a value safe inside an OData string literal in a URL. */
export function odataString(value: string): string {
  return encodeURIComponent(value.replace(/'/g, "''"));
}

const JSON_TYPE = 'application/json;odata=nometadata';
const MAX_ATTEMPTS = 4;

export class SpClient {
  constructor(
    private readonly fetcher: SpFetch,
    /** The travel site's full address, without a trailing slash. */
    public readonly webUrl: string,
    /** The travel site's path, for example /sites/Travel. */
    public readonly webServerRelativeUrl: string,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  ) {}

  /** A client for another site in the same tenant, signed in as the same user. */
  forSite(webUrl: string): SpClient {
    const url = webUrl.replace(/\/$/, '');
    return new SpClient(this.fetcher, url, new URL(url).pathname || '/', this.sleep);
  }

  /** The server-relative address of a list: /sites/Travel/Lists/TravelReports. */
  listUrl(urlName: string): string {
    const base = this.webServerRelativeUrl === '/' ? '' : this.webServerRelativeUrl.replace(/\/$/, '');
    return `${base}/Lists/${urlName}`;
  }

  /** The REST path of a list, found by its address so a renamed title does not matter. */
  listPath(urlName: string): string {
    return `web/GetList('${odataString(this.listUrl(urlName))}')`;
  }

  async getJson<T>(path: string): Promise<T> {
    const response = await this.send(path, { method: 'GET', headers: { Accept: JSON_TYPE } });
    return (await response.json()) as T;
  }

  /** Reads every page of a collection (SharePoint returns up to 5,000 items per page). */
  async getAll<T>(path: string): Promise<T[]> {
    const items: T[] = [];
    let next: string | undefined = path;
    while (next) {
      const page: { value: T[]; 'odata.nextLink'?: string; '@odata.nextLink'?: string } = await this.getJson(next);
      items.push(...page.value);
      next = page['odata.nextLink'] ?? page['@odata.nextLink'];
    }
    return items;
  }

  async post<T>(path: string, body?: unknown): Promise<T | undefined> {
    const response = await this.send(path, {
      method: 'POST',
      headers: { Accept: JSON_TYPE, 'Content-Type': JSON_TYPE },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    return text ? (JSON.parse(text) as T) : undefined;
  }

  async merge(path: string, body: unknown): Promise<void> {
    await this.send(path, {
      method: 'POST',
      headers: { Accept: JSON_TYPE, 'Content-Type': JSON_TYPE, 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' },
      body: JSON.stringify(body)
    });
  }

  /**
   * A MERGE in SharePoint's older "verbose" format, which names the item type.
   * Needed where the type cannot be inferred, such as a choice column's choices.
   */
  async mergeVerbose(path: string, body: unknown): Promise<void> {
    await this.send(path, {
      method: 'POST',
      headers: { Accept: JSON_TYPE, 'Content-Type': 'application/json;odata=verbose', 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' },
      body: JSON.stringify(body)
    });
  }

  async remove(path: string): Promise<void> {
    await this.send(path, { method: 'POST', headers: { Accept: JSON_TYPE, 'X-HTTP-Method': 'DELETE', 'IF-MATCH': '*' } });
  }

  async postBinary(path: string, body: Blob | ArrayBuffer): Promise<void> {
    await this.send(path, { method: 'POST', headers: { Accept: JSON_TYPE }, body });
  }

  async getBlob(path: string): Promise<Blob> {
    return (await this.send(path, { method: 'GET', headers: {} })).blob();
  }

  async getText(path: string): Promise<string> {
    return (await this.send(path, { method: 'GET', headers: {} })).text();
  }

  /** Sends a request; waits and tries again while SharePoint says it is busy. */
  private async send(path: string, request: SpRequestInit): Promise<SpResponse> {
    const url = path.startsWith('http') ? path : `${this.webUrl}/_api/${path}`;
    // The JSON formats used here are OData version 3; SPFx would otherwise ask for 4.
    const init: SpRequestInit = { ...request, headers: { 'OData-Version': '3.0', ...request.headers } };
    for (let attempt = 1; ; attempt++) {
      let response: SpResponse;
      try {
        response = await this.fetcher(url, init);
      } catch (e) {
        throw new SharePointRequestError(0, messages.spOffline, e instanceof Error ? e.message : String(e));
      }
      if (response.ok) return response;
      const busy = response.status === 429 || response.status === 503;
      if (busy && attempt < MAX_ATTEMPTS) {
        const seconds = Number(response.headers.get('Retry-After'));
        await this.sleep(Math.min(Number.isFinite(seconds) && seconds > 0 ? seconds : 2 * attempt, 10) * 1000);
        continue;
      }
      let detail = '';
      try {
        detail = await response.text();
      } catch {
        // No detail available.
      }
      throw new SharePointRequestError(response.status, messageForStatus(response.status), detail);
    }
  }
}
