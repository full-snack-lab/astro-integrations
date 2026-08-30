# @fullsnacklab/astro-theme

Validated YAML site identity, internationalization, metadata, SEO, Open Graph, structured data, and provider-neutral runtime theme loading for Astro.

## Install

```sh
bun add @fullsnacklab/astro-theme
```

Create `theme.config.yaml` at the Astro project root. The package publishes `schema.json` for editor validation:

```yaml
# yaml-language-server: $schema=./node_modules/@fullsnacklab/astro-theme/schema.json
schemaVersion: 1
site:
  name: Example
  shortName: Example
  url: https://example.com
  description: An example Astro site.
contact:
  primary: mailto:hello@example.com
owner:
  type: organization
  name: Example
  url: https://example.com/about
i18n:
  defaultLocale: en
  locales:
    en:
      label: English
      lang: en-US
seo:
  title:
    default: Example
    pattern: "{title} — {site}"
```

Add the integration:

```js
import theme from "@fullsnacklab/astro-theme";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [theme()],
});
```

The integration validates the YAML, watches it during development, and projects build-shaping values into Astro:

- `site.url` becomes Astro's `site`;
- `i18n` becomes Astro's locale routing configuration;
- all validated settings become typed virtual modules.

## Virtual modules

Use the client-safe build snapshot from normal Astro components and modules:

```ts
import theme from "virtual:fullsnack-theme";
```

For request-time settings, use the server-only module:

```astro
---
import { getTheme } from "virtual:fullsnack-theme/server";
const theme = await getTheme({ request: Astro.request, locals: Astro.locals });
---
```

The server module caches one loader result per `Request`. A loader returning `null` explicitly selects the YAML fallback; loader errors are preserved.

## Runtime adapters without provider dependencies

The package defines the seam, while the application owns D1, Emdash, HTTP, authentication, and caching dependencies:

```ts
// src/theme-loader.ts
import { defineThemeLoader } from "@fullsnacklab/astro-theme/runtime";

export default defineThemeLoader(async ({ baseline, request }) => {
  const remote = await loadFromYourProvider(request);
  return remote ?? null;
});
```

```js
// astro.config.mjs
theme({
  runtime: { loader: "./src/theme-loader.ts" },
});
```

Runtime documents can replace presentation identity, contact, ownership, SEO, Open Graph, metadata, assets, and structured-data policy. They cannot change `site.url`, `schemaVersion`, or i18n route topology because Astro consumes those values while building routes and configuration.

## Explicit sync and seed

Use a consumer-owned sink for offline YAML → remote synchronization:

```ts
import { readThemeConfig } from "@fullsnacklab/astro-theme/schema";
import { defineThemeSink, syncTheme } from "@fullsnacklab/astro-theme/runtime";

const sink = defineThemeSink(async (runtimeTheme) => {
  await saveToYourProvider(runtimeTheme);
});

await syncTheme(await readThemeConfig(new URL("./theme.config.yaml", import.meta.url)), sink);
```

Synchronization is explicit rather than an integration side effect, so deployments never silently overwrite remote settings.

## Helpers and schemas

`@fullsnacklab/astro-theme/runtime` exports:

- `createPageMetadata()` for canonical, robots, Open Graph, and Twitter values;
- `createSiteJsonLd()` for a Schema.org `WebSite` and owner graph;
- `resolveLocalizedText()` and `formatThemeTitle()`;
- `defineThemeLoader()`, `defineThemeSink()`, `syncTheme()`, and `mergeRuntimeTheme()`.

`@fullsnacklab/astro-theme/schema` exports the Zod schemas, YAML parser, Astro i18n projection, and TypeScript document types. The checked-in JSON Schema is available at `@fullsnacklab/astro-theme/schema.json`.

## Ownership boundary

The package owns normalized site settings and reusable derivation. Layout markup, `<head>` rendering, page-specific descriptions, remote credentials, D1 queries, Emdash models, conflict policy, and deployment adapters remain application-owned.

## License

MIT
