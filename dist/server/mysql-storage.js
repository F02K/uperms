"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MysqlStorage = void 0;
exports.parseConnectionString = parseConnectionString;
/** URI (`mysql://user:pass@host:3306/db`) or `host=...;port=...;database=...;user=...;password=...`. */
function parseConnectionString(text) {
    const str = text.trim();
    if (!str)
        return null;
    try {
        if (str.includes("://")) {
            const u = new URL(str);
            return {
                host: u.hostname || "localhost",
                port: Number(u.port) || 3306,
                database: u.pathname.replace(/^\//, ""),
                user: decodeURIComponent(u.username || "root"),
                password: decodeURIComponent(u.password),
            };
        }
        const out = {};
        for (const part of str.split(";")) {
            const i = part.indexOf("=");
            if (i !== -1)
                out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
        }
        if (!out.host && !out.database)
            return null;
        return {
            host: out.host || "localhost",
            port: Number(out.port) || 3306,
            database: out.database || out.db || "",
            user: out.user || out.uid || "root",
            password: out.password || out.pwd || "",
        };
    }
    catch {
        return null;
    }
}
/**
 * The driver is loaded on demand. KCDC does not install a resource's packages automatically,
 * so a missing installation is reported as a clear error and results in a degraded start
 * instead of a crash. `timezone: "Z"` makes timestamps independent of the host.
 */
const driverPool = (c, connectionLimit) => {
    let driver;
    try {
        driver = require("mysql2/promise");
    }
    catch {
        throw new Error("mysql2 package missing - run `npm install` in the uperms resource folder");
    }
    return driver.createPool({
        host: c.host, port: c.port, database: c.database, user: c.user, password: c.password,
        waitForConnections: true, connectionLimit, queueLimit: 0, timezone: "Z",
    });
};
/**
 * Stores the complete document in a single row. Queries go through the driver directly, so a
 * failed query raises an error and is never interpreted as an empty data set.
 */
class MysqlStorage {
    options;
    log;
    factory;
    pool = null;
    table;
    constructor(options, log = () => { }, factory = driverPool) {
        this.options = options;
        this.log = log;
        this.factory = factory;
        if (!/^[a-z0-9_]{1,64}$/i.test(options.table))
            throw new Error("uperms: invalid mysql.table");
        this.table = `\`${options.table}\``;
    }
    async connect() {
        if (this.pool)
            return this.pool;
        const connection = parseConnectionString(this.options.connectionString);
        if (!connection?.database)
            throw new Error("no MySQL connection string - set UPERMS_MYSQL_CONNECTION_STRING or MYSQL_CONNECTION_STRING");
        const limit = Math.max(1, Math.min(50, Math.floor(this.options.connectionLimit) || 10));
        const pool = this.factory(connection, limit);
        try {
            await pool.query("SELECT 1 AS ok");
        }
        catch (e) {
            await pool.end().catch(() => { });
            throw e;
        }
        this.pool = pool;
        this.log(`connected to ${connection.host}/${connection.database}`);
        return pool;
    }
    async run(pool, sql, values) {
        if (this.options.debug)
            this.log(`SQL ${sql.replace(/\s+/g, " ").slice(0, 160)}`);
        const start = Date.now();
        const [rows] = await pool.query(sql, values);
        const ms = Date.now() - start;
        if (this.options.slowQueryWarningMs > 0 && ms >= this.options.slowQueryWarningMs)
            this.log(`slow query (${ms}ms): ${sql.slice(0, 80)}`);
        return rows;
    }
    async load() {
        const pool = await this.connect();
        await this.run(pool, `CREATE TABLE IF NOT EXISTS ${this.table} (id TINYINT NOT NULL PRIMARY KEY, data LONGTEXT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
        const rows = await this.run(pool, `SELECT data FROM ${this.table} WHERE id = 1`);
        const text = String(rows[0]?.data ?? "");
        return text ? JSON.parse(text) : null;
    }
    async save(data) {
        const pool = await this.connect();
        await this.run(pool, `INSERT INTO ${this.table} (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)`, [JSON.stringify(data)]);
    }
    async close() {
        const pool = this.pool;
        this.pool = null;
        if (pool)
            await pool.end().catch(() => { });
    }
}
exports.MysqlStorage = MysqlStorage;
