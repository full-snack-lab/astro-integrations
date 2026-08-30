import { readFile } from "node:fs/promises";
import type { AstroConfig } from "astro";
import { parse } from "yaml";
import { z } from "zod";

const nonEmptyText = z.string().trim().min(1);
const localeKey = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/);
const absoluteHttpUrl = z
  .url()
  .refine((value) => value.startsWith("http://") || value.startsWith("https://"), {
    message: "must use http or https",
  })
  .transform((value) => URL.parse(value)?.toString() ?? value);
const publicResource = nonEmptyText.refine(
  (value) => value.startsWith("/") || value.startsWith("http://") || value.startsWith("https://"),
  "must be a root-relative or absolute HTTP URL",
);

const internalLocalizedTextSchema = z.union([
  nonEmptyText,
  z
    .record(localeKey, nonEmptyText)
    .refine((value) => Object.keys(value).length > 0, "must define at least one locale"),
]);

/** A value shared by every locale or keyed by configured locale. */
export type LocalizedText = z.output<typeof internalLocalizedTextSchema>;

/** Decodes a shared or locale-specific text value. */
export const localizedTextSchema: typeof internalLocalizedTextSchema = internalLocalizedTextSchema;

const localeSchema = z
  .object({
    label: nonEmptyText,
    lang: localeKey.optional(),
    dir: z.enum(["ltr", "rtl"]).default("ltr"),
    codes: z.array(localeKey).nonempty().optional(),
  })
  .strict();

const i18nRoutingSchema = z.union([
  z.literal("manual"),
  z
    .object({
      prefixDefaultLocale: z.boolean().default(false),
      redirectToDefaultLocale: z.boolean().default(false),
      fallbackType: z.enum(["redirect", "rewrite"]).default("redirect"),
    })
    .strict(),
]);

const i18nSchema = z
  .object({
    defaultLocale: localeKey,
    locales: z
      .record(localeKey, localeSchema)
      .refine((value) => Object.keys(value).length > 0, "must configure at least one locale"),
    fallback: z.record(localeKey, localeKey).default({}),
    domains: z.record(localeKey, absoluteHttpUrl).default({}),
    routing: i18nRoutingSchema.default({
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
      fallbackType: "redirect",
    }),
  })
  .strict();

const siteSchema = z
  .object({
    name: internalLocalizedTextSchema,
    shortName: internalLocalizedTextSchema,
    url: absoluteHttpUrl,
    description: internalLocalizedTextSchema,
    tagline: internalLocalizedTextSchema.optional(),
    repository: absoluteHttpUrl.optional(),
    themeColor: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    themeColorDark: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
  })
  .strict();

const contactSchema = z
  .object({
    primary: z.url(),
    security: z.url().optional(),
    support: z.url().optional(),
    email: z.email().optional(),
    phone: nonEmptyText.optional(),
    social: z.record(nonEmptyText, z.url()).default({}),
  })
  .strict();

const ownerSchema = z
  .object({
    type: z.enum(["organization", "person"]),
    name: internalLocalizedTextSchema,
    url: absoluteHttpUrl.optional(),
    email: z.email().optional(),
    logo: publicResource.optional(),
    sameAs: z.array(absoluteHttpUrl).default([]),
  })
  .strict();

const titleSchema = z
  .object({
    default: internalLocalizedTextSchema,
    pattern: nonEmptyText.refine((value) => value.includes("{title}"), {
      message: "must contain {title}",
    }),
  })
  .strict();

const openGraphImageSchema = z
  .object({
    src: publicResource,
    alt: internalLocalizedTextSchema,
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  })
  .strict();

const twitterSchema = z
  .object({
    card: z.enum(["summary", "summary_large_image"]).default("summary_large_image"),
    site: nonEmptyText.optional(),
    creator: nonEmptyText.optional(),
  })
  .strict();

const openGraphSchema = z
  .object({
    type: z.enum(["website", "profile"]).default("website"),
    image: openGraphImageSchema.optional(),
    twitter: twitterSchema.default({ card: "summary_large_image" }),
  })
  .strict();

const seoSchema = z
  .object({
    title: titleSchema,
    robots: z
      .object({
        index: z.boolean().default(true),
        follow: z.boolean().default(true),
      })
      .strict()
      .default({ index: true, follow: true }),
    openGraph: openGraphSchema.default({
      type: "website",
      twitter: { card: "summary_large_image" },
    }),
  })
  .strict();

const metadataSchema = z
  .object({
    applicationName: internalLocalizedTextSchema.optional(),
    referrer: z
      .enum([
        "no-referrer",
        "no-referrer-when-downgrade",
        "origin",
        "origin-when-cross-origin",
        "same-origin",
        "strict-origin",
        "strict-origin-when-cross-origin",
        "unsafe-url",
      ])
      .optional(),
    keywords: z.array(internalLocalizedTextSchema).default([]),
    custom: z.record(nonEmptyText, nonEmptyText).default({}),
  })
  .strict()
  .default({ keywords: [], custom: {} });

const assetsSchema = z
  .object({
    manifest: publicResource.optional(),
    icons: z
      .array(
        z
          .object({
            href: publicResource,
            type: nonEmptyText.optional(),
            sizes: nonEmptyText.optional(),
          })
          .strict(),
      )
      .default([]),
  })
  .strict()
  .default({ icons: [] });

const structuredDataSchema = z
  .object({
    enabled: z.boolean().default(true),
    websiteId: nonEmptyText.default("#website"),
    ownerId: nonEmptyText.default("#owner"),
  })
  .strict()
  .default({ enabled: true, websiteId: "#website", ownerId: "#owner" });

const internalRuntimeThemeConfigSchema = z
  .object({
    site: siteSchema.omit({ url: true }),
    contact: contactSchema,
    owner: ownerSchema,
    seo: seoSchema,
    metadata: metadataSchema,
    assets: assetsSchema,
    structuredData: structuredDataSchema,
  })
  .strict();

/** Runtime-overridable theme settings that cannot alter Astro's built topology. */
export type RuntimeThemeConfig = z.output<typeof internalRuntimeThemeConfigSchema>;

/** Validates settings returned by a remote runtime loader. */
export const runtimeThemeConfigSchema: typeof internalRuntimeThemeConfigSchema =
  internalRuntimeThemeConfigSchema;

const internalThemeSchema = z
  .object({
    schemaVersion: z.literal(1),
    site: siteSchema,
    contact: contactSchema,
    owner: ownerSchema,
    i18n: i18nSchema,
    seo: seoSchema,
    metadata: metadataSchema,
    assets: assetsSchema,
    structuredData: structuredDataSchema,
  })
  .strict()
  .superRefine((theme, context) => {
    const locales = new Set(Object.keys(theme.i18n.locales));
    if (!locales.has(theme.i18n.defaultLocale)) {
      context.addIssue({
        code: "custom",
        path: ["i18n", "defaultLocale"],
        message: "must name a configured locale",
      });
    }
    for (const [locale, fallback] of Object.entries(theme.i18n.fallback)) {
      if (!locales.has(locale) || !locales.has(fallback)) {
        context.addIssue({
          code: "custom",
          path: ["i18n", "fallback", locale],
          message: "must map configured locales to a configured locale",
        });
      }
    }
    for (const locale of Object.keys(theme.i18n.domains)) {
      if (!locales.has(locale)) {
        context.addIssue({
          code: "custom",
          path: ["i18n", "domains", locale],
          message: "must name a configured locale",
        });
      }
    }
  });

/** Candidate YAML theme document before defaults and URL normalization. */
export type ThemeConfigInput = z.input<typeof internalThemeSchema>;

/** Validated theme document consumed by Astro and runtime helpers. */
export type ThemeConfig = z.output<typeof internalThemeSchema>;

/** Authoritative schema for local YAML and synchronized theme documents. */
export const themeSchema: typeof internalThemeSchema = internalThemeSchema;

/** Parses and validates a YAML theme document. */
export function parseThemeYaml(source: string): ThemeConfig {
  return themeSchema.parse(parse(source));
}

/** Reads and validates a YAML theme document from a file URL. */
export async function readThemeConfig(file: URL): Promise<ThemeConfig> {
  return parseThemeYaml(await readFile(file, "utf8"));
}

/** Projects immutable locale topology into Astro's i18n configuration. */
export function projectAstroI18n(i18n: ThemeConfig["i18n"]): AstroConfig["i18n"] {
  const locales = Object.entries(i18n.locales).map(([path, locale]) => {
    if (!locale.codes) return path;
    const [firstCode, ...remainingCodes] = locale.codes;
    if (!firstCode) throw new TypeError(`Locale group ${path} must contain at least one code.`);
    const codes: [string, ...string[]] = [firstCode, ...remainingCodes];
    return { path, codes };
  });
  return {
    defaultLocale: i18n.defaultLocale,
    locales,
    fallback: i18n.fallback,
    domains: i18n.domains,
    routing: i18n.routing,
  };
}
