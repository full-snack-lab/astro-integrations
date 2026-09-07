import type { APIContext, MiddlewareHandler, MiddlewareNext } from "astro";

export const DEFAULT_PRIVATE_CACHE_CONTROL = "private, no-store";
export const DEFAULT_PUBLIC_CACHE_CONTROL = "public, max-age=0, must-revalidate";
export const DEFAULT_ERROR_CACHE_CONTROL = "public, max-age=0, must-revalidate";

export interface CacheControlRouteRule {
  /** Route path pattern (exact, prefix wildcard `*`, or RegExp). */
  pattern: string | RegExp;
  /** Cache-Control directive string for this route. */
  policy: string;
}

export interface CacheControlOptions {
  /**
   * Routes categorically excluded from public or shared caching.
   *
   * @defaultValue `['/api/**', '/auth/**']`
   */
  privateRoutes?: readonly (string | RegExp)[];

  /**
   * Custom route rules for public cache policies.
   * Evaluated in order; the first matching rule is applied.
   */
  publicRoutes?: readonly CacheControlRouteRule[];

  /**
   * Cache-Control header applied to public responses when no route rule matches.
   *
   * @defaultValue `'public, max-age=0, must-revalidate'`
   */
  defaultPublic?: string;

  /**
   * Cache-Control header applied to authenticated responses, private routes, or responses setting cookies.
   *
   * @defaultValue `'private, no-store'`
   */
  defaultPrivate?: string;

  /**
   * Cache-Control header applied to error responses (HTTP status >= 400).
   *
   * @defaultValue `'public, max-age=0, must-revalidate'`
   */
  defaultError?: string;

  /**
   * Whether to force Cache-Control to `defaultPrivate` when `context.locals.session` or `context.locals.user` is present.
   *
   * @defaultValue `true`
   */
  privateWhenAuthenticated?: boolean;

  /**
   * Whether to force Cache-Control to `defaultPrivate` when a response contains `Set-Cookie`.
   *
   * @defaultValue `true`
   */
  privateWhenSetsCookie?: boolean;

  /**
   * Headers to append to the `Vary` header on cacheable responses.
   *
   * @defaultValue `['Accept-Encoding']`
   */
  vary?: readonly string[];
}

export interface ResolvedCacheControlOptions {
  privateRoutes: readonly (string | RegExp)[];
  publicRoutes: readonly CacheControlRouteRule[];
  defaultPublic: string;
  defaultPrivate: string;
  defaultError: string;
  privateWhenAuthenticated: boolean;
  privateWhenSetsCookie: boolean;
  vary: readonly string[];
}

export function resolveCacheControlOptions(
  options: CacheControlOptions = {},
): ResolvedCacheControlOptions {
  return {
    privateRoutes: options.privateRoutes ?? ["/api/**", "/auth/**"],
    publicRoutes: options.publicRoutes ?? [],
    defaultPublic: options.defaultPublic ?? DEFAULT_PUBLIC_CACHE_CONTROL,
    defaultPrivate: options.defaultPrivate ?? DEFAULT_PRIVATE_CACHE_CONTROL,
    defaultError: options.defaultError ?? DEFAULT_ERROR_CACHE_CONTROL,
    privateWhenAuthenticated: options.privateWhenAuthenticated ?? true,
    privateWhenSetsCookie: options.privateWhenSetsCookie ?? true,
    vary: options.vary ?? ["Accept-Encoding"],
  };
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

/**
 * Computes the Cache-Control directive for a given response.
 */
export function resolveCacheControl(
  pathname: string,
  response: Response,
  context: Pick<APIContext, "locals">,
  options: ResolvedCacheControlOptions,
): string {
  const existing = response.headers.get("Cache-Control");

  // Invariant 0: Check if response has explicit private or no-store directives BEFORE error or public rules
  if (
    existing &&
    (existing.toLowerCase().includes("private") || existing.toLowerCase().includes("no-store"))
  ) {
    return existing;
  }

  const setsCookie = response.headers.has("set-cookie");
  const isAuthenticated =
    options.privateWhenAuthenticated &&
    Boolean(
      (context.locals as Record<string, unknown>)?.session ||
      (context.locals as Record<string, unknown>)?.user,
    );

  const isExplicitPrivate = options.privateRoutes.some((pattern) => matchPattern(pathname, pattern));

  // Invariant 1: Authenticated, cookie-setting, or designated private route -> ALWAYS private!
  if ((options.privateWhenSetsCookie && setsCookie) || isAuthenticated || isExplicitPrivate) {
    return options.defaultPrivate;
  }

  // Invariant 2: HTTP Error status -> error policy
  if (response.status >= 400) {
    return options.defaultError;
  }

  // Invariant 3: Route-specific public rule match
  for (const rule of options.publicRoutes) {
    if (matchPattern(pathname, rule.pattern)) {
      return rule.policy;
    }
  }

  // Invariant 4: Preserve explicitly assigned endpoint Cache-Control if already present
  if (existing) {
    return existing;
  }

  // Invariant 5: Default public policy
  return options.defaultPublic;
}

/**
 * Appends items to the Vary header without duplication (case-insensitive check).
 */
export function appendVaryHeader(existingVary: string | null, additions: readonly string[]): string {
  const existingTokens = existingVary
    ? existingVary.split(",").map((s) => s.trim().toLowerCase())
    : [];
  const result = existingVary ? existingVary.split(",").map((s) => s.trim()) : [];

  for (const item of additions) {
    if (!existingTokens.includes(item.toLowerCase())) {
      result.push(item);
      existingTokens.push(item.toLowerCase());
    }
  }

  return result.join(", ");
}

/**
 * Creates an Astro middleware handler that enforces dynamic Cache-Control and privacy headers.
 */
export function defineCacheControl(options: CacheControlOptions = {}): MiddlewareHandler {
  const resolved = resolveCacheControlOptions(options);

  return async function cacheControlMiddleware(
    context: APIContext,
    next: MiddlewareNext,
  ): Promise<Response> {
    const response = await next();
    const headers = new Headers(response.headers);
    const pathname = context.url.pathname;

    const cachePolicy = resolveCacheControl(pathname, response, context, resolved);
    headers.set("Cache-Control", cachePolicy);

    if (resolved.vary.length > 0 && !cachePolicy.includes("private") && !cachePolicy.includes("no-store")) {
      headers.set("Vary", appendVaryHeader(headers.get("Vary"), resolved.vary));
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
