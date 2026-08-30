import { describe, expect, test } from "bun:test";
import { replaceWranglerPlaceholders } from "../src/index.js";

const config = `{
  "d1_databases": [{ "database_id": "REPLACE_D1" }],
  "kv_namespaces": [{ "id": "REPLACE_KV" }]
}`;
const replacements = [
  { environmentVariable: "CF_D1_ID", placeholder: "REPLACE_D1" },
  { environmentVariable: "CF_KV_ID", placeholder: "REPLACE_KV" },
] as const;

describe("generated Wrangler config", () => {
  test("replaces every configured placeholder from explicit environment values", () => {
    expect(
      replaceWranglerPlaceholders(config, replacements, {
        CF_D1_ID: "database-id",
        CF_KV_ID: "namespace-id",
      }),
    ).toContain('"database_id": "database-id"');
  });

  test("reports only environment variables required by present placeholders", () => {
    expect(() =>
      replaceWranglerPlaceholders(config, replacements, {
        CF_D1_ID: "database-id",
      }),
    ).toThrow("CF_KV_ID");
    expect(() =>
      replaceWranglerPlaceholders('{ "d1": "REPLACE_D1" }', replacements, {
        CF_D1_ID: "database-id",
      }),
    ).not.toThrow();
  });

  test("rejects duplicate placeholders before changing output", () => {
    expect(() =>
      replaceWranglerPlaceholders(
        config,
        [...replacements, { environmentVariable: "OTHER_D1_ID", placeholder: "REPLACE_D1" }],
        {},
      ),
    ).toThrow("duplicate placeholder");
  });
});
