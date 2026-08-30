import type { CloudflareBuildEnvironment, CloudflareResourceReplacement } from "./options.js";

const INTEGRATION_NAME = "@fullsnacklab/astro-cloudflare";

/** Replaces account-specific placeholders without changing the tracked source config. */
export function replaceWranglerPlaceholders(
  source: string,
  replacements: readonly CloudflareResourceReplacement[],
  environment: CloudflareBuildEnvironment,
): string {
  const seen = new Set<string>();
  for (const replacement of replacements) {
    if (seen.has(replacement.placeholder)) {
      throw new TypeError(`${INTEGRATION_NAME}: duplicate placeholder ${replacement.placeholder}.`);
    }
    seen.add(replacement.placeholder);
  }

  const missing = replacements
    .filter(
      ({ environmentVariable, placeholder }) =>
        source.includes(placeholder) && !environment[environmentVariable],
    )
    .map(({ environmentVariable }) => environmentVariable)
    .sort();
  if (missing.length > 0) {
    throw new Error(`${INTEGRATION_NAME}: missing environment variables: ${missing.join(", ")}.`);
  }

  let output = source;
  for (const { environmentVariable, placeholder } of replacements) {
    const value = environment[environmentVariable];
    if (value) output = output.replaceAll(placeholder, value);
  }
  return output;
}
