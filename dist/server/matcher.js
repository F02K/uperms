"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matches = matches;
exports.specificity = specificity;
/**
 * Node patterns consist of dot-separated segments. A trailing `.*` matches every node below
 * the prefix (`job.*` matches `job.police.arrest` but not `job`); a lone `*` matches every node.
 */
function matches(pattern, node) {
    if (pattern === "*")
        return true;
    if (pattern === node)
        return true;
    if (!pattern.endsWith(".*"))
        return false;
    const prefix = pattern.slice(0, -1); // retains the trailing dot, e.g. "job."
    return node.startsWith(prefix) && node.length > prefix.length;
}
/** Ranks a pattern by the number of literal segments. A wildcard tail does not count: `a.b` > `a.*` > `*`. */
function specificity(pattern) {
    if (pattern === "*")
        return 0;
    return pattern.endsWith(".*") ? pattern.split(".").length - 1 : pattern.split(".").length;
}
