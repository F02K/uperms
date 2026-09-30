"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const commands_js_1 = require("./commands.js");
const mysql_storage_js_1 = require("./mysql-storage.js");
const service_js_1 = require("./service.js");
const storage_js_1 = require("./storage.js");
const RESOURCE = "uperms";
const root = (0, node_path_1.resolve)(__dirname, "../..");
const config = JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.resolve)(root, "config.json"), "utf8"));
const log = (m) => console.log(`[${RESOURCE}] ${m}`);
// Credentials are read from the environment only and are never stored in a configuration file.
const connectionString = process.env.UPERMS_MYSQL_CONNECTION_STRING || process.env.MYSQL_CONNECTION_STRING || "";
const storage = config.storage === "mysql"
    ? new mysql_storage_js_1.MysqlStorage({ ...config.mysql, connectionString }, log)
    : new storage_js_1.JsonStorage((0, node_path_1.resolve)(root, "data/uperms.json"));
const perms = new service_js_1.Permissions(config, storage, log);
Exports.register("can", (who, node, ctx) => perms.can(who, node, ctx));
Exports.register("check", (who, node, ctx) => perms.check(who, node, ctx));
Exports.register("require", (who, node, ctx) => perms.require(who, node, ctx));
Exports.register("grant", perms.grant.bind(perms));
Exports.register("revoke", perms.revoke.bind(perms));
Exports.register("addToGroup", perms.addToGroup.bind(perms));
Exports.register("removeFromGroup", perms.removeFromGroup.bind(perms));
Exports.register("registerCondition", (name, fn) => perms.registerCondition(name, fn));
Exports.register("getGroups", perms.getGroups.bind(perms));
Exports.register("getSubject", perms.getSubject.bind(perms));
Exports.register("isReady", perms.isReady.bind(perms));
const host = {
    perms,
    find: (id) => {
        const n = Number(id);
        const p = Number.isInteger(n) ? Player.all().find(o => o.id === n) : undefined;
        return p ? { steamId: p.steamId, nickname: p.nickname } : null;
    },
    reply: (player, text) => {
        const p = Player.all().find(o => o.steamId === player.steamId);
        if (p)
            Chat.sendToPlayer(p, text, { author: "uperms" });
    },
};
Events.on("playerCommand", (player, command, args) => {
    if (command.replace(/^\//, "").toLowerCase() !== config.commandPrefix)
        return;
    (0, commands_js_1.runCommand)(host, player, args);
});
Events.on("resourceStart", name => { if (name === RESOURCE)
    void perms.start(); });
Events.on("resourceStop", name => { if (name === RESOURCE)
    void perms.stop(); });
