import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createBunSQLiteAuth } from "../examples/bun-sqlite.js";
import { createCloudflareD1Auth } from "../examples/cloudflare-d1.js";
import { createNodeSQLiteAuth } from "../examples/node-sqlite.js";

const packageRoot = new URL("../", import.meta.url);
const temporaryDirectories: string[] = [];
const authOptions = {
  baseURL: "http://localhost:4321",
  secret: "test-secret-that-is-at-least-thirty-two-characters",
};

function temporaryDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "astro-better-auth-example-"));
  temporaryDirectories.push(directory);
  return join(directory, "auth.db");
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("published persistence examples", () => {
  test("runs Better Auth migrations with Node SQLite", async () => {
    const { auth, database } = createNodeSQLiteAuth({
      ...authOptions,
      databasePath: temporaryDatabasePath(),
    });

    await (await auth.$context).runMigrations();

    expect(
      database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user'")
        .get(),
    ).toEqual({ name: "user" });
    database.close();
  });

  test("runs Better Auth migrations with Bun SQLite", async () => {
    const { auth, database } = createBunSQLiteAuth({
      ...authOptions,
      databasePath: temporaryDatabasePath(),
    });

    await (await auth.$context).runMigrations();

    expect(
      database.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user'").get(),
    ).toEqual({ name: "user" });
    database.close();
  });

  test("passes D1 and waitUntil through the Cloudflare example", () => {
    const database = new DatabaseSync(":memory:");
    const deferred: Promise<unknown>[] = [];
    const auth = createCloudflareD1Auth({
      ...authOptions,
      database,
      waitUntil(task) {
        deferred.push(task);
      },
    });
    const task = Promise.resolve();

    auth.options.advanced?.backgroundTasks?.handler(task);

    expect(auth.options.database).toBe(database);
    expect(deferred).toEqual([task]);
    database.close();
  });

  test("includes examples and release validation in the npm package contract", () => {
    const manifest = JSON.parse(readFileSync(new URL("package.json", packageRoot), "utf8")) as {
      files?: string[];
      scripts?: Record<string, string>;
    };
    const readme = readFileSync(new URL("README.md", packageRoot), "utf8");

    expect(manifest.files).toContain("examples");
    expect(manifest.scripts?.["release:check"]).toBe(
      "bun run test && bun run type-check && bun run build && npm pack --dry-run",
    );
    expect(readme).toContain("## Node SQLite");
    expect(readme).toContain("## Bun SQLite");
    expect(readme).toContain("## Cloudflare D1");
    expect(readme).toContain("npx auth@latest migrate plan");
  });
});
