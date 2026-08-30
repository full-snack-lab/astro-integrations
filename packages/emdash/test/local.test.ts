import { describe, expect, test } from "bun:test";
import { local, memoryCache } from "emdash/astro";
import { libsql } from "emdash/db";
import emdashLocal, {
  createLocalEmdashConfig,
  emdashLocal as createLocalIntegration,
} from "../src/index.js";

describe("@fullsnacklab/astro-emdash", () => {
  test("exports the local preset as both the default and named factory", () => {
    expect(emdashLocal).toBe(createLocalIntegration);
  });

  test("provides a complete local persistence preset", () => {
    const config = createLocalEmdashConfig();

    expect(config.database).toEqual(libsql({ url: "file:./data.db" }));
    expect(config.storage).toEqual(
      local({ directory: "./uploads", baseUrl: "/_emdash/api/media/file" }),
    );
    expect(config.objectCache).toEqual(memoryCache({ defaultTtl: 600 }));
  });

  test("rejects empty local persistence paths", () => {
    expect(() => createLocalEmdashConfig({ database: { url: " " } })).toThrow("database.url");
    expect(() => createLocalEmdashConfig({ storage: { directory: "" } })).toThrow(
      "storage.directory",
    );
  });

  test("accepts focused persistence overrides and forwards advanced Emdash config", () => {
    const config = createLocalEmdashConfig({
      cache: false,
      database: { authToken: "token", url: "libsql://example.test" },
      emdash: { images: false, siteUrl: "https://example.test" },
      storage: { baseUrl: "/media", directory: "./media" },
    });

    expect(config.database).toEqual(libsql({ authToken: "token", url: "libsql://example.test" }));
    expect(config.storage).toEqual(local({ baseUrl: "/media", directory: "./media" }));
    expect(config.objectCache).toBeUndefined();
    expect(config).toMatchObject({ images: false, siteUrl: "https://example.test" });
  });
});
