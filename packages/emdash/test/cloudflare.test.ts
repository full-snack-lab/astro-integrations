import { describe, expect, test } from "bun:test";
import { d1, kvCache, r2 } from "@emdash-cms/cloudflare";
import emdashCloudflare, {
  createCloudflareEmdashConfig,
  emdashCloudflare as createCloudflareIntegration,
  type CloudflareEmdashOptions,
} from "../src/cloudflare.js";

describe("@fullsnacklab/astro-emdash/cloudflare", () => {
  test("exports the Cloudflare preset as both the default and named factory", () => {
    expect(emdashCloudflare).toBe(createCloudflareIntegration);
  });

  test("uses conventional D1, R2, and KV binding names", () => {
    const config = createCloudflareEmdashConfig();

    expect(config.database).toEqual(d1({ binding: "DB" }));
    expect(config.storage).toEqual(r2({ binding: "MEDIA" }));
    expect(config.objectCache).toEqual(kvCache({ binding: "CACHE" }));
  });

  test("customizes bindings and adapter options while forwarding advanced config", () => {
    const config = createCloudflareEmdashConfig({
      bindings: { cache: "CONTENT_CACHE", database: "CONTENT_DB", media: "ASSETS" },
      cache: { defaultTtl: 300, keyPrefix: "site:" },
      database: { session: "auto" },
      emdash: { images: false, siteUrl: "https://example.test" },
      storage: { publicUrl: "https://media.example.test" },
    });

    expect(config.database).toEqual(d1({ binding: "CONTENT_DB", session: "auto" }));
    expect(config.storage).toEqual(
      r2({ binding: "ASSETS", publicUrl: "https://media.example.test" }),
    );
    expect(config.objectCache).toEqual(
      kvCache({ binding: "CONTENT_CACHE", defaultTtl: 300, keyPrefix: "site:" }),
    );
    expect(config).toMatchObject({ images: false, siteUrl: "https://example.test" });
  });

  test("keeps validated bindings authoritative for untyped callers", () => {
    const options = {
      bindings: { cache: "CONTENT_CACHE", database: "CONTENT_DB", media: "ASSETS" },
      cache: { binding: "SHADOW_CACHE" },
      database: { binding: "SHADOW_DB" },
      storage: { binding: "SHADOW_MEDIA" },
    } as unknown as CloudflareEmdashOptions;
    const config = createCloudflareEmdashConfig(options);

    expect(config.database).toEqual(d1({ binding: "CONTENT_DB" }));
    expect(config.storage).toEqual(r2({ binding: "ASSETS" }));
    expect(config.objectCache).toEqual(kvCache({ binding: "CONTENT_CACHE" }));
  });

  test("rejects empty binding overrides", () => {
    expect(() => createCloudflareEmdashConfig({ bindings: { database: " " } })).toThrow(
      "bindings.database",
    );
  });

  test("can leave object caching application-owned", () => {
    expect(createCloudflareEmdashConfig({ cache: false }).objectCache).toBeUndefined();
  });
});
