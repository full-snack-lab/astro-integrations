import type { APIContext, MiddlewareHandler, MiddlewareNext } from "astro";

export interface RouteGuardOptions {
  /**
   * Route patterns requiring an authenticated session.
   * Strings support exact match and prefix wildcards (`*` or `**`).
   *
   * @example
   * protectedRoutes: ['/cases/*', '/search', /^\/case\/\d+/]
   */
  protectedRoutes: readonly (string | RegExp)[];

  /**
   * API route patterns that should return a 401 Unauthorized JSON response
   * instead of redirecting to the login page.
   *
   * @defaultValue Routes starting with '/api/' or requests with 'accept: application/json'
   */
  apiRoutes?: readonly (string | RegExp)[];

  /**
   * Login path for unauthenticated browser navigation redirects.
   *
   * @defaultValue `'/login'`
   */
  loginPath?: string;

  /**
   * Query parameter name for preserving the requested return URL.
   * Set to `false` or `null` to disable returnTo query generation.
   *
   * @defaultValue `'returnTo'`
   */
  returnToParam?: string | false | null;

  /**
   * Whether to redirect browser navigation to login.
   * When false, returns a 401 response instead of redirecting.
   *
   * @defaultValue `true`
   */
  redirectToLogin?: boolean;

  /**
   * Optional Better Auth instance for resolving sessions if not already in locals.
   */
  auth?: {
    api: {
      getSession(options: { headers: Headers }): Promise<{
        session: unknown;
        user: unknown;
      } | null>;
    };
  };

  /** Custom unauthorized response generator for API routes. */
  onUnauthorizedApi?: (context: APIContext) => Response | Promise<Response>;

  /** Custom unauthorized response generator for browser page routes. */
  onUnauthorizedPage?: (context: APIContext) => Response | Promise<Response>;
}

export function matchPattern(pathname: string, pattern: string | RegExp): boolean {
  if (pattern instanceof RegExp) {
    pattern.lastIndex = 0;
    return pattern.test(pathname);
  }
  if (pattern.endsWith("/**")) {
    const prefix = pattern.slice(0, -3);
    return pathname === prefix || pathname === `${prefix}/` || pathname.startsWith(prefix + "/");
  }
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -2);
    return pathname === prefix || pathname === `${prefix}/` || pathname.startsWith(prefix + "/");
  }
  return pathname === pattern || pathname === `${pattern}/`;
}

export function matchesAnyPattern(pathname: string, patterns: readonly (string | RegExp)[]): boolean {
  for (const pattern of patterns) {
    if (matchPattern(pathname, pattern)) return true;
  }
  return false;
}

/**
 * Creates an Astro middleware handler that guards protected routes.
 */
export function defineAuthGuard(options: RouteGuardOptions): MiddlewareHandler {
  if (!options || typeof options !== "object") {
    throw new TypeError("@fullsnacklab/astro-better-auth/guard: options must be an object.");
  }
  if (!Array.isArray(options.protectedRoutes) || options.protectedRoutes.length === 0) {
    throw new TypeError("@fullsnacklab/astro-better-auth/guard: protectedRoutes must be a non-empty array.");
  }

  const protectedRoutes = [...options.protectedRoutes];
  const apiRoutes = options.apiRoutes ? [...options.apiRoutes] : null;
  const loginPath = options.loginPath ?? "/login";
  const returnToParam = options.returnToParam === undefined ? "returnTo" : options.returnToParam;
  const redirectToLogin = options.redirectToLogin ?? true;

  return async function authGuard(context: APIContext, next: MiddlewareNext): Promise<Response> {
    const pathname = context.url.pathname;

    // Automatically exempt loginPath to prevent infinite redirect loops
    if (pathname === loginPath || pathname === `${loginPath}/`) {
      return next();
    }

    // Check if current route requires authentication
    if (!matchesAnyPattern(pathname, protectedRoutes)) {
      return next();
    }

    // Resolve user and session from locals
    let user: unknown = (context.locals as Record<string, unknown>)?.user ?? null;
    let session: unknown = (context.locals as Record<string, unknown>)?.session ?? null;

    // Fallback to auth instance lookup if not already in locals
    if ((!user || !session) && options.auth) {
      try {
        const resolved = await options.auth.api.getSession({
          headers: context.request.headers,
        });
        if (resolved) {
          user = resolved.user;
          session = resolved.session;
          (context.locals as Record<string, unknown>).user = user;
          (context.locals as Record<string, unknown>).session = session;
        }
      } catch {
        // Propagate unauthenticated state on session lookup failure
      }
    }

    // Authenticated -> proceed
    if (user && session) {
      return next();
    }

    // Determine if request is targeting an API route
    const isApi =
      (apiRoutes && matchesAnyPattern(pathname, apiRoutes)) ||
      (!apiRoutes && pathname.startsWith("/api/")) ||
      context.request.headers.get("accept")?.includes("application/json") === true;

    // Unauthenticated API request -> 401 JSON
    if (isApi) {
      if (options.onUnauthorizedApi) {
        return options.onUnauthorizedApi(context);
      }
      return new Response(JSON.stringify({ error: "Unauthorized", code: "unauthorized" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    }

    // Unauthenticated Page request -> Redirect to login
    if (redirectToLogin) {
      if (options.onUnauthorizedPage) {
        return options.onUnauthorizedPage(context);
      }
      const rawReturnTo = `${context.url.pathname}${context.url.search}`;
      let returnTo: string;
      if (
        rawReturnTo.startsWith("/") &&
        !rawReturnTo.startsWith("//") &&
        !rawReturnTo.startsWith("/\\")
      ) {
        returnTo = rawReturnTo;
      } else {
        // Normalize protocol-relative or non-standard URL to safe local path
        returnTo = "/" + rawReturnTo.replace(/^[/\\\\]+/, "");
      }

      let targetUrl = loginPath;
      if (returnToParam && typeof returnToParam === "string" && returnToParam.trim().length > 0) {
        const separator = loginPath.includes("?") ? "&" : "?";
        targetUrl = `${loginPath}${separator}${encodeURIComponent(returnToParam.trim())}=${encodeURIComponent(returnTo)}`;
      }
      return context.redirect(targetUrl);
    }

    // Explicitly non-redirecting page fallback -> 401
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  };
}
