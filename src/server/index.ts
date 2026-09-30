import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runCommand } from "./commands.js";
import type { Condition, Config, Context } from "./model.js";
import { MysqlStorage } from "./mysql-storage.js";
import { Permissions } from "./service.js";
import { JsonStorage, type Storage } from "./storage.js";

const RESOURCE = "uperms";
const root = resolve(__dirname, "../..");
const config = JSON.parse(readFileSync(resolve(root, "config.json"), "utf8")) as Config;
const log = (m: string): void => (console.log as unknown as (s: string) => void)(`[${RESOURCE}] ${m}`);

// Credentials are read from the environment only and are never stored in a configuration file.
const connectionString = process.env.UPERMS_MYSQL_CONNECTION_STRING || process.env.MYSQL_CONNECTION_STRING || "";
const storage: Storage = config.storage === "mysql"
  ? new MysqlStorage({ ...config.mysql, connectionString }, log)
  : new JsonStorage(resolve(root, "data/uperms.json"));

const perms = new Permissions(config, storage, log);

type Subject = string | { steamId: string };
Exports.register("can", (who: Subject, node: string, ctx?: Context) => perms.can(who, node, ctx));
Exports.register("check", (who: Subject, node: string, ctx?: Context) => perms.check(who, node, ctx));
Exports.register("require", (who: Subject, node: string, ctx?: Context) => perms.require(who, node, ctx));
Exports.register("grant", perms.grant.bind(perms));
Exports.register("revoke", perms.revoke.bind(perms));
Exports.register("addToGroup", perms.addToGroup.bind(perms));
Exports.register("removeFromGroup", perms.removeFromGroup.bind(perms));
Exports.register("registerCondition", (name: string, fn: Condition) => perms.registerCondition(name, fn));
Exports.register("getGroups", perms.getGroups.bind(perms));
Exports.register("getSubject", perms.getSubject.bind(perms));
Exports.register("isReady", perms.isReady.bind(perms));

const host = {
  perms,
  find: (id: string) => {
    const n = Number(id);
    const p = Number.isInteger(n) ? Player.all().find(o => o.id === n) : undefined;
    return p ? { steamId: p.steamId, nickname: p.nickname } : null;
  },
  reply: (player: { steamId: string }, text: string) => {
    const p = Player.all().find(o => o.steamId === player.steamId);
    if (p) Chat.sendToPlayer(p, text, { author: "uperms" });
  },
};

Events.on("playerCommand", (player, command, args) => {
  if (command.replace(/^\//, "").toLowerCase() !== config.commandPrefix) return;
  runCommand(host, player, args);
});

Events.on("resourceStart", name => { if (name === RESOURCE) void perms.start(); });
Events.on("resourceStop", name => { if (name === RESOURCE) void perms.stop(); });
