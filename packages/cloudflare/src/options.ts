const INTEGRATION_NAME = "@fullsnacklab/astro-cloudflare";

/** One placeholder copied from a tracked Wrangler config into generated output. */
export interface CloudflareResourceReplacement {
  /** Environment variable containing the account-specific value. */
  environmentVariable: string;
  /** Literal placeholder to replace in the generated Wrangler config. */
  placeholder: string;
}

/** Environment values used during the Cloudflare build. */
export type CloudflareBuildEnvironment = Readonly<Record<string, string | undefined>>;

/** Configures Cloudflare-specific Astro build seams without wrapping the official adapter. */
export interface CloudflareConfigOptions {
  /**
   * Environment source used by generated-config replacements.
   *
   * @defaultValue `process.env`
   */
  environment?: CloudflareBuildEnvironment;
  /**
   * Generated Wrangler config relative to Astro's client output directory.
   *
   * @defaultValue `'../server/wrangler.json'`
   */
  generatedConfig?: string | URL;
  /** Placeholder-to-environment mappings applied after a successful build. */
  replacements?: readonly CloudflareResourceReplacement[];
  /** Application-owned module specifiers aliased to `cloudflare:workers`. */
  workerModuleAliases?: readonly string[];
}

export interface ResolvedCloudflareConfigOptions {
  environment: CloudflareBuildEnvironment;
  generatedConfig: string | URL;
  replacements: readonly CloudflareResourceReplacement[];
  workerModuleAliases: readonly string[];
}

/** Validates and normalizes public Cloudflare integration options. */
export function resolveCloudflareConfigOptions(
  options: CloudflareConfigOptions,
): ResolvedCloudflareConfigOptions {
  if (!options || options.constructor !== Object) {
    throw new TypeError(`${INTEGRATION_NAME}: options are required.`);
  }
  const replacements = resolveReplacements(options.replacements);
  const workerModuleAliases = resolveAliases(options.workerModuleAliases);
  if (replacements.length === 0 && workerModuleAliases.length === 0) {
    throw new TypeError(
      `${INTEGRATION_NAME}: configure at least one replacement or Worker module alias.`,
    );
  }
  const generatedConfig = options.generatedConfig ?? "../server/wrangler.json";
  if (
    !(generatedConfig instanceof URL) &&
    (typeof generatedConfig !== "string" || generatedConfig.trim().length === 0)
  ) {
    throw new TypeError(`${INTEGRATION_NAME}: generatedConfig must be a non-empty path or URL.`);
  }
  if (generatedConfig instanceof URL && generatedConfig.protocol !== "file:") {
    throw new TypeError(`${INTEGRATION_NAME}: generatedConfig URL must use the file: protocol.`);
  }
  return {
    environment: options.environment ?? process.env,
    generatedConfig,
    replacements,
    workerModuleAliases,
  };
}

function resolveReplacements(
  replacements: CloudflareConfigOptions["replacements"],
): readonly CloudflareResourceReplacement[] {
  if (replacements === undefined) return [];
  if (!Array.isArray(replacements)) {
    throw new TypeError(`${INTEGRATION_NAME}: replacements must be an array.`);
  }
  return replacements.map((replacement) => {
    if (!replacement || replacement.constructor !== Object) {
      throw new TypeError(`${INTEGRATION_NAME}: each replacement must be an object.`);
    }
    const placeholder = replacement.placeholder?.trim();
    const environmentVariable = replacement.environmentVariable?.trim();
    if (!placeholder || !environmentVariable) {
      throw new TypeError(
        `${INTEGRATION_NAME}: replacements require placeholder and environmentVariable.`,
      );
    }
    return { environmentVariable, placeholder };
  });
}

function resolveAliases(
  aliases: CloudflareConfigOptions["workerModuleAliases"],
): readonly string[] {
  if (aliases === undefined) return [];
  if (!Array.isArray(aliases)) {
    throw new TypeError(`${INTEGRATION_NAME}: workerModuleAliases must be an array.`);
  }
  const normalized = aliases.map((alias) => alias.trim());
  if (normalized.some((alias) => alias.length === 0)) {
    throw new TypeError(`${INTEGRATION_NAME}: Worker module aliases must be non-empty strings.`);
  }
  return [...new Set(normalized)];
}
