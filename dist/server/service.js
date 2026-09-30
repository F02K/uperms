"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Permissions = void 0;
const conditions_js_1 = require("./conditions.js");
const model_js_1 = require("./model.js");
const resolver_js_1 = require("./resolver.js");
const subjectId = (who) => typeof who === "string" ? who : (0, model_js_1.playerSubject)(who.steamId);
const clone = (v) => JSON.parse(JSON.stringify(v));
class Permissions {
    config;
    storage;
    log;
    data;
    ready = false;
    saving = Promise.resolve();
    conditions = new conditions_js_1.Conditions();
    constructor(config, storage, log = () => { }) {
        this.config = config;
        this.storage = storage;
        this.log = log;
        this.data = (0, model_js_1.emptyData)(config.defaultGroup);
    }
    /** Loads the stored data. Until loading succeeds, only the configured owners are authorized and modifications are rejected. */
    async start(retryMs = 15_000) {
        try {
            const loaded = await this.storage.load();
            if (loaded) {
                (0, model_js_1.validateData)(loaded);
                this.data = loaded;
            }
            if (!this.data.groups[this.config.defaultGroup])
                this.data.groups[this.config.defaultGroup] = { name: this.config.defaultGroup, parents: [], rules: [] };
            this.ready = true;
            this.log(`loaded ${Object.keys(this.data.groups).length} groups, ${Object.keys(this.data.subjects).length} subjects`);
        }
        catch (e) {
            this.log(`load failed (${e.message}); owners only, writes disabled, retrying in ${retryMs / 1000}s`);
            const timer = setTimeout(() => { void this.start(retryMs); }, retryMs);
            timer.unref?.();
        }
    }
    isReady() { return this.ready; }
    isOwner(who) {
        const id = subjectId(who);
        return this.config.owners.some(steamId => (0, model_js_1.playerSubject)(steamId) === id);
    }
    registerCondition(name, fn) { this.conditions.register(name, fn); }
    // Queries
    check(who, node, ctx = {}) {
        if (!(0, model_js_1.isNode)(node))
            return { allowed: false, reason: "invalid node" };
        if (this.isOwner(who))
            return { allowed: true, reason: "owner" };
        if (!this.ready)
            return { allowed: false, reason: "not loaded" };
        return (0, resolver_js_1.resolve)(this.data, subjectId(who), node, ctx, this.conditions, this.config.defaultGroup);
    }
    can(who, node, ctx = {}) { return this.check(who, node, ctx).allowed; }
    require(who, node, ctx = {}) {
        if (!this.can(who, node, ctx))
            throw new Error(`Missing permission: ${node}`);
    }
    // Read access
    getGroups() { return clone(Object.values(this.data.groups)); }
    getSubject(who) { return clone(this.data.subjects[subjectId(who)] ?? { groups: [], rules: [] }); }
    getAudit(limit = 20) { return this.data.audit.slice(-limit); }
    // Modification
    grant(actor, who, node, options = {}) {
        const rule = this.makeRule(node, options);
        const id = subjectId(who);
        this.mutate(actor, `${rule.effect} ${node} on ${id}`, d => {
            const s = (d.subjects[id] ??= { groups: [], rules: [] });
            s.rules = s.rules.filter(r => r.node !== node);
            s.rules.push(rule);
        });
    }
    revoke(actor, who, node) {
        const id = subjectId(who);
        if (!this.data.subjects[id]?.rules.some(r => r.node === node))
            return false;
        this.mutate(actor, `revoke ${node} on ${id}`, d => {
            const s = d.subjects[id];
            if (s)
                s.rules = s.rules.filter(r => r.node !== node);
        });
        return true;
    }
    addToGroup(actor, who, group, expires) {
        const id = subjectId(who);
        this.mutate(actor, `add ${id} to ${group}`, d => {
            if (!d.groups[group])
                throw new Error(`Unknown group: ${group}`);
            const s = (d.subjects[id] ??= { groups: [], rules: [] });
            s.groups = s.groups.filter(m => m.group !== group);
            s.groups.push(expires ? { group, expires } : { group });
        });
    }
    removeFromGroup(actor, who, group) {
        const id = subjectId(who);
        if (!this.data.subjects[id]?.groups.some(m => m.group === group))
            return false;
        this.mutate(actor, `remove ${id} from ${group}`, d => {
            const s = d.subjects[id];
            if (s)
                s.groups = s.groups.filter(m => m.group !== group);
        });
        return true;
    }
    createGroup(actor, name, parents = []) {
        if (!(0, model_js_1.isName)(name))
            throw new Error("Invalid group name.");
        this.mutate(actor, `create group ${name}`, d => {
            if (d.groups[name])
                throw new Error(`Group exists: ${name}`);
            this.assertParents(d, name, parents);
            d.groups[name] = { name, parents, rules: [] };
        });
    }
    setParents(actor, name, parents) {
        this.mutate(actor, `set parents of ${name}: ${parents.join(",") || "-"}`, d => {
            if (!d.groups[name])
                throw new Error(`Unknown group: ${name}`);
            this.assertParents(d, name, parents);
            d.groups[name].parents = parents;
        });
    }
    deleteGroup(actor, name) {
        if (name === this.config.defaultGroup)
            throw new Error("The default group cannot be deleted.");
        this.mutate(actor, `delete group ${name}`, d => {
            if (!d.groups[name])
                throw new Error(`Unknown group: ${name}`);
            delete d.groups[name];
            for (const g of Object.values(d.groups))
                g.parents = g.parents.filter(p => p !== name);
            for (const s of Object.values(d.subjects))
                s.groups = s.groups.filter(m => m.group !== name);
        });
    }
    grantGroup(actor, group, node, options = {}) {
        const rule = this.makeRule(node, options);
        this.mutate(actor, `${rule.effect} ${node} on group ${group}`, d => {
            const g = d.groups[group];
            if (!g)
                throw new Error(`Unknown group: ${group}`);
            g.rules = g.rules.filter(r => r.node !== node);
            g.rules.push(rule);
        });
    }
    revokeGroup(actor, group, node) {
        if (!this.data.groups[group]?.rules.some(r => r.node === node))
            return false;
        this.mutate(actor, `revoke ${node} on group ${group}`, d => {
            const g = d.groups[group];
            if (g)
                g.rules = g.rules.filter(r => r.node !== node);
        });
        return true;
    }
    /** Resolves once all queued writes have completed. */
    flush() { return this.saving; }
    /** Completes pending writes and releases storage connections. */
    async stop() {
        await this.saving;
        await this.storage.close?.();
    }
    // Internals
    makeRule(node, o) {
        if (!(0, model_js_1.isNode)(node))
            throw new Error(`Invalid node: ${node}`);
        const rule = { node, effect: o.effect ?? "allow" };
        if (o.when)
            rule.when = o.when;
        if (o.expires)
            rule.expires = o.expires;
        return rule;
    }
    assertParents(d, name, parents) {
        for (const p of parents) {
            if (!d.groups[p])
                throw new Error(`Unknown group: ${p}`);
            for (const seen = new Set(), stack = [p]; stack.length;) {
                const cur = stack.pop();
                if (cur === name)
                    throw new Error("That would make the group inherit from itself.");
                if (seen.has(cur))
                    continue;
                seen.add(cur);
                stack.push(...(d.groups[cur]?.parents ?? []));
            }
        }
    }
    /** Applies a change to a copy of the state, validates it, then activates it and queues a write. */
    mutate(actor, action, change) {
        if (!this.ready)
            throw new Error("Permissions are not loaded yet; changes are disabled.");
        const next = clone(this.data);
        change(next);
        next.audit.push({ at: new Date().toISOString(), actor, action });
        next.audit = next.audit.slice(-500);
        (0, model_js_1.validateData)(next);
        this.data = next;
        this.saving = this.saving
            .then(() => this.storage.save(this.data))
            .catch(e => this.log(`save failed: ${e.message}; the next change retries with the full state`));
    }
}
exports.Permissions = Permissions;
