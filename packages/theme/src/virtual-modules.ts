import type { ThemeConfig } from "./schema.js";

/** Client-safe virtual module containing the validated YAML snapshot. */
export const STATIC_THEME_MODULE_ID = "virtual:fullsnack-theme";

/** Server-only virtual module that resolves an optional consumer loader. */
export const SERVER_THEME_MODULE_ID = "virtual:fullsnack-theme/server";

const RESOLVED_STATIC_THEME_MODULE_ID = `\0${STATIC_THEME_MODULE_ID}`;
const RESOLVED_SERVER_THEME_MODULE_ID = `\0${SERVER_THEME_MODULE_ID}`;

/** Minimal Vite plugin contract used to expose the generated modules. */
export interface ThemeVirtualModulePlugin {
  name: string;
  resolveId(id: string): string | undefined;
  load(id: string): string | undefined;
}

/** Ambient declarations injected into the consuming Astro project. */
export const VIRTUAL_MODULE_TYPES = `declare module "${STATIC_THEME_MODULE_ID}" {
  const theme: import("@fullsnacklab/astro-theme/schema").ThemeConfig;
  export { theme };
  export default theme;
}

declare module "${SERVER_THEME_MODULE_ID}" {
  type RuntimeContext = Omit<import("@fullsnacklab/astro-theme/runtime").ThemeLoadContext, "baseline">;
  export function getTheme(context?: RuntimeContext): Promise<import("@fullsnacklab/astro-theme/schema").ThemeConfig>;
}
`;

/** Serializes the immutable YAML snapshot into a client-safe ESM module. */
export function createStaticThemeModuleSource(theme: ThemeConfig): string {
  return `const theme = ${JSON.stringify(theme)};\nexport { theme };\nexport default theme;\n`;
}

/** Creates the server ESM module that applies a consumer-owned loader when configured. */
export function createServerThemeModuleSource(theme: ThemeConfig, loaderModule?: string): string {
  const staticImport = `import baseline from ${JSON.stringify(STATIC_THEME_MODULE_ID)};`;
  if (!loaderModule) {
    return `${staticImport}\nexport async function getTheme() { return baseline; }\n`;
  }

  return `${staticImport}
import loadTheme from ${JSON.stringify(loaderModule)};
import { mergeRuntimeTheme } from "@fullsnacklab/astro-theme/runtime";

const requestCache = new WeakMap();

async function resolveTheme(context) {
  const runtime = await loadTheme({ ...context, baseline });
  return runtime === null ? baseline : mergeRuntimeTheme(baseline, runtime);
}

export function getTheme(context = {}) {
  if (!context.request) return resolveTheme(context);
  const cached = requestCache.get(context.request);
  if (cached) return cached;
  const pending = resolveTheme(context);
  requestCache.set(context.request, pending);
  return pending;
}
`;
}

/** Creates the Vite plugin that serves static and server theme modules. */
export function createThemeVirtualModulePlugin(
  theme: ThemeConfig,
  loaderModule?: string,
): ThemeVirtualModulePlugin {
  const staticSource = createStaticThemeModuleSource(theme);
  const serverSource = createServerThemeModuleSource(theme, loaderModule);
  return {
    name: "fullsnack-theme-virtual-modules",
    resolveId(id: string): string | undefined {
      if (id === STATIC_THEME_MODULE_ID) return RESOLVED_STATIC_THEME_MODULE_ID;
      if (id === SERVER_THEME_MODULE_ID) return RESOLVED_SERVER_THEME_MODULE_ID;
      return undefined;
    },
    load(id: string): string | undefined {
      if (id === RESOLVED_STATIC_THEME_MODULE_ID) return staticSource;
      if (id === RESOLVED_SERVER_THEME_MODULE_ID) return serverSource;
      return undefined;
    },
  };
}
