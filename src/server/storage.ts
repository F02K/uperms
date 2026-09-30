import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Data } from "./model.js";

/** Persistence backend. `load` returns null if nothing has been stored yet; both methods throw on failure. */
export interface Storage {
  load(): Promise<Data | null>;
  save(data: Data): Promise<void>;
  /** Releases held resources such as connections. Optional. */
  close?(): Promise<void>;
}

/** File storage. Writes are atomic (temporary file, fsync, rename), so a crash cannot leave a partial file. */
export class JsonStorage implements Storage {
  constructor(private readonly file: string) {}

  async load(): Promise<Data | null> {
    return existsSync(this.file) ? JSON.parse(readFileSync(this.file, "utf8")) as Data : null;
  }

  async save(data: Data): Promise<void> {
    mkdirSync(dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp`;
    const fd = openSync(temp, "w", 0o600);
    try { writeFileSync(fd, JSON.stringify(data, null, 2) + "\n", "utf8"); fsyncSync(fd); }
    finally { closeSync(fd); }
    renameSync(temp, this.file);
  }
}
