import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { parseThemeYaml, projectAstroI18n, readThemeConfig, themeSchema } from "../src/schema.js";

const fixture = new URL("./fixtures/theme.config.yaml", import.meta.url);
const jsonSchemaFile = new URL("../schema.json", import.meta.url);

describe("theme YAML contract", () => {
  test("parses and normalizes the complete theme document", async () => {
    const theme = await readThemeConfig(fixture);

    expect(theme.schemaVersion).toBe(1);
    expect(theme.site.url).toBe("https://example.com/");
    expect(theme.site.name).toEqual({ en: "Full Snack Lab", fr: "Le Labo Full Snack" });
    expect(theme.i18n.locales.en?.dir).toBe("ltr");
    expect(theme.seo.openGraph.type).toBe("website");
    expect(theme.structuredData.enabled).toBe(true);
  });

  test("publishes an editor schema for the YAML document", async () => {
    const jsonSchema = JSON.parse(await readFile(jsonSchemaFile, "utf8")) as {
      additionalProperties?: boolean;
      properties?: Record<string, unknown>;
    };

    expect(jsonSchema.additionalProperties).toBe(false);
    expect(jsonSchema.properties).toHaveProperty("site");
    expect(jsonSchema.properties).toHaveProperty("i18n");
    expect(jsonSchema.properties).toHaveProperty("seo");
    expect(jsonSchema.properties).toHaveProperty("structuredData");
  });

  test("projects build-shaping locale settings into Astro config", async () => {
    const theme = await readThemeConfig(fixture);

    expect(projectAstroI18n(theme.i18n)).toEqual({
      defaultLocale: "en",
      domains: {},
      fallback: { fr: "en" },
      locales: ["en", "fr"],
      routing: {
        fallbackType: "rewrite",
        prefixDefaultLocale: false,
        redirectToDefaultLocale: false,
      },
    });
  });

  test("rejects invalid title patterns and unknown locale fallbacks", async () => {
    const source = await readFile(fixture, "utf8");

    expect(() => parseThemeYaml(source.replace("{title} — {site}", "Static title"))).toThrow(
      "{title}",
    );
    const baseline = await readThemeConfig(fixture);
    expect(() =>
      themeSchema.parse({
        ...baseline,
        i18n: {
          ...baseline.i18n,
          fallback: { fr: "missing" },
        },
      }),
    ).toThrow("configured locale");
  });
});
