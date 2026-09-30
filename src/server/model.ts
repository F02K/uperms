export type Effect = "allow" | "deny";

/** A permission rule. `when` maps condition names to arguments; all entries must pass. */
export interface Rule {
  node: string;
  effect: Effect;
  when?: Record<string, unknown>;
  /** Expiry as a Unix timestamp in ms. The rule no longer applies after this time. */
  expires?: number;
}

export interface Membership { group: string; expires?: number }

export interface Group {
  name: string;
  parents: string[];
  rules: Rule[];
}

/** An entity that can hold permissions: `player:<steamId>` or a free-form identifier such as `faction:guards`. */
export interface Subject {
  groups: Membership[];
  rules: Rule[];
}

export interface AuditEntry { at: string; actor: string; action: string }

export interface Data {
  version: 1;
  groups: Record<string, Group>;
  subjects: Record<string, Subject>;
  audit: AuditEntry[];
}

export interface Config {
  owners: string[];
  storage: "json" | "mysql";
  defaultGroup: string;
  commandPrefix: string;
  mysql: { table: string; connectionLimit: number; slowQueryWarningMs: number; debug: boolean };
}

export type Context = Record<string, unknown>;
export type Condition = (arg: unknown, ctx: Context, subject: string) => boolean;

export interface Decision { allowed: boolean; reason: string }

export const OWNER_SUBJECT_PREFIX = "player:";
export const playerSubject = (steamId: string): string => `${OWNER_SUBJECT_PREFIX}${steamId}`;

export function emptyData(defaultGroup: string): Data {
  return { version: 1, groups: { [defaultGroup]: { name: defaultGroup, parents: [], rules: [] } }, subjects: {}, audit: [] };
}

const NODE = /^(\*|[a-z0-9_-]+(\.[a-z0-9_-]+)*(\.\*)?)$/i;
const NAME = /^[a-z0-9_:-]{1,64}$/i;
export const isNode = (v: unknown): v is string => typeof v === "string" && v.length <= 128 && NODE.test(v);
export const isName = (v: unknown): v is string => typeof v === "string" && NAME.test(v);

export function validateData(data: Data): void {
  if (!data || data.version !== 1 || typeof data.groups !== "object" || typeof data.subjects !== "object" || !Array.isArray(data.audit)) {
    throw new Error("uperms: data file is corrupt");
  }
  for (const [name, g] of Object.entries(data.groups)) {
    if (!isName(name) || g.name !== name) throw new Error(`uperms: invalid group ${name}`);
    for (const r of g.rules) if (!isNode(r.node) || (r.effect !== "allow" && r.effect !== "deny")) throw new Error(`uperms: invalid rule in group ${name}`);
  }
  for (const [id, s] of Object.entries(data.subjects)) {
    for (const r of s.rules) if (!isNode(r.node) || (r.effect !== "allow" && r.effect !== "deny")) throw new Error(`uperms: invalid rule on ${id}`);
  }
}
