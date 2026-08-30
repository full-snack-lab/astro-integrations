import type { AstroIntegration } from "astro";
import upstreamEmdash, {
  local,
  memoryCache,
  type EmDashConfig,
  type LocalStorageConfig,
  type MemoryCacheOptions,
} from "emdash/astro";
import { libsql, type LibsqlConfig } from "emdash/db";
import { nonEmptyString } from "./validation.js";

type ManagedPersistence = "database" | "objectCache" | "storage";

/** Emdash options that remain outside the local persistence preset. */
export type LocalEmdashConfig = Omit<EmDashConfig, ManagedPersistence>;

/** Local libSQL options with a conventional file URL default. */
export type LocalEmdashDatabaseOptions = Omit<LibsqlConfig, "url"> & { url?: string };

/** Local media options with conventional directory and route defaults. */
export type LocalEmdashStorageOptions = Partial<LocalStorageConfig>;

/** Configures the friendly local Emdash preset. */
export interface LocalEmdashOptions {
  /** In-memory query cache options, or `false` to leave caching disabled. */
  cache?: false | MemoryCacheOptions;
  /** libSQL configuration. Defaults to `file:./data.db`. */
  database?: LocalEmdashDatabaseOptions;
  /** Advanced Emdash options forwarded without changing persistence descriptors. */
  emdash?: LocalEmdashConfig;
  /** Local media storage paths. */
  storage?: LocalEmdashStorageOptions;
}

/** Builds the upstream Emdash config used by the local preset. */
export function createLocalEmdashConfig(options: LocalEmdashOptions = {}): EmDashConfig {
  const databaseOptions = { url: "file:./data.db", ...options.database };
  const storageOptions = {
    baseUrl: "/_emdash/api/media/file",
    directory: "./uploads",
    ...options.storage,
  };
  const database = libsql({
    ...databaseOptions,
    url: nonEmptyString(databaseOptions.url, "database.url"),
  });
  const storage = local({
    baseUrl: nonEmptyString(storageOptions.baseUrl, "storage.baseUrl"),
    directory: nonEmptyString(storageOptions.directory, "storage.directory"),
  });
  const objectCache =
    options.cache === false ? undefined : memoryCache({ defaultTtl: 600, ...options.cache });

  return {
    ...options.emdash,
    database,
    objectCache,
    storage,
  };
}

/** Creates Emdash with local libSQL, filesystem media, and memory-cache defaults. */
export function emdashLocal(options: LocalEmdashOptions = {}): AstroIntegration {
  return upstreamEmdash(createLocalEmdashConfig(options));
}

export default emdashLocal;
