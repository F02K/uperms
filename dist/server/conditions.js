"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Conditions = void 0;
/**
 * Built-in `ctx` condition: every listed key must equal the corresponding value in the
 * context supplied by the caller.
 *   { "when": { "ctx": { "onDuty": true, "job": "guard" } } }
 * Additional conditions can be registered with `registerCondition(name, fn)`.
 */
const ctxEquals = (arg, ctx) => {
    if (!arg || typeof arg !== "object" || Array.isArray(arg))
        return false;
    return Object.entries(arg).every(([k, v]) => ctx[k] === v);
};
class Conditions {
    map = new Map([["ctx", ctxEquals]]);
    register(name, fn) {
        if (!/^[a-z][a-zA-Z0-9_]{0,31}$/.test(name))
            throw new Error("uperms: invalid condition name");
        this.map.set(name, fn);
    }
    /** Evaluates all conditions of a rule. Unknown or throwing conditions count as failed. */
    passes(when, ctx, subject) {
        if (!when)
            return true;
        for (const [name, arg] of Object.entries(when)) {
            const fn = this.map.get(name);
            if (!fn)
                return false;
            try {
                if (!fn(arg, ctx, subject))
                    return false;
            }
            catch {
                return false;
            }
        }
        return true;
    }
}
exports.Conditions = Conditions;
