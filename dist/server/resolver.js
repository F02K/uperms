"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collect = collect;
exports.resolve = resolve;
const matcher_js_1 = require("./matcher.js");
/** Gathers all candidate rules. Layer 0 is the subject; each inheritance step adds one. Inheritance cycles are broken by tracking visited groups. */
function collect(data, subject, defaultGroup, now) {
    const out = [];
    const s = data.subjects[subject];
    if (s)
        for (const rule of s.rules)
            out.push({ rule, layer: 0, source: subject });
    const seen = new Set();
    let frontier = [defaultGroup, ...(s?.groups ?? []).filter(m => !m.expires || m.expires > now).map(m => m.group)];
    for (let layer = 1; frontier.length; layer++) {
        const next = [];
        for (const name of frontier) {
            if (seen.has(name))
                continue;
            seen.add(name);
            const g = data.groups[name];
            if (!g)
                continue;
            for (const rule of g.rules)
                out.push({ rule, layer, source: `group:${name}` });
            next.push(...g.parents);
        }
        frontier = next;
    }
    return out;
}
/**
 * Precedence: most specific node, then closest source (subject, group, parent group), then
 * deny before allow. The first rule that matches and whose conditions pass decides. If no
 * rule applies, access is denied.
 */
function resolve(data, subject, node, ctx, conditions, defaultGroup, now = Date.now()) {
    const candidates = collect(data, subject, defaultGroup, now)
        .filter(c => (0, matcher_js_1.matches)(c.rule.node, node) && (!c.rule.expires || c.rule.expires > now))
        .sort((a, b) => (0, matcher_js_1.specificity)(b.rule.node) - (0, matcher_js_1.specificity)(a.rule.node) ||
        a.layer - b.layer ||
        (a.rule.effect === b.rule.effect ? 0 : a.rule.effect === "deny" ? -1 : 1));
    for (const c of candidates) {
        if (!conditions.passes(c.rule.when, ctx, subject))
            continue;
        return { allowed: c.rule.effect === "allow", reason: `${c.rule.effect} ${c.rule.node} via ${c.source}` };
    }
    return { allowed: false, reason: "no matching rule" };
}
