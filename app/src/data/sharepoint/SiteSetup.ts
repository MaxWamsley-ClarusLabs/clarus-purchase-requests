// Creates and checks the three lists on the travel site (D-063). Run by an
// administrator from the Set-up page; safe to run again at any time: it only
// adds what is missing and never deletes a list, a column or an item. It
// never changes a list it did not create (D-077).

import { APP_LIST_MARKER, FieldDef, LISTS, ListDef, fieldXml } from './schema';
import { SharePointRequestError, SpClient, odataString } from './http';
import { ListCheck, SetupStatus, isReady } from '../setup';

/** SharePoint's list settings for item-level permissions: own items only. */
export const OWN_ITEMS_ONLY = 2;
const GENERIC_LIST_TEMPLATE = 100;
/** Add to the default content type, use the given internal name, add to the default view. */
const ADD_FIELD_OPTIONS = 1 | 8 | 16;

interface ListInfo {
  Id: string;
  Description?: string;
  EnableVersioning: boolean;
  EnableAttachments: boolean;
  ReadSecurity: number;
  WriteSecurity: number;
}

interface FieldInfo {
  InternalName: string;
  Indexed: boolean;
  Choices?: string[];
}

export class SiteSetup {
  constructor(private readonly sp: SpClient) {}

  async check(): Promise<SetupStatus> {
    const lists: ListCheck[] = [];
    for (const def of Object.values(LISTS)) lists.push(await this.checkList(def));
    return { ready: isReady(lists), lists };
  }

  /** Creates or completes every list, reporting each step. Returns the final check. */
  async run(progress: (step: string) => void = () => undefined): Promise<SetupStatus> {
    for (const def of Object.values(LISTS)) {
      let check = await this.checkList(def);
      const path = this.sp.listPath(def.urlName);
      if (check.notOurs) {
        progress(`Left ${check.address} unchanged: that list was not made by this app`);
        continue;
      }
      if (!check.exists) {
        progress(`Creating the ${def.title} list`);
        await this.sp.post('web/lists', { Title: def.urlName, BaseTemplate: GENERIC_LIST_TEMPLATE, Description: def.description });
        await this.sp.merge(path, { Title: def.title });
        await this.sp.merge(`${path}/fields/getbyinternalnameortitle('Title')`, { Title: def.titleDisplayName, Required: false });
        check = await this.checkList(def);
      }
      if (!check.ownItemsOnly || !check.versioning || !check.attachments) {
        progress(`Setting permissions and version history on ${def.title}`);
        await this.sp.merge(path, { EnableVersioning: true, EnableAttachments: true, ReadSecurity: OWN_ITEMS_ONLY, WriteSecurity: OWN_ITEMS_ONLY });
      }
      for (const name of check.missingFields) {
        const field = def.fields.find((f) => f.name === name) as FieldDef;
        progress(`Adding the ${field.displayName} column to ${def.title}`);
        await this.sp.post(`${path}/fields/CreateFieldAsXml`, { parameters: { SchemaXml: fieldXml(field), Options: ADD_FIELD_OPTIONS } });
      }
      if (check.missingChoices.length > 0) await this.addChoices(def);
      const recheck = await this.checkList(def);
      for (const name of recheck.unindexedFields) {
        progress(`Indexing ${name} on ${def.title}`);
        await this.sp.merge(`${path}/fields/getbyinternalnameortitle('${odataString(name)}')`, { Indexed: true });
      }
    }
    return this.check();
  }

  /** Adds choices that a newer version of the app uses (never removes any). */
  private async addChoices(def: ListDef): Promise<void> {
    const fields = await this.readFields(def);
    for (const field of def.fields.filter((f) => f.type === 'Choice')) {
      const current = fields.find((f) => f.InternalName === field.name);
      if (!current) continue;
      const existing = current.Choices ?? [];
      const wanted = field.choices ?? [];
      if (wanted.every((c) => existing.includes(c))) continue;
      const merged = [...existing, ...wanted.filter((c) => !existing.includes(c))];
      await this.sp.mergeVerbose(`${this.sp.listPath(def.urlName)}/fields/getbyinternalnameortitle('${odataString(field.name)}')`, {
        __metadata: { type: 'SP.FieldChoice' },
        Choices: { __metadata: { type: 'Collection(Edm.String)' }, results: merged }
      });
    }
  }

  private async readFields(def: ListDef): Promise<FieldInfo[]> {
    return this.sp.getAll<FieldInfo>(`${this.sp.listPath(def.urlName)}/fields?$select=InternalName,Indexed,Choices`);
  }

  private async checkList(def: ListDef): Promise<ListCheck> {
    const address = `Lists/${def.urlName}`;
    const empty: ListCheck = {
      key: def.key,
      title: def.title,
      exists: false,
      address,
      notOurs: false,
      listId: '',
      missingFields: def.fields.map((f) => f.name),
      missingChoices: [],
      unindexedFields: [],
      ownItemsOnly: false,
      versioning: false,
      attachments: false
    };
    let info: ListInfo;
    try {
      info = await this.sp.getJson<ListInfo>(
        `${this.sp.listPath(def.urlName)}?$select=Id,Description,EnableVersioning,EnableAttachments,ReadSecurity,WriteSecurity`
      );
    } catch (e) {
      if (e instanceof SharePointRequestError && e.status === 404) return empty;
      throw e;
    }
    const fields = await this.readFields(def);
    const byName = new Map(fields.map((f) => [f.InternalName, f]));
    const ours = (info.Description ?? '').startsWith(APP_LIST_MARKER) || def.identityFields.every((n) => byName.has(n));
    const missingChoices: string[] = [];
    for (const f of def.fields.filter((x) => x.type === 'Choice')) {
      const current = byName.get(f.name);
      if (current) for (const c of f.choices ?? []) if (!(current.Choices ?? []).includes(c)) missingChoices.push(`${f.displayName}: ${c}`);
    }
    const indexNames = [...def.fields.filter((f) => f.indexed).map((f) => f.name), ...(def.indexBuiltIn ?? [])];
    return {
      key: def.key,
      title: def.title,
      exists: true,
      address,
      notOurs: !ours,
      listId: info.Id,
      missingFields: def.fields.filter((f) => !byName.has(f.name)).map((f) => f.name),
      missingChoices,
      unindexedFields: indexNames.filter((n) => byName.has(n) && !byName.get(n)!.Indexed),
      ownItemsOnly: info.ReadSecurity === OWN_ITEMS_ONLY && info.WriteSecurity === OWN_ITEMS_ONLY,
      versioning: info.EnableVersioning,
      attachments: info.EnableAttachments
    };
  }
}
