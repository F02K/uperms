import { Conditions } from "./conditions.js";
import { type AuditEntry, type Condition, type Config, type Context, type Data, type Decision, type Effect, type Group, type Rule, type Subject, emptyData, isName, isNode, playerSubject, validateData } from "./model.js";
import { resolve } from "./resolver.js";
import type { Storage } from "./storage.js";

export interface RuleOptions { effect?: Effect; when?: Record<string, unknown>; expires?: number }
type Who = string | { steamId: string };

const subjectId = (who: Who): string => typeof who === "string" ? who : playerSubject(who.steamId);
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export class Permissions {
  private data: Data;
  private ready = false;
  private saving: Promise<void> = Promise.resolve();
  private readonly conditions = new Conditions();

  constructor(private readonly config: Config, private readonly storage: Storage, private readonly log: (m: string) => void = () => {}) {
    this.data = emptyData(config.defaultGroup);
  }

  /** Loads the stored data. Until loading succeeds, only the configured owners are authorized and modifications are rejected. */
  async start(retryMs = 15_000): Promise<void> {
    try {
      const loaded = await this.storage.load();
      if (loaded) { validateData(loaded); this.data = loaded; }
      if (!this.data.groups[this.config.defaultGroup]) this.data.groups[this.config.defaultGroup] = { name: this.config.defaultGroup, parents: [], rules: [] };
      this.ready = true;
      this.log(`loaded ${Object.keys(this.data.groups).length} groups, ${Object.keys(this.data.subjects).length} subjects`);
    } catch (e) {
      this.log(`load failed (${(e as Error).message}); owners only, writes disabled, retrying in ${retryMs / 1000}s`);
      const timer = setTimeout(() => { void this.start(retryMs); }, retryMs);
      timer.unref?.();
    }
  }

  isReady(): boolean { return this.ready; }
  isOwner(who: Who): boolean {
    const id = subjectId(who);
    return this.config.owners.some(steamId => playerSubject(steamId) === id);
  }

  registerCondition(name: string, fn: Condition): void { this.conditions.register(name, fn); }

  // Queries

  check(who: Who, node: string, ctx: Context = {}): Decision {
    if (!isNode(node)) return { allowed: false, reason: "invalid node" };
    if (this.isOwner(who)) return { allowed: true, reason: "owner" };
    if (!this.ready) return { allowed: false, reason: "not loaded" };
    return resolve(this.data, subjectId(who), node, ctx, this.conditions, this.config.defaultGroup);
  }
  can(who: Who, node: string, ctx: Context = {}): boolean { return this.check(who, node, ctx).allowed; }
  require(who: Who, node: string, ctx: Context = {}): void {
    if (!this.can(who, node, ctx)) throw new Error(`Missing permission: ${node}`);
  }

  // Read access

  getGroups(): Group[] { return clone(Object.values(this.data.groups)); }
  getSubject(who: Who): Subject { return clone(this.data.subjects[subjectId(who)] ?? { groups: [], rules: [] }); }
  getAudit(limit = 20): AuditEntry[] { return this.data.audit.slice(-limit); }

  // Modification

  grant(actor: string, who: Who, node: string, options: RuleOptions = {}): void {
    const rule = this.makeRule(node, options);
    const id = subjectId(who);
    this.mutate(actor, `${rule.effect} ${node} on ${id}`, d => {
      const s = (d.subjects[id] ??= { groups: [], rules: [] });
      s.rules = s.rules.filter(r => r.node !== node);
      s.rules.push(rule);
    });
  }

  revoke(actor: string, who: Who, node: string): boolean {
    const id = subjectId(who);
    if (!this.data.subjects[id]?.rules.some(r => r.node === node)) return false;
    this.mutate(actor, `revoke ${node} on ${id}`, d => {
      const s = d.subjects[id];
      if (s) s.rules = s.rules.filter(r => r.node !== node);
    });
    return true;
  }

  addToGroup(actor: string, who: Who, group: string, expires?: number): void {
    const id = subjectId(who);
    this.mutate(actor, `add ${id} to ${group}`, d => {
      if (!d.groups[group]) throw new Error(`Unknown group: ${group}`);
      const s = (d.subjects[id] ??= { groups: [], rules: [] });
      s.groups = s.groups.filter(m => m.group !== group);
      s.groups.push(expires ? { group, expires } : { group });
    });
  }

  removeFromGroup(actor: string, who: Who, group: string): boolean {
    const id = subjectId(who);
    if (!this.data.subjects[id]?.groups.some(m => m.group === group)) return false;
    this.mutate(actor, `remove ${id} from ${group}`, d => {
      const s = d.subjects[id];
      if (s) s.groups = s.groups.filter(m => m.group !== group);
    });
    return true;
  }

  createGroup(actor: string, name: string, parents: string[] = []): void {
    if (!isName(name)) throw new Error("Invalid group name.");
    this.mutate(actor, `create group ${name}`, d => {
      if (d.groups[name]) throw new Error(`Group exists: ${name}`);
      this.assertParents(d, name, parents);
      d.groups[name] = { name, parents, rules: [] };
    });
  }

  setParents(actor: string, name: string, parents: string[]): void {
    this.mutate(actor, `set parents of ${name}: ${parents.join(",") || "-"}`, d => {
      if (!d.groups[name]) throw new Error(`Unknown group: ${name}`);
      this.assertParents(d, name, parents);
      d.groups[name].parents = parents;
    });
  }

  deleteGroup(actor: string, name: string): void {
    if (name === this.config.defaultGroup) throw new Error("The default group cannot be deleted.");
    this.mutate(actor, `delete group ${name}`, d => {
      if (!d.groups[name]) throw new Error(`Unknown group: ${name}`);
      delete d.groups[name];
      for (const g of Object.values(d.groups)) g.parents = g.parents.filter(p => p !== name);
      for (const s of Object.values(d.subjects)) s.groups = s.groups.filter(m => m.group !== name);
    });
  }

  grantGroup(actor: string, group: string, node: string, options: RuleOptions = {}): void {
    const rule = this.makeRule(node, options);
    this.mutate(actor, `${rule.effect} ${node} on group ${group}`, d => {
      const g = d.groups[group];
      if (!g) throw new Error(`Unknown group: ${group}`);
      g.rules = g.rules.filter(r => r.node !== node);
      g.rules.push(rule);
    });
  }

  revokeGroup(actor: string, group: string, node: string): boolean {
    if (!this.data.groups[group]?.rules.some(r => r.node === node)) return false;
    this.mutate(actor, `revoke ${node} on group ${group}`, d => {
      const g = d.groups[group];
      if (g) g.rules = g.rules.filter(r => r.node !== node);
    });
    return true;
  }

  /** Resolves once all queued writes have completed. */
  flush(): Promise<void> { return this.saving; }

  /** Completes pending writes and releases storage connections. */
  async stop(): Promise<void> {
    await this.saving;
    await this.storage.close?.();
  }

  // Internals

  private makeRule(node: string, o: RuleOptions): Rule {
    if (!isNode(node)) throw new Error(`Invalid node: ${node}`);
    const rule: Rule = { node, effect: o.effect ?? "allow" };
    if (o.when) rule.when = o.when;
    if (o.expires) rule.expires = o.expires;
    return rule;
  }

  private assertParents(d: Data, name: string, parents: string[]): void {
    for (const p of parents) {
      if (!d.groups[p]) throw new Error(`Unknown group: ${p}`);
      for (const seen = new Set<string>(), stack = [p]; stack.length;) {
        const cur = stack.pop() as string;
        if (cur === name) throw new Error("That would make the group inherit from itself.");
        if (seen.has(cur)) continue;
        seen.add(cur);
        stack.push(...(d.groups[cur]?.parents ?? []));
      }
    }
  }

  /** Applies a change to a copy of the state, validates it, then activates it and queues a write. */
  private mutate(actor: string, action: string, change: (d: Data) => void): void {
    if (!this.ready) throw new Error("Permissions are not loaded yet; changes are disabled.");
    const next = clone(this.data);
    change(next);
    next.audit.push({ at: new Date().toISOString(), actor, action });
    next.audit = next.audit.slice(-500);
    validateData(next);
    this.data = next;
    this.saving = this.saving
      .then(() => this.storage.save(this.data))
      .catch(e => this.log(`save failed: ${(e as Error).message}; the next change retries with the full state`));
  }
}
