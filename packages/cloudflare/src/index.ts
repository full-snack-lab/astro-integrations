import { cloudflareConfig } from "./integration.js";

export { cloudflareConfig };
export type {
  CloudflareBuildEnvironment,
  CloudflareConfigOptions,
  CloudflareResourceReplacement,
} from "./options.js";
export { replaceWranglerPlaceholders } from "./wrangler-config.js";
export default cloudflareConfig;
