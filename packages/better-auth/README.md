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

## Node SQLite

Node deployments can pass the built-in `node:sqlite` database directly to Better Auth. Node 22.13 or newer no longer needs an experimental SQLite flag.

```ts
// src/lib/auth.ts
import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";

const database = new DatabaseSync(process.env.BETTER_AUTH_DATABASE_PATH ?? "./auth.db");
database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

export const auth = betterAuth({
  database,
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
});
```

Inspect and apply schema changes before starting the deployment:

```sh
npx auth@latest migrate plan --config src/lib/auth.ts
npx auth@latest migrate apply --config src/lib/auth.ts
```

A tested copyable factory is published at `examples/node-sqlite.ts`.

## Bun SQLite

Bun deployments should use Bun's own SQLite module rather than assuming every Bun version implements `node:sqlite`:

```ts
// src/lib/auth.ts
import { Database } from "bun:sqlite";
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  database: new Database(process.env.BETTER_AUTH_DATABASE_PATH ?? "./auth.db", {
    create: true,
  }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
});
```

Run Better Auth's CLI through Bun so it can load `bun:sqlite`:

```sh
bunx --bun auth@latest migrate plan --config src/lib/auth.ts
bunx --bun auth@latest migrate apply --config src/lib/auth.ts
```

A tested copyable factory is published at `examples/bun-sqlite.ts`.

## Cloudflare D1

Better Auth accepts a D1 binding directly. Keep the Worker-only auth module separate from the Node module and connect background tasks to Workers `waitUntil`:

```ts
// src/lib/auth.cloudflare.ts
import { env, waitUntil } from "cloudflare:workers";
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  database: env.DB,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  advanced: {
    backgroundTasks: {
      handler: waitUntil,
    },
  },
});
```

Declare the binding and migration directory in `wrangler.jsonc`:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "my-app",
      "database_id": "<database-id>",
      "migrations_dir": "migrations",
    },
  ],
}
```

Generate SQL from the same Better Auth options and plugins used by the Worker, commit each numbered migration, then apply it through Wrangler:

```sh
npx auth@latest generate --config src/lib/auth.ts --output migrations/0001_better-auth.sql --yes
npx wrangler d1 migrations apply DB --local
npx wrangler d1 migrations apply DB --remote
```

Review generated SQL and the Cloudflare account target before applying a remote migration. Do not copy a generic schema when plugins or model customizations are enabled; Better Auth's generator includes their tables and columns. A tested configuration factory is published at `examples/cloudflare-d1.ts`, and the repository playground contains a complete two-runtime setup.

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

## Authentication email

The integration routes Better Auth requests but does not select an email provider. Configure verification and password-reset delivery on the application-owned `auth` instance:

```ts
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { sendEmail } from "./email";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    async sendResetPassword({ user, url }) {
      void sendEmail({
        subject: "Reset your password",
        text: `Reset your password: ${url}`,
        to: user.email,
      }).catch((error) => console.error("Failed to send password reset email.", error));
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    async sendVerificationEmail({ user, url }) {
      void sendEmail({
        subject: "Verify your email address",
        text: `Verify your email address: ${url}`,
        to: user.email,
      }).catch((error) => console.error("Failed to send verification email.", error));
    },
  },
});
```

`sendEmail` can wrap Resend, Amazon SES, SendGrid, SMTP, or another transactional provider. Keep provider credentials in server-only environment variables. Better Auth recommends dispatching email without awaiting provider latency to reduce timing attacks. On serverless platforms, connect Better Auth's background task handler to the platform's `waitUntil` or equivalent so delivery can finish after the response.

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
- Node.js `>=22.12.0`
- Bun `^1.4.0` for the Bun SQLite example and development tooling
- Cloudflare D1 through `@astrojs/cloudflare ^14.2.5` in the integration playground

## Release validation

Before publishing from `packages/better-auth`, run:

```sh
bun run release:check
```

The check runs package tests, TypeScript validation, the production build, and `npm pack --dry-run`. npm publication also runs tests and type checking through `prepublishOnly`, then rebuilds through `prepack`.

## License

MIT
