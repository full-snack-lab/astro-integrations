import { Database } from "bun:sqlite";
import { betterAuth } from "better-auth";

export interface BunSQLiteAuthOptions {
  baseURL: string;
  databasePath: string;
  secret: string;
}

/** Copyable Bun deployment example using Bun's native SQLite driver. */
export function createBunSQLiteAuth(options: BunSQLiteAuthOptions) {
  const database = new Database(options.databasePath, { create: true });
  database.run("PRAGMA journal_mode = WAL");
  database.run("PRAGMA foreign_keys = ON");

  return {
    auth: betterAuth({
      baseURL: options.baseURL,
      database,
      secret: options.secret,
    }),
    database,
  };
}
