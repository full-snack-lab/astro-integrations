/// <reference types="bun" />

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { createAuthOptions } from "../../../playground/src/auth-options.js";
import type { AuthEmail } from "../../../playground/src/email.js";

const temporaryDirectories: string[] = [];
const expectedTables = ["account", "session", "user", "verification"];

function createTemporaryDatabase(): { database: DatabaseSync; path: string } {
  const directory = mkdtempSync(join(tmpdir(), "astro-better-auth-"));
  temporaryDirectories.push(directory);
  const path = join(directory, "auth.db");
  return { database: new DatabaseSync(path), path };
}

function tableNames(database: DatabaseSync): string[] {
  return database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((row) => String(row.name))
    .sort();
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("Better Auth persistence", () => {
  test("migrates SQLite and persists a signed-up user across connections", async () => {
    const { database, path } = createTemporaryDatabase();
    const delivered: AuthEmail[] = [];
    const auth = betterAuth(
      createAuthOptions({
        baseURL: "http://localhost:4321",
        database,
        deliverEmail: async (email) => {
          delivered.push(email);
        },
        secret: "test-secret-that-is-at-least-thirty-two-characters",
      }),
    );

    const context = await auth.$context;
    await context.runMigrations();
    expect(tableNames(database)).toEqual(expectedTables);

    await auth.api.signUpEmail({
      body: {
        email: "persistent@example.com",
        name: "Persistent User",
        password: "correct-horse-battery-staple",
      },
    });
    await Promise.resolve();
    expect(delivered).toHaveLength(1);
    database.close();

    const reopened = new DatabaseSync(path);
    const user = reopened
      .prepare('SELECT email FROM "user" WHERE email = ?')
      .get("persistent@example.com");
    expect(user).toEqual({ email: "persistent@example.com" });
    reopened.close();
  });

  test("keeps the checked-in D1 migration aligned with the Better Auth schema", async () => {
    const database = new DatabaseSync(":memory:");
    const migration = readFileSync(
      new URL("../../../playground/migrations/0001_better_auth.sql", import.meta.url),
      "utf8",
    );

    database.exec(migration);
    const plan = await getMigrations(
      createAuthOptions({
        baseURL: "http://localhost:4321",
        database,
        deliverEmail: async () => undefined,
        secret: "test-secret-that-is-at-least-thirty-two-characters",
      }),
      { throwOnUnsafe: false },
    );

    expect(tableNames(database)).toEqual(expectedTables);
    expect({
      indexes: plan.toBeAddedIndexes,
      tables: plan.toBeCreated,
      unsafeChanges: plan.unsafeChanges,
      columns: plan.toBeAdded,
    }).toEqual({ columns: [], indexes: [], tables: [], unsafeChanges: [] });
    database.close();
  });
});
