# @fullsnacklab/astro-better-auth

A focused Astro integration for [Better Auth](https://www.better-auth.com/). It mounts the Better Auth handler as an Astro route and can optionally expose the current user and session through `Astro.locals`.

The integration owns Astro plumbing only. Your application continues to own its Better Auth configuration, database adapter, plugins, authorization policy, and client.

## Install

```sh
bun add @fullsnacklab/astro-better-auth better-auth
```

Better Auth endpoints need an Astro adapter in production. Install the adapter for your deployment target separately.

## Configure Better Auth

Export a named `auth` instance from an application module:

```ts
// src/lib/auth.ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  // database, plugins, and application policy stay here
});
```

## Add the integration

```ts
// astro.config.ts
import { defineConfig } from "astro/config";
import betterAuth from "@fullsnacklab/astro-better-auth";

export default defineConfig({
  integrations: [
    betterAuth({
      auth: "./src/lib/auth.ts",
    }),
  ],
});
```

This injects a non-prerendered `/api/auth/[...all]` route and forwards every request to `auth.handler(request)`.

Relative auth module paths resolve from Astro's project root. Vite aliases and package specifiers are also accepted.

## Session locals

Enable middleware when pages or application middleware need the current session:

```ts
betterAuth({
  auth: "./src/lib/auth.ts",
  middleware: true,
});
```

The middleware performs one Better Auth session lookup per request and sets:

```ts
Astro.locals.user; // User | null
Astro.locals.session; // Session | null
```

Matching `App.Locals` declarations are injected automatically. Session lookup errors propagate to Astro; they are not silently converted into anonymous sessions.

Use post-middleware ordering when application middleware must run first:

```ts
betterAuth({
  auth: "./src/lib/auth.ts",
  middleware: { order: "post" },
});
```

## Custom auth route

```ts
betterAuth({
  auth: "./src/lib/auth.ts",
  route: "/auth/[...path]",
});
```

The route must be an absolute Astro catch-all pattern. Keep it aligned with Better Auth's `basePath` option.

## API

### `betterAuth(options)`

Available as both the default and named export.

| Option       | Type                                     | Default              | Purpose                                  |
| ------------ | ---------------------------------------- | -------------------- | ---------------------------------------- |
| `auth`       | `string \| URL`                          | required             | Module exporting a named `auth` instance |
| `route`      | `string`                                 | `/api/auth/[...all]` | Injected Astro catch-all pattern         |
| `middleware` | `boolean \| { order?: 'pre' \| 'post' }` | `false`              | Populate session locals on each request  |

## Compatibility

The initial release is built and tested against:

- Astro `^7.2.9`
- Better Auth `^1.7.2`
- TypeScript `^6.0.3`
- Node.js adapter `^11.1.4` in the integration playground

## License

MIT
