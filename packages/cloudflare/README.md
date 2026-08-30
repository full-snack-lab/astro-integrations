# @fullsnacklab/astro-cloudflare

Focused Cloudflare build seams for Astro Worker applications. It complements `@astrojs/cloudflare`; it does not wrap the official adapter or own bindings, persistence services, or deployment policy.

## Install

```sh
bun add @fullsnacklab/astro-cloudflare @astrojs/cloudflare
```

## Worker module aliases

A shared Node and Cloudflare application can keep an application-owned shim import and replace it only in the Worker build:

```ts
import cloudflareAdapter from "@astrojs/cloudflare";
import cloudflareConfig from "@fullsnacklab/astro-cloudflare";
import { defineConfig } from "astro/config";

export default defineConfig({
  adapter: cloudflareAdapter(),
  integrations: [
    cloudflareConfig({
      workerModuleAliases: ["#cloudflare-workers"],
    }),
  ],
  output: "server",
});
```

The alias resolves to `cloudflare:workers` only in this build. The application's Node configuration can continue resolving `#cloudflare-workers` to its own empty shim.

## Generated Wrangler replacements

Keep account-specific resource identifiers out of the tracked Wrangler configuration:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_id": "REPLACE_WITH_D1_DATABASE_ID",
    },
  ],
}
```

Then replace the copied placeholder after Astro's Cloudflare adapter builds:

```ts
cloudflareConfig({
  replacements: [
    {
      placeholder: "REPLACE_WITH_D1_DATABASE_ID",
      environmentVariable: "CF_D1_DATABASE_ID",
    },
  ],
});
```

Only placeholders present in the generated config require values. Missing variables fail the build before the file is changed. Values are never written back to the tracked source config.

The generated config defaults to `../server/wrangler.json` relative to Astro's client output directory. Override `generatedConfig` for a different adapter layout.

## API

- `cloudflareConfig(options)` — default and named integration factory.
- `replaceWranglerPlaceholders(source, replacements, environment)` — pure deterministic replacement helper.

## License

MIT
