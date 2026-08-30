import { afterAll, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { AstroConfig, AstroIntegration } from "astro";
import theme, {
  createServerThemeModuleSource,
  createStaticThemeModuleSource,
  SERVER_THEME_MODULE_ID,
  STATIC_THEME_MODULE_ID,
  theme as createThemeIntegration,
  VIRTUAL_MODULE_TYPES,
} from "../src/index.js";
import { readThemeConfig } from "../src/schema.js";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "astro-theme-"));
const root = pathToFileURL(`${temporaryDirectory}/`);
const fixture = new URL("./fixtures/theme.config.yaml", import.meta.url);
writeFileSync(new URL("theme.config.yaml", root), readFileSync(fixture, "utf8"));

afterAll(() => rmSync(temporaryDirectory, { force: true, recursive: true }));

type SetupContext = Parameters<NonNullable<AstroIntegration["hooks"]["astro:config:setup"]>>[0];
type DoneContext = Parameters<NonNullable<AstroIntegration["hooks"]["astro:config:done"]>>[0];

function setupContext() {
  mkdirSync(root, { recursive: true });
  const addWatchFile = mock(() => undefined);
  const updateConfig = mock(() => ({}) as AstroConfig);
  const context = {
    addWatchFile,
    config: { root },
    updateConfig,
  } as unknown as SetupContext;
  return { addWatchFile, context, updateConfig };
}

async function runSetup(integration: AstroIntegration, context: SetupContext): Promise<void> {
  const hook = integration.hooks["astro:config:setup"];
  if (!hook) throw new Error("Expected astro:config:setup hook");
  await hook(context);
}

describe("@fullsnacklab/astro-theme", () => {
  test("exports the integration as both the default and named factory", () => {
    expect(theme).toBe(createThemeIntegration);
  });

  test("loads YAML, watches it, and projects build settings into Astro", async () => {
    const integration = theme();
    const setup = setupContext();

    await runSetup(integration, setup.context);

    expect(setup.addWatchFile).toHaveBeenCalledWith(new URL("theme.config.yaml", root));
    expect(setup.updateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        i18n: expect.objectContaining({ defaultLocale: "en", locales: ["en", "fr"] }),
        site: "https://example.com/",
        vite: { plugins: [expect.objectContaining({ name: "fullsnack-theme-virtual-modules" })] },
      }),
    );
  });

  test("creates separate static and server virtual module sources", async () => {
    const baseline = await readThemeConfig(fixture);
    const staticSource = createStaticThemeModuleSource(baseline);
    const serverSource = createServerThemeModuleSource(baseline, "./src/theme-loader.ts");

    expect(STATIC_THEME_MODULE_ID).toBe("virtual:fullsnack-theme");
    expect(SERVER_THEME_MODULE_ID).toBe("virtual:fullsnack-theme/server");
    expect(staticSource).toContain('const theme = {"schemaVersion":1');
    expect(staticSource).toContain("export default theme");
    expect(staticSource).not.toContain("theme-loader");
    expect(serverSource).toContain('from "./src/theme-loader.ts"');
    expect(serverSource).toContain("mergeRuntimeTheme");
    expect(serverSource).toContain("loadTheme({ ...context, baseline })");
  });

  test("injects ambient declarations for both virtual modules", async () => {
    const injectTypes = mock(() => undefined);
    const integration = theme();
    const hook = integration.hooks["astro:config:done"];
    if (!hook) throw new Error("Expected astro:config:done hook");

    await hook({ injectTypes } as unknown as DoneContext);

    expect(VIRTUAL_MODULE_TYPES).toContain('declare module "virtual:fullsnack-theme"');
    expect(VIRTUAL_MODULE_TYPES).toContain('declare module "virtual:fullsnack-theme/server"');
    expect(injectTypes).toHaveBeenCalledWith({
      content: VIRTUAL_MODULE_TYPES,
      filename: "theme-virtual-modules.d.ts",
    });
  });
});
