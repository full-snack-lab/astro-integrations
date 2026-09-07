import type { RouteGuardOptions } from "./guard.js";

/** Generated route and middleware modules written into Astro's codegen directory. */
export interface BetterAuthEntrypointSources {
  middleware: string;
  route: string;
}

/**
 * Generates Astro entrypoints that import the application-owned auth instance.
 *
 * @remarks Import specifiers are serialized as JSON so paths remain valid source
 * even when they contain quotes or platform-specific characters.
 */
export function createEntrypointSources(authModule: string): BetterAuthEntrypointSources {
  const authImport = JSON.stringify(authModule);

  return {
    route: `
import { auth } from ${authImport};

export const prerender = false;
export const ALL = ({ request }) => auth.handler(request);
`,
    middleware: `
import { defineMiddleware } from 'astro:middleware';
import { auth } from ${authImport};

export const onRequest = defineMiddleware(async (context, next) => {
  const currentSession = await auth.api.getSession({
    headers: context.request.headers,
  });

  context.locals.user = currentSession?.user ?? null;
  context.locals.session = currentSession?.session ?? null;

  return next();
});
`,
  };
}

/**
 * Generates route protection guard middleware.
 */
export function createGuardMiddlewareSource(
  guardOptions: RouteGuardOptions,
  authModule: string,
): string {
  const authImport = JSON.stringify(authModule);
  const protectedRoutes = `[${guardOptions.protectedRoutes
    .map((p) => (p instanceof RegExp ? p.toString() : JSON.stringify(p)))
    .join(", ")}]`;
  const apiRoutes = guardOptions.apiRoutes
    ? `[${guardOptions.apiRoutes
        .map((p) => (p instanceof RegExp ? p.toString() : JSON.stringify(p)))
        .join(", ")}]`
    : "undefined";
  const loginPath =
    guardOptions.loginPath !== undefined
      ? JSON.stringify(guardOptions.loginPath)
      : "undefined";
  const returnToParam =
    guardOptions.returnToParam !== undefined
      ? JSON.stringify(guardOptions.returnToParam)
      : "undefined";
  const redirectToLogin =
    guardOptions.redirectToLogin !== undefined
      ? JSON.stringify(guardOptions.redirectToLogin)
      : "undefined";

  return `
import { defineAuthGuard } from '@fullsnacklab/astro-better-auth/guard';
import { auth } from ${authImport};

export const onRequest = defineAuthGuard({
  protectedRoutes: ${protectedRoutes},
  apiRoutes: ${apiRoutes},
  loginPath: ${loginPath},
  returnToParam: ${returnToParam},
  redirectToLogin: ${redirectToLogin},
  auth,
});
`;
}
