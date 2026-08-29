import { writeFile } from "node:fs/promises";
import type { AstroIntegration } from "astro";
import { INTEGRATION_NAME } from "./constants.js";
import { createEntrypointSources } from "./entrypoint-codegen.js";
import {
  resolveAuthModuleSpecifier,
  resolveBetterAuthOptions,
  type BetterAuthIntegrationOptions,
} from "./options.js";

const LOCALS_TYPE_DECLARATION = `declare namespace App {
  interface Locals {
    user: import('better-auth').User | null;
    session: import('better-auth').Session | null;
  }
}
`;

/**
 * Adds a Better Auth handler route to Astro and optionally exposes the current
 * session through `Astro.locals`.
 *
 * @remarks The application continues to own the Better Auth instance, database,
 * plugins, authorization policy, and client. The integration only owns Astro's
 * generated route, middleware, and locals declarations.
 *
 * @param options - Consumer auth module and optional Astro plumbing.
 * @returns An Astro integration suitable for `astro.config`.
 * @throws {TypeError} When configuration cannot identify a valid catch-all route
 * or auth module.
 *
 * @example
 * ```ts
 * import { defineConfig } from 'astro/config';
 * import betterAuth from '@fullsnacklab/astro-better-auth';
 *
 * export default defineConfig({
 *   integrations: [
 *     betterAuth({ auth: './src/lib/auth.ts', middleware: true }),
 *   ],
 * });
 * ```
 */
export function betterAuth(options: BetterAuthIntegrationOptions): AstroIntegration {
  const resolvedOptions = resolveBetterAuthOptions(options);

  return {
    name: INTEGRATION_NAME,
    hooks: {
      "astro:config:setup": async ({ addMiddleware, config, createCodegenDir, injectRoute }) => {
        const authModule = resolveAuthModuleSpecifier(resolvedOptions.auth, config.root);
        const sources = createEntrypointSources(authModule);
        const codegenDirectory = createCodegenDir();
        const routeEntrypoint = new URL("route.mjs", codegenDirectory);

        await writeFile(routeEntrypoint, sources.route, "utf8");
        injectRoute({
          entrypoint: routeEntrypoint,
          pattern: resolvedOptions.route,
          prerender: false,
        });

        if (resolvedOptions.middleware) {
          const middlewareEntrypoint = new URL("middleware.mjs", codegenDirectory);
          await writeFile(middlewareEntrypoint, sources.middleware, "utf8");
          addMiddleware({
            entrypoint: middlewareEntrypoint,
            order: resolvedOptions.middleware.order,
          });
        }
      },
      "astro:config:done": ({ injectTypes }) => {
        if (!resolvedOptions.middleware) return;
        injectTypes({
          content: LOCALS_TYPE_DECLARATION,
          filename: "locals.d.ts",
        });
      },
    },
  };
}
