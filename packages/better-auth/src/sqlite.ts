import { DatabaseSync } from "node:sqlite";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { createAuthOptions, type AuthPolicyInput } from "./policy.js";

export interface NodeSqliteDatabaseOptions {
  /** Absolute or relative path to the SQLite database file. */
  path: string;
  /** Enable Write-Ahead Logging (PRAGMA journal_mode = WAL;). Defaults to true. */
  wal?: boolean;
  /** Enable Foreign Key constraints (PRAGMA foreign_keys = ON;). Defaults to true. */
  foreignKeys?: boolean;
}

/**
 * Instantiates and configures a Node DatabaseSync SQLite instance
 * with WAL mode and foreign key enforcement enabled by default.
 */
export function createNodeSqliteDatabase(
  pathOrOptions: string | NodeSqliteDatabaseOptions,
): DatabaseSync {
  const options: NodeSqliteDatabaseOptions =
    typeof pathOrOptions === "string" ? { path: pathOrOptions } : pathOrOptions;

  if (!options.path || typeof options.path !== "string" || options.path.trim().length === 0) {
    throw new TypeError("@fullsnacklab/astro-better-auth/sqlite: database path must be a non-empty string.");
  }

  const database = new DatabaseSync(options.path.trim());
  const statements: string[] = [];

  if (options.wal === false) {
    statements.push("PRAGMA journal_mode = DELETE;");
  } else {
    statements.push("PRAGMA journal_mode = WAL;");
  }

  if (options.foreignKeys === false) {
    statements.push("PRAGMA foreign_keys = OFF;");
  } else {
    statements.push("PRAGMA foreign_keys = ON;");
  }

  if (statements.length > 0) {
    database.exec(statements.join(" "));
  }

  return database;
}

export interface NodeSqliteAuthOptions extends Omit<AuthPolicyInput<DatabaseSync>, "database"> {
  /** Existing DatabaseSync instance. Required if databasePath is omitted. */
  database?: DatabaseSync;
  /** SQLite database file path. Required if database instance is omitted. */
  databasePath?: string;
  /** Enable WAL mode when instantiating from databasePath. Defaults to true. */
  wal?: boolean;
  /** Enable foreign keys when instantiating from databasePath. Defaults to true. */
  foreignKeys?: boolean;
  /** Additional Better Auth options (e.g. plugins, custom hooks, providers). */
  extraOptions?: Partial<BetterAuthOptions>;
}

export interface NodeSqliteAuthResult {
  auth: ReturnType<typeof betterAuth>;
  database: DatabaseSync;
}

/**
 * Creates a Better Auth instance configured for Node SQLite runtime
 * with WAL mode, foreign key enforcement, and standard security policy.
 */
export function createNodeSqliteAuth(options: NodeSqliteAuthOptions): NodeSqliteAuthResult {
  if (!options || typeof options !== "object") {
    throw new TypeError("@fullsnacklab/astro-better-auth/sqlite: options must be an object.");
  }

  const database =
    options.database ??
    (options.databasePath
      ? createNodeSqliteDatabase({
          path: options.databasePath,
          wal: options.wal,
          foreignKeys: options.foreignKeys,
        })
      : null);

  if (!database) {
    throw new TypeError("@fullsnacklab/astro-better-auth/sqlite: either database or databasePath must be provided.");
  }

  const basePolicy = createAuthOptions({
    baseURL: options.baseURL,
    database,
    secret: options.secret,
    defer: options.defer,
    production: options.production,
    sessionExpirySeconds: options.sessionExpirySeconds,
    sessionUpdateAgeSeconds: options.sessionUpdateAgeSeconds,
    disablePasswordAuth: options.disablePasswordAuth,
  });

  const mergedOptions: BetterAuthOptions = {
    ...basePolicy,
    ...options.extraOptions,
    advanced: {
      ...basePolicy.advanced,
      ...options.extraOptions?.advanced,
    },
    session: {
      ...basePolicy.session,
      ...options.extraOptions?.session,
    },
  };

  return {
    auth: betterAuth(mergedOptions),
    database,
  };
}
