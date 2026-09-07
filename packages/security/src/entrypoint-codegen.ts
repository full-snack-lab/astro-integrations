import type { ResolvedCacheControlOptions } from "./cache.js";
import type { PrivacyHeadersOptions } from "./options.js";

/** Generates middleware that applies headers without mutating immutable responses. */
export function createSecurityMiddlewareSource(
  headers: Headers,
  cacheControl?: ResolvedCacheControlOptions | null,
  privacy?: PrivacyHeadersOptions | null,
): string {
  const entries = JSON.stringify([...headers.entries()]);

  if (!cacheControl) {
    return `
import { defineMiddleware } from 'astro:middleware';

const securityHeaders = ${entries};

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  const headers = new Headers(response.headers);
  for (const [name, value] of securityHeaders) headers.set(name, value);

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
});
`;
  }

  const serializedRules = JSON.stringify(
    cacheControl.publicRoutes.map((r) => ({
      pattern: r.pattern instanceof RegExp ? r.pattern.source : r.pattern,
      isRegex: r.pattern instanceof RegExp,
      policy: r.policy,
    })),
  );
  const serializedPrivateRoutes = JSON.stringify(
    cacheControl.privateRoutes.map((p) => (p instanceof RegExp ? p.source : p)),
  );
  const isRegexPrivate = JSON.stringify(cacheControl.privateRoutes.map((p) => p instanceof RegExp));
  const vary = [...cacheControl.vary];
  if (privacy?.varyOnGpc && !vary.some((v) => v.toLowerCase() === "sec-gpc")) {
    vary.push("Sec-GPC");
  }

  const optionsJson = JSON.stringify({
    defaultPublic: cacheControl.defaultPublic,
    defaultPrivate: cacheControl.defaultPrivate,
    defaultError: cacheControl.defaultError,
    privateWhenAuthenticated: cacheControl.privateWhenAuthenticated,
    privateWhenSetsCookie: cacheControl.privateWhenSetsCookie,
    vary,
  });

  return `
import { defineMiddleware } from 'astro:middleware';
import { resolveCacheControl, appendVaryHeader } from '@fullsnacklab/astro-security/cache';

const securityHeaders = ${entries};
const rawRules = ${serializedRules};
const rawPrivateRoutes = ${serializedPrivateRoutes};
const isRegexPrivate = ${isRegexPrivate};
const cacheOptions = ${optionsJson};

const privateRoutes = rawPrivateRoutes.map((p, i) => isRegexPrivate[i] ? new RegExp(p) : p);
const publicRoutes = rawRules.map((r) => ({
  pattern: r.isRegex ? new RegExp(r.pattern) : r.pattern,
  policy: r.policy,
}));

const resolvedCacheOptions = {
  ...cacheOptions,
  privateRoutes,
  publicRoutes,
};

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  const headers = new Headers(response.headers);
  for (const [name, value] of securityHeaders) headers.set(name, value);

  const pathname = context.url.pathname;
  const cachePolicy = resolveCacheControl(pathname, response, context, resolvedCacheOptions);
  headers.set("Cache-Control", cachePolicy);

  if (resolvedCacheOptions.vary.length > 0 && !cachePolicy.includes("private") && !cachePolicy.includes("no-store")) {
    headers.set("Vary", appendVaryHeader(headers.get("Vary"), resolvedCacheOptions.vary));
  }

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
});
`;
}
