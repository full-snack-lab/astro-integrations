# Astro integration playground

This application exercises the integrations in this workspace against a real Astro server.

## Authentication email

The Better Auth fixture sends sign-up verification and password-reset messages through [Resend](https://resend.com/) using `src/email.ts`.

Copy the example environment file before starting the application:

```sh
cp .env.example .env
```

Configure these server-only values:

- `BETTER_AUTH_SECRET`: at least 32 random characters.
- `BETTER_AUTH_URL`: the public application origin, such as `http://localhost:4321` locally.
- `BETTER_AUTH_DATABASE_PATH`: local SQLite file; defaults to `./auth.db`.
- `RESEND_API_KEY`: a Resend API key allowed to send transactional email.
- `AUTH_EMAIL_FROM`: a sender address on a domain verified by Resend.

Never commit `.env`. The Node entrypoint logs background provider failures. The Cloudflare entrypoint passes delivery to Workers `waitUntil`, so Resend can finish after the auth response.

## Authentication persistence

Node uses the built-in `node:sqlite` driver and stores Better Auth state in `BETTER_AUTH_DATABASE_PATH`. Apply schema changes before starting a new deployment:

```sh
bun run auth:migrate
```

Cloudflare uses the `DB` D1 binding from `wrangler.jsonc` and the checked-in migrations directory. Apply migrations to local Wrangler state with:

```sh
bun run auth:migrate:cloudflare
```

For a deployed D1 database, configure `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RESEND_API_KEY`, and `AUTH_EMAIL_FROM` as Worker secrets or environment variables, then run:

```sh
bun run auth:migrate:cloudflare:remote
```

The remote command changes the configured Cloudflare database; review the migration and target account before running it.

## Project structure

```text
/
├── migrations/
│   └── 0001_better_auth.sql
├── scripts/
│   └── migrate-auth.ts
├── src/
│   ├── auth-options.ts
│   ├── auth.cloudflare.ts
│   ├── auth.ts
│   ├── email.ts
│   └── pages/
│       └── index.astro
└── package.json
```

## Commands

Run commands from this directory:

| Command                                  | Action                                                |
| :--------------------------------------- | :---------------------------------------------------- |
| `bun install`                            | Installs dependencies                                 |
| `bun run auth:migrate`                   | Applies Node SQLite auth migrations                   |
| `bun run auth:migrate:cloudflare`        | Applies auth migrations to local D1 state             |
| `bun run auth:migrate:cloudflare:remote` | Applies auth migrations to the configured D1 database |
| `bun run dev --background`               | Starts the background dev server at port 4321         |
| `bun run build`                          | Builds the Node production site to `./dist/`          |
| `bun run build:cloudflare`               | Builds the Worker site to `./dist-cloudflare/`        |
| `bun run preview`                        | Previews the production build                         |
| `bun run astro -- --help`                | Lists Astro CLI commands                              |

Manage the background development server with `bun run astro dev status`, `bun run astro dev logs`, and `bun run astro dev stop`.
