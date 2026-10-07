import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema.ts";

export type Db = BetterSQLite3Database<typeof schema>;

let instance: Db | null = null;

/**
 * Opens the database on first use and applies any pending migrations. In
 * production DATABASE_PATH points into the Fly volume at /data, the only
 * storage that survives a restart or a redeploy.
 */
export function db(): Db {
  if (instance) return instance;
  const path = resolve(process.env.DATABASE_PATH ?? "data/dev.db");
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const opened = drizzle(sqlite, { schema });
  migrate(opened, { migrationsFolder: resolve(process.env.MIGRATIONS_DIR ?? "drizzle") });
  instance = opened;
  return opened;
}
