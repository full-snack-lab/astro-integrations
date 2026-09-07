import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import {
  createNodeSqliteAuth,
  createNodeSqliteDatabase,
} from "../src/sqlite.js";

const testDbPath = join(import.meta.dir, ".tmp-sqlite-test.db");

function cleanup() {
  for (const file of [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`]) {
    if (existsSync(file)) {
      try {
        unlinkSync(file);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

describe("@fullsnacklab/astro-better-auth/sqlite", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  test("createNodeSqliteDatabase enables WAL mode and foreign keys on file db", () => {
    const db = createNodeSqliteDatabase(testDbPath);
    try {
      const journalMode = (db.prepare("PRAGMA journal_mode;").get() as { journal_mode: string })
        ?.journal_mode;
      const foreignKeys = (db.prepare("PRAGMA foreign_keys;").get() as { foreign_keys: number })
        ?.foreign_keys;

      expect(journalMode).toBe("wal");
      expect(foreignKeys).toBe(1);
    } finally {
      db.close();
    }
  });

  test("createNodeSqliteDatabase supports disabling WAL or foreign keys", () => {
    const db = createNodeSqliteDatabase({
      path: testDbPath,
      wal: false,
      foreignKeys: false,
    });
    try {
      const foreignKeys = (db.prepare("PRAGMA foreign_keys;").get() as { foreign_keys: number })
        ?.foreign_keys;
      expect(foreignKeys).toBe(0);
    } finally {
      db.close();
    }
  });

  test("createNodeSqliteAuth configures Better Auth and returns auth and database instances", () => {
    const result = createNodeSqliteAuth({
      baseURL: "https://example.com/api/auth",
      secret: "test-secret-at-least-32-chars-long!",
      databasePath: testDbPath,
    });

    expect(result.auth).toBeDefined();
    expect(result.database).toBeDefined();
    expect(typeof result.auth.handler).toBe("function");

    result.database.close();
  });

  test("rejects invalid options defensively", () => {
    // @ts-expect-error missing path
    expect(() => createNodeSqliteDatabase({})).toThrow("database path must be a non-empty string");
    // @ts-expect-error missing options
    expect(() => createNodeSqliteAuth()).toThrow("options must be an object");

    expect(() =>
      createNodeSqliteAuth({
        baseURL: "https://example.com",
        secret: "test",
      }),
    ).toThrow("either database or databasePath must be provided");
  });
});
