import {
  d1,
  kvCache,
  r2,
  type D1Config,
  type KVCacheConfig,
  type R2StorageConfig,
} from "@emdash-cms/cloudflare";
import type { AstroIntegration } from "astro";
import upstreamEmdash, { type EmDashConfig } from "emdash/astro";
import { nonEmptyString } from "./validation.js";

type ManagedPersistence = "database" | "objectCache" | "storage";

/** Emdash options that remain outside the Cloudflare persistence preset. */
export type CloudflareEmdashConfig = Omit<EmDashConfig, ManagedPersistence>;

/** Conventional Worker binding names used by the Cloudflare preset. */
export interface CloudflareEmdashBindings {
  cache?: string;
  database?: string;
  media?: string;
}

/** Configures the friendly Cloudflare Emdash preset. */
export interface CloudflareEmdashOptions {
  /** Overrides conventional `DB`, `MEDIA`, and `CACHE` binding names. */
  bindings?: CloudflareEmdashBindings;
  /** KV cache options, or `false` to leave object caching disabled. */
  cache?: false | Omit<KVCacheConfig, "binding">;
  /** D1 options beyond the binding name. */
  database?: Omit<D1Config, "binding">;
  /** Advanced Emdash options forwarded without changing persistence descriptors. */
  emdash?: CloudflareEmdashConfig;
  /** R2 options beyond the binding name. */
  storage?: Omit<R2StorageConfig, "binding">;
}

/** Builds the upstream Emdash config used by the Cloudflare preset. */
export function createCloudflareEmdashConfig(options: CloudflareEmdashOptions = {}): EmDashConfig {
  const bindings = {
    cache: "CACHE",
    database: "DB",
    media: "MEDIA",
    ...options.bindings,
  };
  const databaseBinding = nonEmptyString(bindings.database, "bindings.database");
  const mediaBinding = nonEmptyString(bindings.media, "bindings.media");
  const cacheBinding = nonEmptyString(bindings.cache, "bindings.cache");
  const objectCache =
    options.cache === false ? undefined : kvCache({ ...options.cache, binding: cacheBinding });

  return {
    ...options.emdash,
    database: d1({ ...options.database, binding: databaseBinding }),
    objectCache,
    storage: r2({ ...options.storage, binding: mediaBinding }),
  };
}

/** Creates Emdash with conventional Cloudflare D1, R2, and KV bindings. */
export function emdashCloudflare(options: CloudflareEmdashOptions = {}): AstroIntegration {
  return upstreamEmdash(createCloudflareEmdashConfig(options));
}

export default emdashCloudflare;
