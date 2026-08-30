import { theme } from "./integration.js";

export { theme };
export {
  createServerThemeModuleSource,
  createStaticThemeModuleSource,
  createThemeVirtualModulePlugin,
  SERVER_THEME_MODULE_ID,
  STATIC_THEME_MODULE_ID,
  VIRTUAL_MODULE_TYPES,
  type ThemeVirtualModulePlugin,
} from "./virtual-modules.js";
export {
  localizedTextSchema,
  parseThemeYaml,
  projectAstroI18n,
  readThemeConfig,
  runtimeThemeConfigSchema,
  themeSchema,
  type LocalizedText,
  type RuntimeThemeConfig,
  type ThemeConfig,
  type ThemeConfigInput,
} from "./schema.js";
export type { ThemeIntegrationOptions, ThemeRuntimeOptions } from "./integration.js";
export default theme;
