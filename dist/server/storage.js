"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonStorage = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
/** File storage. Writes are atomic (temporary file, fsync, rename), so a crash cannot leave a partial file. */
class JsonStorage {
    file;
    constructor(file) {
        this.file = file;
    }
    async load() {
        return (0, node_fs_1.existsSync)(this.file) ? JSON.parse((0, node_fs_1.readFileSync)(this.file, "utf8")) : null;
    }
    async save(data) {
        (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(this.file), { recursive: true });
        const temp = `${this.file}.tmp`;
        const fd = (0, node_fs_1.openSync)(temp, "w", 0o600);
        try {
            (0, node_fs_1.writeFileSync)(fd, JSON.stringify(data, null, 2) + "\n", "utf8");
            (0, node_fs_1.fsyncSync)(fd);
        }
        finally {
            (0, node_fs_1.closeSync)(fd);
        }
        (0, node_fs_1.renameSync)(temp, this.file);
    }
}
exports.JsonStorage = JsonStorage;
