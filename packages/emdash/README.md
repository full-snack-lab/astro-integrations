# @fullsnacklab/astro-emdash

Friendly persistence presets for the official [Emdash](https://emdashcms.com/) Astro integration. The package removes repeated local and Cloudflare adapter wiring while leaving collections, plugins, authentication, routes, and other CMS policy with Emdash and the application.

## Local and Node preset

Install the wrapper and Emdash:

```sh
bun add @fullsnacklab/astro-emdash emdash
```

The default export uses local libSQL, filesystem media storage, and an in-memory object cache:

```ts
import emdash from "@fullsnacklab/astro-emdash";
import { defineConfig } from "astro/config";

export default defineConfig({
  integrations: [emdash()],
});
```

The defaults are:

- database URL: `file:./data.db`;
- media directory: `./uploads`;
- media URL: `/_emdash/api/media/file`;
- in-memory cache TTL: 600 seconds.

Override only the values your application needs:

```ts
emdash({
  database: { url: "libsql://database.example.com", authToken: process.env.TURSO_AUTH_TOKEN },
  storage: { directory: "./media", baseUrl: "/media" },
  cache: false,
  emdash: {
    siteUrl: "https://example.com",
    images: false,
  },
});
```

The nested `emdash` object forwards advanced upstream options unchanged. Persistence fields remain owned by the preset; use `emdash/astro` directly when you need different adapters.

## Cloudflare preset

Install Emdash’s official Cloudflare adapters when using the subpath:

```sh
bun add @fullsnacklab/astro-emdash emdash @emdash-cms/cloudflare @astrojs/cloudflare
```

```ts
import cloudflare from "@astrojs/cloudflare";
import emdash from "@fullsnacklab/astro-emdash/cloudflare";
import { defineConfig } from "astro/config";

export default defineConfig({
  adapter: cloudflare(),
  integrations: [emdash()],
  output: "server",
});
```

The Cloudflare preset composes Emdash’s official adapters with conventional bindings:

- D1 database: `DB`;
- R2 media bucket: `MEDIA`;
- KV object cache: `CACHE`.

Bindings and adapter behavior remain explicit when needed:

```ts
emdash({
  bindings: {
    database: "CONTENT_DB",
    media: "ASSETS",
    cache: "CONTENT_CACHE",
  },
  database: { session: "auto" },
  storage: { publicUrl: "https://media.example.com" },
  cache: { defaultTtl: 300, keyPrefix: "site:" },
  emdash: { siteUrl: "https://example.com" },
});
```

Set `cache: false` to leave object caching application-owned. The wrapper does not configure Wrangler resources, wrap `@astrojs/cloudflare`, or own account identifiers; combine it with `@fullsnacklab/astro-cloudflare` when those build seams are useful.

## API

Root export:

- `emdashLocal(options?)` — default and named local integration factory.
- `createLocalEmdashConfig(options?)` — returns the composed upstream Emdash config.

Cloudflare subpath:

- `emdashCloudflare(options?)` — default and named Cloudflare integration factory.
- `createCloudflareEmdashConfig(options?)` — returns the composed upstream Emdash config.

## License

MIT
