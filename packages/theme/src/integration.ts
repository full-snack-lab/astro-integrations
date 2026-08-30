import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { projectAstroI18n, readThemeConfig } from "./schema.js";
import { createThemeVirtualModulePlugin, VIRTUAL_MODULE_TYPES } from "./virtual-modules.js";

const INTEGRATION_NAME = "@fullsnacklab/astro-theme";
const DEFAULT_CONFIG_FILE = "./theme.config.yaml";

/** Optional runtime loader configuration. */
export interface ThemeRuntimeOptions {
  /** Consumer module whose default export satisfies `ThemeLoader`. */
  loader: string | URL;
}

/** Configures the YAML theme source and optional runtime adapter seam. */
export interface ThemeIntegrationOptions {
  /** Project-relative `.yaml` file containing the authoritative build snapshot. */
  configFile?: string | URL;
  /** Optional provider-neutral runtime loader used only by the server virtual module. */
  runtime?: ThemeRuntimeOptions;
}

/**
 * Loads validated YAML theme settings and exposes static and server virtual modules.
 *
 * @remarks Canonical origin and i18n topology are projected into Astro at build time.
 * Runtime loaders can only replace the mutable presentation document validated by
 * `runtimeThemeConfigSchema`; storage SDKs and synchronization policy remain application-owned.
 */
export function theme(options: ThemeIntegrationOptions = {}): AstroIntegration {
  validateOptions(options);

  return {
    name: INTEGRATION_NAME,
    hooks: {
      "astro:config:setup": async ({ addWatchFile, config, updateConfig }) => {
        const configFile = resolveConfigFile(options.configFile, config.root);
        addWatchFile(configFile);
        let baseline;
        try {
          baseline = await readThemeConfig(configFile);
        } catch (cause) {
          throw new Error(`${INTEGRATION_NAME}: failed to load ${fileURLToPath(configFile)}.`, {
            cause,
          });
        }
        const loaderModule = options.runtime
          ? resolveProjectModule(options.runtime.loader, config.root)
          : undefined;

        updateConfig({
          site: baseline.site.url,
          i18n: projectAstroI18n(baseline.i18n),
          vite: {
            plugins: [createThemeVirtualModulePlugin(baseline, loaderModule)],
          },
        });
      },
      "astro:config:done": ({ injectTypes }) => {
        injectTypes({
          content: VIRTUAL_MODULE_TYPES,
          filename: "theme-virtual-modules.d.ts",
        });
      },
    },
  };
}

function validateOptions(options: ThemeIntegrationOptions): void {
  if (!options || options.constructor !== Object) {
    throw new TypeError(`${INTEGRATION_NAME}: options must be an object.`);
  }
  if (options.runtime !== undefined) {
    if (!options.runtime || options.runtime.constructor !== Object) {
      throw new TypeError(`${INTEGRATION_NAME}: runtime must be an options object.`);
    }
    if (!(typeof options.runtime.loader === "string" || options.runtime.loader instanceof URL)) {
      throw new TypeError(`${INTEGRATION_NAME}: runtime.loader must be a module string or URL.`);
    }
  }
}

function resolveConfigFile(configFile: string | URL | undefined, root: URL): URL {
  let resolved: URL;
  try {
    resolved =
      configFile instanceof URL ? configFile : new URL(configFile ?? DEFAULT_CONFIG_FILE, root);
  } catch (cause) {
    throw new TypeError(`${INTEGRATION_NAME}: configFile must be a valid project-relative URL.`, {
      cause,
    });
  }
  if (!resolved.pathname.endsWith(".yaml")) {
    throw new TypeError(`${INTEGRATION_NAME}: configFile must use the .yaml extension.`);
  }
  return resolved;
}

function resolveProjectModule(module: string | URL, root: URL): string {
  if (module instanceof URL) return normalizeModulePath(fileURLToPath(module));
  if (module.startsWith("file:")) {
    try {
      return normalizeModulePath(fileURLToPath(new URL(module)));
    } catch (cause) {
      throw new TypeError(`${INTEGRATION_NAME}: runtime.loader is not a valid file URL.`, {
        cause,
      });
    }
  }
  if (module.startsWith(".")) {
    try {
      return normalizeModulePath(fileURLToPath(new URL(module, root)));
    } catch (cause) {
      throw new TypeError(`${INTEGRATION_NAME}: runtime.loader is not a valid project path.`, {
        cause,
      });
    }
  }
  return normalizeModulePath(module);
}

function normalizeModulePath(path: string): string {
  return path.replaceAll("\\", "/");
}
