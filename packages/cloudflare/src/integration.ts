import { readFile, writeFile } from "node:fs/promises";
import type { AstroIntegration } from "astro";
import { resolveCloudflareConfigOptions, type CloudflareConfigOptions } from "./options.js";
import { replaceWranglerPlaceholders } from "./wrangler-config.js";

const INTEGRATION_NAME = "@fullsnacklab/astro-cloudflare";

/**
 * Adds Cloudflare Worker-module aliases and patches adapter-generated Wrangler output.
 *
 * @remarks The official adapter, bindings, persistence services, and deployment policy
 * remain application-owned.
 */
export function cloudflareConfig(options: CloudflareConfigOptions): AstroIntegration {
  const resolved = resolveCloudflareConfigOptions(options);
  return {
    name: INTEGRATION_NAME,
    hooks: {
      "astro:config:setup": ({ updateConfig }) => {
        if (resolved.workerModuleAliases.length === 0) return;
        updateConfig({
          vite: {
            resolve: {
              alias: Object.fromEntries(
                resolved.workerModuleAliases.map((alias) => [alias, "cloudflare:workers"]),
              ),
            },
          },
        });
      },
      "astro:build:done": async ({ dir }) => {
        if (resolved.replacements.length === 0) return;
        const configUrl =
          resolved.generatedConfig instanceof URL
            ? resolved.generatedConfig
            : new URL(resolved.generatedConfig, dir);
        const source = await readFile(configUrl, "utf8");
        const output = replaceWranglerPlaceholders(
          source,
          resolved.replacements,
          resolved.environment,
        );
        await writeFile(configUrl, output, "utf8");
      },
    },
  };
}
