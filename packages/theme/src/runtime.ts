import {
  runtimeThemeConfigSchema,
  type LocalizedText,
  type RuntimeThemeConfig,
  type ThemeConfig,
} from "./schema.js";

/** Context passed to a consumer-owned runtime loader. */
export interface ThemeLoadContext {
  /** Validated YAML fallback and immutable build configuration. */
  baseline: ThemeConfig;
  /** Current request when loading during on-demand rendering. */
  request?: Request;
  /** Application locals when the caller chooses to expose them. */
  locals?: object;
}

/** Provider-neutral runtime theme loader. Returning `null` selects the YAML fallback. */
export type ThemeLoader = (
  context: ThemeLoadContext,
) => Promise<RuntimeThemeConfig | null> | RuntimeThemeConfig | null;

/** Provider-neutral destination for explicit seed or synchronization commands. */
export type ThemeSink = (theme: RuntimeThemeConfig) => Promise<void> | void;

/** Preserves the loader's exact type while documenting its integration seam. */
export function defineThemeLoader(loader: ThemeLoader): ThemeLoader {
  return loader;
}

/** Preserves the sink's exact type while documenting its synchronization seam. */
export function defineThemeSink(sink: ThemeSink): ThemeSink {
  return sink;
}

/** Extracts the settings that may change without rebuilding Astro. */
export function toRuntimeTheme(theme: ThemeConfig): RuntimeThemeConfig {
  const { url: _immutableUrl, ...site } = theme.site;
  return {
    site,
    contact: theme.contact,
    owner: theme.owner,
    seo: theme.seo,
    metadata: theme.metadata,
    assets: theme.assets,
    structuredData: theme.structuredData,
  };
}

/** Validates and applies runtime settings while preserving build-shaping YAML values. */
export function mergeRuntimeTheme(
  baseline: ThemeConfig,
  candidate: RuntimeThemeConfig,
): ThemeConfig {
  const runtime = runtimeThemeConfigSchema.parse(candidate);
  return {
    ...baseline,
    ...runtime,
    site: {
      ...runtime.site,
      url: baseline.site.url,
    },
    i18n: baseline.i18n,
    schemaVersion: baseline.schemaVersion,
  };
}

/** Sends the mutable portion of a validated YAML theme to a consumer-owned sink. */
export async function syncTheme(theme: ThemeConfig, sink: ThemeSink): Promise<void> {
  await sink(toRuntimeTheme(theme));
}

/** Resolves locale-specific text through configured fallback and the default locale. */
export function resolveLocalizedText(
  value: LocalizedText,
  locale: string | undefined,
  i18n: ThemeConfig["i18n"],
): string {
  if (typeof value === "string") return value;

  const requestedLocale = locale ?? i18n.defaultLocale;
  const visited = new Set<string>();
  let currentLocale: string | undefined = requestedLocale;
  while (currentLocale && !visited.has(currentLocale)) {
    const localized = value[currentLocale];
    if (localized) return localized;
    visited.add(currentLocale);
    currentLocale = i18n.fallback[currentLocale];
  }

  const defaultValue = value[i18n.defaultLocale];
  if (defaultValue) return defaultValue;
  throw new TypeError(`Localized value does not define the default locale ${i18n.defaultLocale}.`);
}

/** Applies the configured title pattern to a page title and localized site name. */
export function formatThemeTitle(theme: ThemeConfig, pageTitle?: string, locale?: string): string {
  const title = pageTitle ?? resolveLocalizedText(theme.seo.title.default, locale, theme.i18n);
  const siteName = resolveLocalizedText(theme.site.name, locale, theme.i18n);
  return theme.seo.title.pattern.replaceAll("{title}", title).replaceAll("{site}", siteName);
}

/** Page-specific inputs merged with the theme's SEO defaults. */
export interface PageMetadataInput {
  title?: string;
  description?: string;
  pathname?: string;
  canonical?: string;
  image?: string;
  locale?: string;
  noindex?: boolean;
  nofollow?: boolean;
}

/** Normalized Open Graph fields suitable for rendering as `<meta>` elements. */
export interface OpenGraphMetadata {
  type: "profile" | "website";
  siteName: string;
  title: string;
  description: string;
  url: string;
  locale: string;
  alternateLocales: string[];
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
}

/** Normalized Twitter card fields suitable for rendering as `<meta>` elements. */
export interface TwitterMetadata {
  card: "summary" | "summary_large_image";
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
  site?: string;
  creator?: string;
}

/** Complete normalized metadata for a page head renderer. */
export interface PageMetadata {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  applicationName?: string;
  referrer?: ThemeConfig["metadata"]["referrer"];
  keywords: string[];
  custom: Readonly<Record<string, string>>;
  openGraph: OpenGraphMetadata;
  twitter: TwitterMetadata;
}

/** Builds canonical, robots, Open Graph, Twitter, and generic metadata for a page. */
export function createPageMetadata(
  theme: ThemeConfig,
  input: PageMetadataInput = {},
): PageMetadata {
  const locale = input.locale ?? theme.i18n.defaultLocale;
  const title = formatThemeTitle(theme, input.title, locale);
  const description =
    input.description ?? resolveLocalizedText(theme.site.description, locale, theme.i18n);
  const canonical = input.canonical
    ? new URL(input.canonical, theme.site.url).toString()
    : new URL(input.pathname ?? "/", theme.site.url).toString();
  const configuredImage = input.image ?? theme.seo.openGraph.image?.src;
  const image = configuredImage ? new URL(configuredImage, theme.site.url).toString() : undefined;
  const imageAlt = theme.seo.openGraph.image
    ? resolveLocalizedText(theme.seo.openGraph.image.alt, locale, theme.i18n)
    : undefined;
  const index = input.noindex ? false : theme.seo.robots.index;
  const follow = input.nofollow ? false : theme.seo.robots.follow;
  const localeCode = openGraphLocale(theme, locale);
  const alternateLocales = Object.keys(theme.i18n.locales)
    .filter((candidate) => candidate !== locale)
    .map((candidate) => openGraphLocale(theme, candidate));

  return {
    title,
    description,
    canonical,
    robots: `${index ? "index" : "noindex"}, ${follow ? "follow" : "nofollow"}`,
    applicationName: theme.metadata.applicationName
      ? resolveLocalizedText(theme.metadata.applicationName, locale, theme.i18n)
      : undefined,
    referrer: theme.metadata.referrer,
    keywords: theme.metadata.keywords.map((keyword) =>
      resolveLocalizedText(keyword, locale, theme.i18n),
    ),
    custom: theme.metadata.custom,
    openGraph: {
      type: theme.seo.openGraph.type,
      siteName: resolveLocalizedText(theme.site.name, locale, theme.i18n),
      title,
      description,
      url: canonical,
      locale: localeCode,
      alternateLocales,
      image,
      imageAlt,
      imageWidth: theme.seo.openGraph.image?.width,
      imageHeight: theme.seo.openGraph.image?.height,
    },
    twitter: {
      card: theme.seo.openGraph.twitter.card,
      title,
      description,
      image,
      imageAlt,
      site: theme.seo.openGraph.twitter.site,
      creator: theme.seo.openGraph.twitter.creator,
    },
  };
}

/** JSON-LD node generated for a website or its owner. */
export type SiteJsonLdNode = Readonly<Record<string, unknown>>;

/** Minimal Schema.org graph derived from normalized theme identity. */
export interface SiteJsonLd {
  "@context": "https://schema.org";
  "@graph": SiteJsonLdNode[];
}

/** Builds a provider-neutral Schema.org WebSite and owner graph. */
export function createSiteJsonLd(theme: ThemeConfig, locale?: string): SiteJsonLd {
  if (!theme.structuredData.enabled) {
    return { "@context": "https://schema.org", "@graph": [] };
  }

  const siteRoot = theme.site.url;
  const ownerId = new URL(theme.structuredData.ownerId, siteRoot).toString();
  const websiteId = new URL(theme.structuredData.websiteId, siteRoot).toString();
  const owner = {
    "@type": theme.owner.type === "organization" ? "Organization" : "Person",
    "@id": ownerId,
    name: resolveLocalizedText(theme.owner.name, locale, theme.i18n),
    ...(theme.owner.url ? { url: theme.owner.url } : {}),
    ...(theme.owner.email ? { email: theme.owner.email } : {}),
    ...(theme.owner.logo ? { logo: new URL(theme.owner.logo, siteRoot).toString() } : {}),
    ...(theme.owner.sameAs.length > 0 ? { sameAs: theme.owner.sameAs } : {}),
  };
  const website = {
    "@type": "WebSite",
    "@id": websiteId,
    name: resolveLocalizedText(theme.site.name, locale, theme.i18n),
    description: resolveLocalizedText(theme.site.description, locale, theme.i18n),
    url: siteRoot,
    inLanguage: locale ?? theme.i18n.defaultLocale,
    publisher: { "@id": ownerId },
  };

  return {
    "@context": "https://schema.org",
    "@graph": [website, owner],
  };
}

function openGraphLocale(theme: ThemeConfig, locale: string): string {
  const [language, ...subtags] = (theme.i18n.locales[locale]?.lang ?? locale).split("-");
  return [
    language?.toLowerCase() ?? locale.toLowerCase(),
    ...subtags.map((subtag) => (subtag.length === 2 ? subtag.toUpperCase() : subtag)),
  ].join("_");
}

export { runtimeThemeConfigSchema } from "./schema.js";
export type { RuntimeThemeConfig, ThemeConfig } from "./schema.js";
