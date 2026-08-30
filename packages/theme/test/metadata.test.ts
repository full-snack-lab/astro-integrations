import { describe, expect, test } from "bun:test";
import { readThemeConfig } from "../src/schema.js";
import {
  createPageMetadata,
  createSiteJsonLd,
  formatThemeTitle,
  resolveLocalizedText,
} from "../src/runtime.js";

const fixture = new URL("./fixtures/theme.config.yaml", import.meta.url);

describe("theme metadata helpers", () => {
  test("resolves localized values with the configured fallback", async () => {
    const theme = await readThemeConfig(fixture);

    expect(resolveLocalizedText(theme.site.name, "fr", theme.i18n)).toBe("Le Labo Full Snack");
    expect(resolveLocalizedText(theme.site.description, "de", theme.i18n)).toBe(
      "Complete web foundations without application lock-in.",
    );
    expect(formatThemeTitle(theme, "Guides", "fr")).toBe("Guides — Le Labo Full Snack");
  });

  test("builds normalized canonical, robots, Open Graph, and Twitter metadata", async () => {
    const theme = await readThemeConfig(fixture);
    const metadata = createPageMetadata(theme, {
      description: "A reusable page description.",
      locale: "fr",
      pathname: "/guides/theme/",
      title: "Theme integration",
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        canonical: "https://example.com/guides/theme/",
        description: "A reusable page description.",
        robots: "index, follow",
        title: "Theme integration — Le Labo Full Snack",
      }),
    );
    expect(metadata.openGraph).toEqual(
      expect.objectContaining({
        image: "https://example.com/og-default.png",
        locale: "fr_FR",
        siteName: "Le Labo Full Snack",
        type: "website",
      }),
    );
    expect(metadata.twitter.card).toBe("summary_large_image");
  });

  test("derives a WebSite and owner JSON-LD graph", async () => {
    const theme = await readThemeConfig(fixture);
    const jsonLd = createSiteJsonLd(theme, "en");

    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@graph"]).toEqual([
      expect.objectContaining({
        "@id": "https://example.com/#website",
        "@type": "WebSite",
        name: "Full Snack Lab",
      }),
      expect.objectContaining({
        "@id": "https://example.com/#owner",
        "@type": "Organization",
        name: "Full Snack Lab",
      }),
    ]);
  });
});
