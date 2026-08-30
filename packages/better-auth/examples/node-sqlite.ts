import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";

export interface NodeSQLiteAuthOptions {
  baseURL: string;
  databasePath: string;
  secret: string;
}

/** Copyable Node deployment example using the built-in SQLite driver. */
export function createNodeSQLiteAuth(options: NodeSQLiteAuthOptions) {
  const database = new DatabaseSync(options.databasePath);
  database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

  return {
    auth: betterAuth({
      baseURL: options.baseURL,
      database,
      secret: options.secret,
    }),
    database,
  };
}
