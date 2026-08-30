# @fullsnacklab/astro-security

Secure defaults for Astro's hash-aware page Content Security Policy and dynamic response headers, with optional static-asset `_headers` output.

The integration owns security plumbing, not application policy. Discovery links, reporting endpoints, third-party origins, report routes, and route-specific exceptions remain explicit application configuration.

## Install

```sh
bun add @fullsnacklab/astro-security
```

## Use

```ts
import { defineConfig } from "astro/config";
import siteSecurity from "@fullsnacklab/astro-security";

export default defineConfig({
  integrations: [siteSecurity()],
});
```

By default the integration:

- enables Astro page CSP with SHA-384 hashes;
- leaves generated script and style hashes to Astro;
- applies provider-neutral response headers through post middleware;
- lets application middleware override exceptional route policy while the response unwinds;
- does not emit reporting or discovery headers with missing application routes.

## Customize policy

Pass a complete Astro CSP object when the defaults do not match the application:

```ts
siteSecurity({
  csp: {
    algorithm: "SHA-384",
    directives: [
      "default-src 'self'",
      "connect-src 'self' https://analytics.example.com",
      "frame-ancestors 'none'",
    ],
    scriptDirective: {
      resources: ["'self'", "https://challenges.cloudflare.com"],
    },
  },
  headers: {
    "Reporting-Endpoints": 'default="/reports"',
    "X-Frame-Options": null,
  },
});
```

A `null` header removes that default. The integration deliberately never copies page CSP into dynamic response middleware because doing so would discard Astro's generated hashes.

## Static asset headers

Cloudflare Workers and some other platforms read a `_headers` build artifact:

```ts
siteSecurity({
  staticHeaders: true,
});
```

This writes the response-header defaults without CSP. To include a serialized static policy explicitly:

```ts
siteSecurity({
  staticHeaders: { contentSecurityPolicy: true },
});
```

Astro's generated page hashes cannot be represented in this file. Enable static CSP only for responses that do not depend on those hashes.

## API

- `siteSecurity(options?)` — default and named integration factory.
- `createSecurityHeaders(overrides?)` — builds a fresh header set.
- `contentSecurityPolicy(config?)` — serializes an Astro CSP object for non-rendered responses.
- `staticHeadersArtifact(headers)` — formats deterministic `_headers` content.
- `DEFAULT_CONTENT_SECURITY_POLICY` and `DEFAULT_SECURITY_HEADERS` — documented defaults.

## License

MIT
