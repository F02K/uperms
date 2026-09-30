"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDuration = parseDuration;
exports.runCommand = runCommand;
const model_js_1 = require("./model.js");
const UNITS = { m: 60_000, h: 3_600_000, d: 86_400_000 };
/** Converts a duration such as "30m", "2h" or "7d" into an absolute Unix timestamp in ms, or null if the text is not a duration. */
function parseDuration(text, now = Date.now()) {
    const m = /^(\d{1,4})([mhd])$/.exec(text ?? "");
    return m ? now + Number(m[1]) * UNITS[m[2]] : null;
}
const HELP = [
    "/uperms check <id> <node> · info <id> · groups · audit",
    "/uperms grant <id> <node> [allow|deny] [30m|2h|7d] · revoke <id> <node>",
    "/uperms group add|remove <id> <group> [duration]",
    "/uperms group create <name> [parent] · delete <name> · parent <name> <parent|->",
    "/uperms group grant <name> <node> [allow|deny] · revoke <name> <node>",
];
/**
 * Executes a `/uperms` command. Every subcommand requires `uperms.manage`. Granting a node
 * additionally requires holding it, so permissions cannot be escalated through the command.
 */
function runCommand(host, player, args) {
    const { perms } = host;
    const say = (t) => host.reply(player, t);
    const actor = (0, model_js_1.playerSubject)(player.steamId);
    try {
        perms.require(player, "uperms.manage");
        const [sub = "help", ...rest] = args;
        const target = (id) => {
            const found = id ? host.find(id) : null;
            if (!found)
                throw new Error("Player not found (use the numeric player id).");
            return found;
        };
        const effect = (v) => (v === "deny" ? "deny" : "allow");
        const until = (v) => parseDuration(v) ?? undefined;
        const tail = (list) => list.find(v => v && parseDuration(v) !== null);
        switch (sub) {
            case "check": {
                const t = target(rest[0]);
                const d = perms.check(t, rest[1] ?? "");
                say(`${t.nickname} · ${rest[1]}: ${d.allowed ? "ALLOWED" : "DENIED"} (${d.reason})`);
                return;
            }
            case "info": {
                const t = target(rest[0]), s = perms.getSubject(t);
                say(`${t.nickname}${perms.isOwner(t) ? " [owner]" : ""} · groups: ${s.groups.map(m => m.group).join(", ") || "-"} · rules: ${s.rules.map(r => `${r.effect === "deny" ? "-" : "+"}${r.node}`).join(" ") || "-"}`);
                return;
            }
            case "groups":
                say(perms.getGroups().map(g => `${g.name}${g.parents.length ? `<${g.parents.join(",")}` : ""}(${g.rules.length})`).join(" · "));
                return;
            case "audit":
                for (const a of perms.getAudit(8))
                    say(`${a.at.slice(5, 16)} ${a.actor.replace("player:", "")}: ${a.action}`);
                return;
            case "grant": {
                const t = target(rest[0]), node = rest[1] ?? "";
                perms.require(player, node);
                perms.grant(actor, t, node, { effect: effect(rest[2]), expires: until(tail(rest.slice(2))) });
                say(`Set ${node} on ${t.nickname}.`);
                return;
            }
            case "revoke": {
                const t = target(rest[0]);
                say(perms.revoke(actor, t, rest[1] ?? "") ? `Removed ${rest[1]} from ${t.nickname}.` : "Nothing to remove.");
                return;
            }
            case "group": {
                const [action = "", a, b, c] = rest;
                if (action === "add") {
                    const t = target(a);
                    perms.require(player, `uperms.group.${b}`);
                    perms.addToGroup(actor, t, b ?? "", until(c));
                    say(`${t.nickname} added to ${b}.`);
                    return;
                }
                if (action === "remove") {
                    const t = target(a);
                    perms.require(player, `uperms.group.${b}`);
                    say(perms.removeFromGroup(actor, t, b ?? "") ? `${t.nickname} removed from ${b}.` : "Not a member.");
                    return;
                }
                if (action === "create") {
                    perms.createGroup(actor, a ?? "", b ? [b] : []);
                    say(`Group ${a} created.`);
                    return;
                }
                if (action === "delete") {
                    perms.deleteGroup(actor, a ?? "");
                    say(`Group ${a} deleted.`);
                    return;
                }
                if (action === "parent") {
                    perms.setParents(actor, a ?? "", b && b !== "-" ? [b] : []);
                    say(`Parent of ${a} set.`);
                    return;
                }
                if (action === "grant") {
                    perms.require(player, b ?? "");
                    perms.grantGroup(actor, a ?? "", b ?? "", { effect: effect(c) });
                    say(`Set ${b} on group ${a}.`);
                    return;
                }
                if (action === "revoke") {
                    say(perms.revokeGroup(actor, a ?? "", b ?? "") ? `Removed ${b} from ${a}.` : "Nothing to remove.");
                    return;
                }
                break;
            }
            default:
        }
        HELP.forEach(say);
    }
    catch (e) {
        say(e.message);
    }
}
