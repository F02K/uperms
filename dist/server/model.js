"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isName = exports.isNode = exports.playerSubject = exports.OWNER_SUBJECT_PREFIX = void 0;
exports.emptyData = emptyData;
exports.validateData = validateData;
exports.OWNER_SUBJECT_PREFIX = "player:";
const playerSubject = (steamId) => `${exports.OWNER_SUBJECT_PREFIX}${steamId}`;
exports.playerSubject = playerSubject;
function emptyData(defaultGroup) {
    return { version: 1, groups: { [defaultGroup]: { name: defaultGroup, parents: [], rules: [] } }, subjects: {}, audit: [] };
}
const NODE = /^(\*|[a-z0-9_-]+(\.[a-z0-9_-]+)*(\.\*)?)$/i;
const NAME = /^[a-z0-9_:-]{1,64}$/i;
const isNode = (v) => typeof v === "string" && v.length <= 128 && NODE.test(v);
exports.isNode = isNode;
const isName = (v) => typeof v === "string" && NAME.test(v);
exports.isName = isName;
function validateData(data) {
    if (!data || data.version !== 1 || typeof data.groups !== "object" || typeof data.subjects !== "object" || !Array.isArray(data.audit)) {
        throw new Error("uperms: data file is corrupt");
    }
    for (const [name, g] of Object.entries(data.groups)) {
        if (!(0, exports.isName)(name) || g.name !== name)
            throw new Error(`uperms: invalid group ${name}`);
        for (const r of g.rules)
            if (!(0, exports.isNode)(r.node) || (r.effect !== "allow" && r.effect !== "deny"))
                throw new Error(`uperms: invalid rule in group ${name}`);
    }
    for (const [id, s] of Object.entries(data.subjects)) {
        for (const r of s.rules)
            if (!(0, exports.isNode)(r.node) || (r.effect !== "allow" && r.effect !== "deny"))
                throw new Error(`uperms: invalid rule on ${id}`);
    }
}
