import { describe, expect, mock, test } from "bun:test";
import { readThemeConfig } from "../src/schema.js";
import {
  defineThemeLoader,
  defineThemeSink,
  mergeRuntimeTheme,
  runtimeThemeConfigSchema,
  syncTheme,
  toRuntimeTheme,
} from "../src/runtime.js";

const fixture = new URL("./fixtures/theme.config.yaml", import.meta.url);

describe("theme runtime adapter seam", () => {
  test("extracts only settings that may change without rebuilding Astro", async () => {
    const baseline = await readThemeConfig(fixture);
    const runtime = toRuntimeTheme(baseline);

    expect(runtime.site).not.toHaveProperty("url");
    expect(runtime).not.toHaveProperty("i18n");
    expect(runtime.site.name).toEqual(baseline.site.name);
    expect(runtime.seo).toEqual(baseline.seo);
  });

  test("merges validated runtime settings without changing build topology", async () => {
    const baseline = await readThemeConfig(fixture);
    const runtime = runtimeThemeConfigSchema.parse({
      ...toRuntimeTheme(baseline),
      site: {
        ...toRuntimeTheme(baseline).site,
        name: "Remote name",
      },
    });

    const merged = mergeRuntimeTheme(baseline, runtime);

    expect(merged.site.name).toBe("Remote name");
    expect(merged.site.url).toBe("https://example.com/");
    expect(merged.i18n).toEqual(baseline.i18n);
    expect(() =>
      runtimeThemeConfigSchema.parse({
        ...runtime,
        site: { ...runtime.site, url: "https://evil.test" },
      }),
    ).toThrow();
  });

  test("keeps loaders and sinks consumer-owned while providing generic sync", async () => {
    const baseline = await readThemeConfig(fixture);
    const loader = defineThemeLoader(async ({ baseline: local }) => toRuntimeTheme(local));
    const write = mock(async () => undefined);
    const sink = defineThemeSink(write);

    expect(await loader({ baseline })).toEqual(toRuntimeTheme(baseline));
    await syncTheme(baseline, sink);
    expect(write).toHaveBeenCalledWith(toRuntimeTheme(baseline));
  });
});
