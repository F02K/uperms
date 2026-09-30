import type { Condition, Context } from "./model.js";

/**
 * Built-in `ctx` condition: every listed key must equal the corresponding value in the
 * context supplied by the caller.
 *   { "when": { "ctx": { "onDuty": true, "job": "guard" } } }
 * Additional conditions can be registered with `registerCondition(name, fn)`.
 */
const ctxEquals: Condition = (arg, ctx: Context) => {
  if (!arg || typeof arg !== "object" || Array.isArray(arg)) return false;
  return Object.entries(arg as Record<string, unknown>).every(([k, v]) => ctx[k] === v);
};

export class Conditions {
  private readonly map = new Map<string, Condition>([["ctx", ctxEquals]]);

  register(name: string, fn: Condition): void {
    if (!/^[a-z][a-zA-Z0-9_]{0,31}$/.test(name)) throw new Error("uperms: invalid condition name");
    this.map.set(name, fn);
  }

  /** Evaluates all conditions of a rule. Unknown or throwing conditions count as failed. */
  passes(when: Record<string, unknown> | undefined, ctx: Context, subject: string): boolean {
    if (!when) return true;
    for (const [name, arg] of Object.entries(when)) {
      const fn = this.map.get(name);
      if (!fn) return false;
      try { if (!fn(arg, ctx, subject)) return false; } catch { return false; }
    }
    return true;
  }
}
