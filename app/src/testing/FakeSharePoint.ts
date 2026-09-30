// An in-memory stand-in for the parts of SharePoint's REST interface the app
// uses, for unit tests only. It follows SharePoint's behaviour where the app
// depends on it: lists found by address, item-level permissions ("own items
// only" hides other people's items), attachments, recycle, and busy replies.
// It is not SharePoint: the real behaviour is confirmed on the test site at
// Stage 8.

import { SpFetch, SpRequestInit, SpResponse } from '../data/sharepoint/http';

export interface FakeUser {
  id: number;
  title: string;
  email: string;
  admin: boolean;
}

interface FakeField {
  InternalName: string;
  Title: string;
  Indexed: boolean;
  Required: boolean;
  Choices?: string[];
}

interface FakeAttachment {
  name: string;
  content: Blob;
}

interface FakeItem {
  fields: Record<string, unknown>;
  attachments: FakeAttachment[];
}

interface FakeList {
  id: string;
  urlName: string;
  info: Record<string, unknown>;
  fields: FakeField[];
  items: Map<number, FakeItem>;
  nextId: number;
}

export interface RequestRecord {
  user: string;
  method: string;
  url: string;
}

const BUILT_IN_FIELDS = ['Title', 'Author', 'Editor', 'Created', 'Modified', 'ID', 'Attachments'];

function response(status: number, body?: unknown, headers: Record<string, string> = {}): SpResponse {
  const text = body === undefined ? '' : body instanceof Blob ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name] ?? null },
    json: async () => JSON.parse(text),
    text: async () => (body instanceof Blob ? body.text() : text),
    blob: async () => (body instanceof Blob ? body : new Blob([text]))
  };
}

const notFound = () => response(404, { 'odata.error': { message: { value: 'Item does not exist.' } } });

export class FakeSharePoint {
  readonly lists = new Map<string, FakeList>();
  readonly log: RequestRecord[] = [];
  /** Answer this many requests with "busy" (429) before serving them. */
  busyReplies = 0;
  /** Makes list settings like ReadSecurity refuse to change, as a tenant might. */
  refuseItemLevelPermissions = false;
  /** Document libraries and folders that exist, by server-relative address, on any site. */
  readonly libraries = new Set<string>(['/sites/Travel/Shared Documents']);
  readonly folders = new Set<string>();
  private clock = Date.UTC(2026, 9, 1, 12, 0, 0);
  private listCounter = 0;

  constructor(
    readonly webUrl = 'https://contoso.sharepoint.com/sites/Travel',
    readonly webPath = '/sites/Travel'
  ) {}

  /** The request function SharePoint would give the app, signed in as `user`. */
  fetchAs(user: FakeUser): SpFetch {
    return async (url: string, init: SpRequestInit) => {
      const method = init.headers['X-HTTP-Method'] ?? init.method;
      this.log.push({ user: user.email, method, url });
      if (this.busyReplies > 0) {
        this.busyReplies--;
        return response(429, undefined, { 'Retry-After': '1' });
      }
      const at = url.indexOf('/_api/');
      if (at < 0) return response(400, 'Unexpected address');
      const path = decodeURIComponent(url.slice(at + '/_api/'.length));
      const libraryOrFolder = this.handleLibraries(path);
      if (libraryOrFolder) return libraryOrFolder;
      if (url.slice(0, at) !== this.webUrl) return notFound();
      return this.handle(user, method, path, init.body);
    };
  }

  /** A list made by something else (another form on a shared site), for tests. */
  addOtherList(urlName: string, fieldNames: string[] = []): FakeList {
    this.listCounter++;
    const list: FakeList = {
      id: `list-${this.listCounter}`,
      urlName,
      info: { Title: urlName, Description: 'Another app', EnableVersioning: false, EnableAttachments: true, ReadSecurity: 1, WriteSecurity: 1 },
      fields: [...BUILT_IN_FIELDS, ...fieldNames].map((n) => ({ InternalName: n, Title: n, Indexed: false, Required: n === 'Title' })),
      items: new Map(),
      nextId: 1
    };
    this.lists.set(list.id, list);
    return list;
  }

  listByUrlName(urlName: string): FakeList | undefined {
    return [...this.lists.values()].find((l) => l.urlName === urlName);
  }

  private now(): string {
    this.clock += 60000;
    return new Date(this.clock).toISOString();
  }

  private async handle(user: FakeUser, method: string, path: string, body: SpRequestInit['body']): Promise<SpResponse> {
    const [route, query = ''] = splitQuery(path);
    const params = new Map(
      query
        .split('&')
        .filter(Boolean)
        .map((p) => [p.slice(0, p.indexOf('=')), p.slice(p.indexOf('=') + 1)] as [string, string])
    );

    if (route === 'web/currentuser') return response(200, { Id: user.id, Title: user.title, Email: user.email });
    if (route === 'web/effectiveBasePermissions')
      return response(200, user.admin ? { High: '2147483647', Low: '4294967295' } : { High: '432', Low: '1011028719' });
    if (route === 'web/lists' && method === 'POST') {
      if (!user.admin) return response(403);
      const data = JSON.parse(String(body));
      this.listCounter++;
      const list: FakeList = {
        id: `list-${this.listCounter}`,
        urlName: data.Title,
        info: { Title: data.Title, Description: data.Description ?? '', EnableVersioning: false, EnableAttachments: true, ReadSecurity: 1, WriteSecurity: 1 },
        fields: BUILT_IN_FIELDS.map((n) => ({ InternalName: n, Title: n, Indexed: false, Required: n === 'Title' })),
        items: new Map(),
        nextId: 1
      };
      this.lists.set(list.id, list);
      return response(201, { Id: list.id });
    }

    const listMatch = /^web\/GetList\('(.+?)'\)(.*)$/.exec(route);
    if (!listMatch) return response(400, `Unknown route ${route}`);
    const serverUrl = listMatch[1].replace(/''/g, "'");
    const urlName = serverUrl.slice(`${this.webPath}/Lists/`.length);
    const list = this.listByUrlName(urlName);
    if (!list || !serverUrl.startsWith(`${this.webPath}/Lists/`)) return notFound();
    const rest = listMatch[2];

    if (rest === '') {
      if (method === 'GET') return response(200, { Id: list.id, ...list.info });
      if (method === 'MERGE') {
        if (!user.admin) return response(403);
        const data = JSON.parse(String(body));
        if (this.refuseItemLevelPermissions) {
          delete data.ReadSecurity;
          delete data.WriteSecurity;
        }
        Object.assign(list.info, data);
        return response(204);
      }
    }
    if (rest === '/fields' && method === 'GET') return response(200, { value: list.fields.map((f) => ({ ...f })) });
    if (rest === '/fields/CreateFieldAsXml' && method === 'POST') {
      if (!user.admin) return response(403);
      const xml: string = JSON.parse(String(body)).parameters.SchemaXml;
      const name = /\sName="([^"]+)"/.exec(xml)![1];
      if (list.fields.some((f) => f.InternalName === name)) return response(400, 'Duplicate field');
      const choices: string[] = [];
      const choicePattern = /<CHOICE>(.*?)<\/CHOICE>/g;
      for (let m = choicePattern.exec(xml); m; m = choicePattern.exec(xml)) choices.push(m[1].replace(/&amp;/g, '&'));
      list.fields.push({
        InternalName: name,
        Title: name,
        Indexed: /Indexed="TRUE"/.test(xml),
        Required: false,
        Choices: choices.length ? choices : undefined
      });
      return response(201, { InternalName: name });
    }
    const fieldMatch = /^\/fields\/getbyinternalnameortitle\('(.+?)'\)$/.exec(rest);
    if (fieldMatch && method === 'MERGE') {
      if (!user.admin) return response(403);
      const field = list.fields.find((f) => f.InternalName === fieldMatch[1]);
      if (!field) return notFound();
      const data = JSON.parse(String(body));
      if (data.Choices) field.Choices = data.Choices.results ?? data.Choices;
      if (data.Indexed !== undefined) field.Indexed = data.Indexed;
      if (data.Title !== undefined) field.Title = data.Title;
      if (data.Required !== undefined) field.Required = data.Required;
      return response(204);
    }

    if (rest === '/items') {
      if (method === 'GET') {
        let items = [...list.items.entries()].filter(([, item]) => this.canRead(user, list, item));
        const filter = params.get('$filter');
        if (filter) items = items.filter(([, item]) => matchesFilter(filter, item.fields));
        const orderBy = params.get('$orderby');
        if (orderBy) items.sort(([, a], [, b]) => Number(a.fields[orderBy]) - Number(b.fields[orderBy]));
        return response(200, { value: items.map(([id, item]) => this.present(list, id, item, params)) });
      }
      if (method === 'POST') {
        const id = list.nextId++;
        const stamp = this.now();
        const fields: Record<string, unknown> = {
          ...defaults(list),
          ...JSON.parse(String(body)),
          Id: id,
          AuthorId: user.id,
          Author: { Id: user.id, Title: user.title, EMail: user.email }
        };
        fields.Created = stamp;
        fields.Modified = stamp;
        list.items.set(id, { fields, attachments: [] });
        return response(201, { Id: id });
      }
    }

    const itemMatch = /^\/items\((\d+)\)(.*)$/.exec(rest);
    if (itemMatch) {
      const id = Number(itemMatch[1]);
      const item = list.items.get(id);
      if (!item || !this.canRead(user, list, item)) return notFound();
      const sub = itemMatch[2];
      const canWrite = this.canWrite(user, list, item);
      if (sub === '' && method === 'GET') return response(200, this.present(list, id, item, params));
      if (sub === '' && method === 'MERGE') {
        if (!canWrite) return response(403);
        const data = JSON.parse(String(body));
        if (data.ProcessedById !== undefined) {
          data.ProcessedBy = { Id: data.ProcessedById, Title: user.title, EMail: user.email };
        }
        Object.assign(item.fields, data, { Modified: this.now() });
        return response(204);
      }
      if (sub === '/recycle()' && method === 'POST') {
        if (!canWrite) return response(403);
        list.items.delete(id);
        return response(200, { value: 'recycled' });
      }
      const add = /^\/AttachmentFiles\/add\(FileName='(.+)'\)$/.exec(sub);
      if (add && method === 'POST') {
        if (!canWrite) return response(403);
        const name = add[1].replace(/''/g, "'");
        if (item.attachments.some((a) => a.name.toLowerCase() === name.toLowerCase())) return response(409);
        const content = body instanceof Blob ? body : new Blob([body as ArrayBuffer | string]);
        item.attachments.push({ name, content });
        return response(200, { FileName: name });
      }
      const file = /^\/AttachmentFiles\('(.+)'\)(\/\$value)?$/.exec(sub);
      if (file) {
        const name = file[1].replace(/''/g, "'");
        const found = item.attachments.find((a) => a.name === name);
        if (!found) return notFound();
        if (method === 'GET' && file[2]) return response(200, found.content);
        if (method === 'DELETE') {
          if (!canWrite) return response(403);
          item.attachments = item.attachments.filter((a) => a !== found);
          return response(200);
        }
      }
    }
    return response(400, `Unhandled ${method} ${path}`);
  }

  /** Read-only answers about libraries and folders, on this or another site. */
  private handleLibraries(path: string): SpResponse | undefined {
    const [route] = splitQuery(path);
    const list = /^web\/GetList\('(.+?)'\)$/.exec(route);
    if (list && !list[1].includes('/Lists/')) {
      const address = list[1].replace(/''/g, "'");
      return this.libraries.has(address) ? response(200, { Id: `library:${address}` }) : notFound();
    }
    const folder = /^web\/GetFolderByServerRelativeUrl\('(.+?)'\)\/Exists$/.exec(route);
    if (folder) return response(200, { value: this.folders.has(folder[1].replace(/''/g, "'")) });
    return undefined;
  }

  private canRead(user: FakeUser, list: FakeList, item: FakeItem): boolean {
    return user.admin || list.info.ReadSecurity !== 2 || item.fields.AuthorId === user.id;
  }

  private canWrite(user: FakeUser, list: FakeList, item: FakeItem): boolean {
    return user.admin || list.info.WriteSecurity !== 2 || item.fields.AuthorId === user.id;
  }

  private present(list: FakeList, id: number, item: FakeItem, params: Map<string, string>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...item.fields, Id: id };
    if ((params.get('$expand') ?? '').includes('AttachmentFiles')) {
      out.AttachmentFiles = item.attachments.map((a) => ({
        FileName: a.name,
        ServerRelativeUrl: `${this.webPath}/Lists/${list.urlName}/Attachments/${id}/${a.name}`
      }));
    }
    return out;
  }
}

function splitQuery(path: string): [string, string] {
  const i = path.indexOf('?');
  return i < 0 ? [path, ''] : [path.slice(0, i), path.slice(i + 1)];
}

/** Supports the filters the app uses: "Field eq 12", joined by "and". */
function matchesFilter(filter: string, fields: Record<string, unknown>): boolean {
  return filter.split(' and ').every((part) => {
    const m = /^(\w+) eq (\d+)$/.exec(part.trim());
    if (!m) throw new Error(`Unsupported filter: ${part}`);
    return Number(fields[m[1]]) === Number(m[2]);
  });
}

function defaults(list: FakeList): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of list.fields) if (!BUILT_IN_FIELDS.includes(f.InternalName)) out[f.InternalName] = null;
  return out;
}
