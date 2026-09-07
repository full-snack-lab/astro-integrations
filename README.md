# Astro integrations

Public Astro integrations maintained by Full Snack Lab.

## Packages

### [`@fullsnacklab/astro-better-auth`](./packages/better-auth)

Mount a user-owned Better Auth instance in Astro with an injected catch-all route and optional typed session middleware.

The package includes tested Node and Bun SQLite examples, Cloudflare D1 wiring, and repeatable migration guidance.

```sh
bun add @fullsnacklab/astro-better-auth better-auth
```

See the [package README](./packages/better-auth) for setup and API documentation.

### [`@fullsnacklab/astro-security`](./packages/security)

Apply Astro's hash-aware page CSP, provider-neutral dynamic response headers, and optional static asset headers.

```sh
bun add @fullsnacklab/astro-security
```

### [`@fullsnacklab/astro-cloudflare`](./packages/cloudflare)

Keep Cloudflare Worker module aliases and generated Wrangler resource substitutions out of application configuration.

```sh
bun add @fullsnacklab/astro-cloudflare @astrojs/cloudflare
```

### [`@fullsnacklab/astro-emdash`](./packages/emdash)

Use friendly local and Cloudflare persistence presets with Emdash while keeping advanced CMS policy application-owned.

```sh
bun add @fullsnacklab/astro-emdash emdash
```

### [`@fullsnacklab/astro-theme`](./packages/theme)

Load validated site identity, i18n, SEO, Open Graph, metadata, and structured data from YAML with provider-neutral runtime adapters.

```sh
bun add @fullsnacklab/astro-theme
```

### [`@fullsnacklab/astro-flow`](./packages/flow)

Share `Iterate`, `Switch`, `Case`, and `When` control-flow factories and `.astro` component entry points across applications.

### [`@fullsnacklab/astro-integration`](./packages/integration)

Author Astro integrations with shared route-registration helpers and an isolated `/testing` entry point. This is an authoring SDK, not an umbrella package containing the other integrations.

## Releases

This monorepo publishes independent packages. Related capabilities use package subpaths, such as `@fullsnacklab/astro-security/cache`; the repository root stays private.

Changesets owns package versions and changelogs. See [RELEASING.md](./RELEASING.md) for versioning, trusted-publisher configuration, and verification/publication gates.

## Development

```sh
bun install
bun run build
bun run test
bun run type-check
```

Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## License

MIT
