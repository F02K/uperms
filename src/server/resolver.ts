import type { Conditions } from "./conditions.js";
import { matches, specificity } from "./matcher.js";
import type { Context, Data, Decision, Rule } from "./model.js";

interface Candidate { rule: Rule; layer: number; source: string }

/** Gathers all candidate rules. Layer 0 is the subject; each inheritance step adds one. Inheritance cycles are broken by tracking visited groups. */
export function collect(data: Data, subject: string, defaultGroup: string, now: number): Candidate[] {
  const out: Candidate[] = [];
  const s = data.subjects[subject];
  if (s) for (const rule of s.rules) out.push({ rule, layer: 0, source: subject });

  const seen = new Set<string>();
  let frontier = [defaultGroup, ...(s?.groups ?? []).filter(m => !m.expires || m.expires > now).map(m => m.group)];
  for (let layer = 1; frontier.length; layer++) {
    const next: string[] = [];
    for (const name of frontier) {
      if (seen.has(name)) continue;
      seen.add(name);
      const g = data.groups[name];
      if (!g) continue;
      for (const rule of g.rules) out.push({ rule, layer, source: `group:${name}` });
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
export function resolve(data: Data, subject: string, node: string, ctx: Context, conditions: Conditions, defaultGroup: string, now = Date.now()): Decision {
  const candidates = collect(data, subject, defaultGroup, now)
    .filter(c => matches(c.rule.node, node) && (!c.rule.expires || c.rule.expires > now))
    .sort((a, b) =>
      specificity(b.rule.node) - specificity(a.rule.node) ||
      a.layer - b.layer ||
      (a.rule.effect === b.rule.effect ? 0 : a.rule.effect === "deny" ? -1 : 1));
  for (const c of candidates) {
    if (!conditions.passes(c.rule.when, ctx, subject)) continue;
    return { allowed: c.rule.effect === "allow", reason: `${c.rule.effect} ${c.rule.node} via ${c.source}` };
  }
  return { allowed: false, reason: "no matching rule" };
}
