import { fileURLToPath } from "node:url";
import type { AstroIntegrationMiddleware } from "astro";
import { DEFAULT_ROUTE, INTEGRATION_NAME } from "./constants.js";
import type { RouteGuardOptions } from "./guard.js";

/** Controls the middleware that exposes the current Better Auth session to Astro. */
export interface BetterAuthMiddlewareOptions {
  /**
   * Places the session middleware before or after application middleware.
   *
   * @defaultValue `'pre'`
   */
  order?: AstroIntegrationMiddleware["order"];
}

/** Configures the Better Auth Astro integration. */
export interface BetterAuthIntegrationOptions {
  /**
   * Module exporting a named `auth` Better Auth instance.
   *
   * @remarks Relative paths resolve from Astro's project root. Vite aliases and
   * package specifiers are preserved for Vite to resolve.
   *
   * @example
   * ```ts
   * betterAuth({ auth: './src/lib/auth.ts' });
   * ```
   */
  auth: string | URL;

  /**
   * Adds middleware that populates `Astro.locals.user` and
   * `Astro.locals.session` for every request.
   *
   * @remarks Session lookup failures propagate to Astro instead of being treated
   * as anonymous sessions. Enable this only when application routes use locals.
   *
   * @defaultValue `false`
   */
  middleware?: boolean | BetterAuthMiddlewareOptions;

  /**
   * Astro catch-all route pattern mounted to the Better Auth handler.
   *
   * @remarks Keep this aligned with Better Auth's `basePath` option.
   *
   * @defaultValue `'/api/auth/[...all]'`
   */
  route?: string;

  /**
   * Declarative route protection configuration.
   *
   * @example
   * ```ts
   * betterAuth({
   *   auth: './src/lib/auth.ts',
   *   guard: {
   *     protectedRoutes: ['/cases/*', '/user'],
   *     loginPath: '/login',
   *   },
   * })
   * ```
   */
  guard?: RouteGuardOptions;
}

/** Normalized options consumed by the integration hooks. */
export interface ResolvedBetterAuthIntegrationOptions {
  auth: string | URL;
  middleware: Required<BetterAuthMiddlewareOptions> | null;
  route: string;
  guard: RouteGuardOptions | null;
}

/**
 * Validates JavaScript configuration and applies stable integration defaults.
 *
 * @throws {TypeError} When the auth module, route, or middleware order is invalid.
 */
export function resolveBetterAuthOptions(
  options: BetterAuthIntegrationOptions,
): ResolvedBetterAuthIntegrationOptions {
  if (!options || options.constructor !== Object) {
    throw new TypeError(`${INTEGRATION_NAME}: options are required.`);
  }

  const auth = resolveAuthOption(options.auth);
  const route = options.route ?? DEFAULT_ROUTE;

  if (!route.startsWith("/") || !/\/\[\.\.\.[^\]]+\]$/.test(route)) {
    throw new TypeError(
      `${INTEGRATION_NAME}: route must be an absolute Astro catch-all pattern, such as ${DEFAULT_ROUTE}.`,
    );
  }

  return {
    auth,
    middleware: resolveMiddlewareOptions(options.middleware),
    route,
    guard: options.guard ?? null,
  };
}

/** Resolves project-relative modules while leaving Vite aliases untouched. */
export function resolveAuthModuleSpecifier(auth: string | URL, root: URL): string {
  if (auth instanceof URL) return normalizeModulePath(fileURLToPath(auth));
  if (auth.startsWith("file:")) {
    return normalizeModulePath(fileURLToPath(parseAuthUrl(auth)));
  }
  if (auth.startsWith(".")) {
    return normalizeModulePath(fileURLToPath(parseAuthUrl(auth, root)));
  }
  return normalizeModulePath(auth);
}

function resolveAuthOption(auth: string | URL): string | URL {
  if (auth instanceof URL) {
    if (auth.protocol !== "file:") {
      throw new TypeError(`${INTEGRATION_NAME}: auth URL must use the file: protocol.`);
    }
    return auth;
  }

  if (auth?.constructor !== String || auth.trim().length === 0) {
    throw new TypeError(
      `${INTEGRATION_NAME}: auth must identify a module exporting a named auth instance.`,
    );
  }

  return auth.trim();
}

function resolveMiddlewareOptions(
  middleware: BetterAuthIntegrationOptions["middleware"],
): Required<BetterAuthMiddlewareOptions> | null {
  if (middleware === undefined || middleware === false) return null;
  if (middleware === true) return { order: "pre" };
  if (!middleware || middleware.constructor !== Object) {
    throw new TypeError(`${INTEGRATION_NAME}: middleware must be a boolean or options object.`);
  }

  const order = middleware.order ?? "pre";
  if (order !== "pre" && order !== "post") {
    throw new TypeError(`${INTEGRATION_NAME}: middleware order must be 'pre' or 'post'.`);
  }
  return { order };
}

/** Decodes a user-provided auth URL with integration-specific failure context. */
function parseAuthUrl(value: string, base?: URL): URL {
  try {
    return new URL(value, base);
  } catch (error) {
    throw new TypeError(`${INTEGRATION_NAME}: auth module URL is invalid.`, {
      cause: error,
    });
  }
}

function normalizeModulePath(path: string): string {
  return path.replaceAll("\\", "/");
}
