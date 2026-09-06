import type { AstroIntegrationMiddleware, AstroUserConfig } from "astro";
import {
  type CacheControlOptions,
  type ResolvedCacheControlOptions,
  resolveCacheControlOptions,
} from "./cache.js";

const INTEGRATION_NAME = "@fullsnacklab/astro-security";

type AstroSecurityConfig = NonNullable<AstroUserConfig["security"]>;

/** Astro's hash-aware Content Security Policy configuration object. */
export type ContentSecurityPolicyConfig = Exclude<NonNullable<AstroSecurityConfig["csp"]>, boolean>;

/** Header additions or overrides. A `null` value removes a default header. */
export type SecurityHeaderOverrides = Readonly<Record<string, string | null>>;

/** Controls the middleware that applies response headers. */
export interface SiteSecurityMiddlewareOptions {
  /**
   * Places security middleware before or after application middleware.
   *
   * @defaultValue `'post'`, allowing application middleware to override policy
   * for exceptional routes while unwinding the response.
   */
  order?: AstroIntegrationMiddleware["order"];
}

/** Controls generation of the platform `_headers` artifact for static assets. */
export interface StaticSecurityHeadersOptions {
  /**
   * Includes a serialized CSP in the static artifact.
   *
   * @remarks Astro's generated page hashes cannot be represented here. Enable
   * this only when the matching static responses do not depend on those hashes.
   *
   * @defaultValue `false`
   */
  contentSecurityPolicy?: boolean;
}

/** Controls privacy-specific headers such as GPC. */
export interface PrivacyHeadersOptions {
  /**
   * Whether to append 'Sec-GPC' to the Vary header.
   *
   * @defaultValue `false`
   */
  varyOnGpc?: boolean;
}

/** Configures secure Astro page, dynamic-response, and static-asset policy. */
export interface SiteSecurityOptions {
  /**
   * Astro's page-level CSP configuration. Omit for secure defaults or use
   * `false` to leave page policy application-owned.
   */
  csp?: false | ContentSecurityPolicyConfig;
  /** Additional response headers and explicit removals from the defaults. */
  headers?: SecurityHeaderOverrides;
  /**
   * Enables dynamic response middleware.
   *
   * @defaultValue `true`
   */
  middleware?: boolean | SiteSecurityMiddlewareOptions;
  /**
   * Emits a `_headers` build artifact for static assets when enabled.
   *
   * @defaultValue `false`
   */
  staticHeaders?: boolean | StaticSecurityHeadersOptions;
  /**
   * Configures dynamic Cache-Control response middleware.
   */
  cacheControl?: false | CacheControlOptions;
  /**
   * Configures privacy-specific headers.
   */
  privacy?: PrivacyHeadersOptions;
}

/** Secure page policy that leaves script and style hashing to Astro. */
export const DEFAULT_CONTENT_SECURITY_POLICY: ContentSecurityPolicyConfig = {
  algorithm: "SHA-384",
  directives: [
    "default-src 'self'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ],
  scriptDirective: {
    resources: ["'self'"],
  },
  styleDirective: {
    resources: [{ kind: "element", resource: "'self'" }],
  },
};

export interface ResolvedSiteSecurityOptions {
  csp: ContentSecurityPolicyConfig | null;
  headers: SecurityHeaderOverrides;
  middleware: { order: "post" | "pre" } | null;
  staticHeaders: StaticSecurityHeadersOptions | null;
  cacheControl: ResolvedCacheControlOptions | null;
  privacy: PrivacyHeadersOptions | null;
}

/** Validates and normalizes public integration options. */
export function resolveSiteSecurityOptions(
  options: SiteSecurityOptions = {},
): ResolvedSiteSecurityOptions {
  if (options.constructor !== Object) {
    throw new TypeError(`${INTEGRATION_NAME}: options must be an object.`);
  }

  return {
    csp: resolveCsp(options.csp),
    headers: resolveHeaders(options.headers),
    middleware: resolveMiddleware(options.middleware),
    staticHeaders: resolveStaticHeaders(options.staticHeaders),
    cacheControl: resolveCacheControlOption(options.cacheControl),
    privacy: resolvePrivacyOption(options.privacy),
  };
}

function resolveCsp(csp: SiteSecurityOptions["csp"]): ContentSecurityPolicyConfig | null {
  if (csp === false) return null;
  if (csp !== undefined && (!csp || csp.constructor !== Object)) {
    throw new TypeError(`${INTEGRATION_NAME}: csp must be false or an object.`);
  }
  return cloneContentSecurityPolicy(csp ?? DEFAULT_CONTENT_SECURITY_POLICY);
}

function cloneContentSecurityPolicy(csp: ContentSecurityPolicyConfig): ContentSecurityPolicyConfig {
  return {
    ...csp,
    directives: csp.directives ? [...csp.directives] : undefined,
    scriptDirective: csp.scriptDirective
      ? {
          ...csp.scriptDirective,
          hashes: csp.scriptDirective.hashes ? [...csp.scriptDirective.hashes] : undefined,
          resources: csp.scriptDirective.resources ? [...csp.scriptDirective.resources] : undefined,
        }
      : undefined,
    styleDirective: csp.styleDirective
      ? {
          ...csp.styleDirective,
          hashes: csp.styleDirective.hashes ? [...csp.styleDirective.hashes] : undefined,
          resources: csp.styleDirective.resources ? [...csp.styleDirective.resources] : undefined,
        }
      : undefined,
  };
}

function resolveHeaders(headers: SiteSecurityOptions["headers"]): SecurityHeaderOverrides {
  if (headers === undefined) return {};
  if (!headers || headers.constructor !== Object) {
    throw new TypeError(`${INTEGRATION_NAME}: headers must be an object.`);
  }
  for (const [name, value] of Object.entries(headers)) {
    if (name.trim().length === 0 || (typeof value !== "string" && value !== null)) {
      throw new TypeError(`${INTEGRATION_NAME}: header values must be strings or null.`);
    }
  }
  return { ...headers };
}

function resolveMiddleware(
  middleware: SiteSecurityOptions["middleware"],
): { order: "post" | "pre" } | null {
  if (middleware === false) return null;
  if (middleware === undefined || middleware === true) return { order: "post" };
  if (!middleware || middleware.constructor !== Object) {
    throw new TypeError(`${INTEGRATION_NAME}: middleware must be a boolean or options object.`);
  }
  const order = middleware.order ?? "post";
  if (order !== "pre" && order !== "post") {
    throw new TypeError(`${INTEGRATION_NAME}: middleware order must be 'pre' or 'post'.`);
  }
  return { order };
}

function resolveStaticHeaders(
  staticHeaders: SiteSecurityOptions["staticHeaders"],
): StaticSecurityHeadersOptions | null {
  if (staticHeaders === undefined || staticHeaders === false) return null;
  if (staticHeaders === true) return { contentSecurityPolicy: false };
  if (!staticHeaders || staticHeaders.constructor !== Object) {
    throw new TypeError(`${INTEGRATION_NAME}: staticHeaders must be a boolean or options object.`);
  }
  if (
    staticHeaders.contentSecurityPolicy !== undefined &&
    typeof staticHeaders.contentSecurityPolicy !== "boolean"
  ) {
    throw new TypeError(
      `${INTEGRATION_NAME}: staticHeaders.contentSecurityPolicy must be a boolean.`,
    );
  }
  return {
    contentSecurityPolicy: staticHeaders.contentSecurityPolicy ?? false,
  };
}

function resolveCacheControlOption(
  cacheControl: SiteSecurityOptions["cacheControl"],
): ResolvedCacheControlOptions | null {
  if (cacheControl === false || cacheControl === undefined) return null;
  if (!cacheControl || cacheControl.constructor !== Object) {
    throw new TypeError(`${INTEGRATION_NAME}: cacheControl must be false or an options object.`);
  }
  return resolveCacheControlOptions(cacheControl);
}

function resolvePrivacyOption(
  privacy: SiteSecurityOptions["privacy"],
): PrivacyHeadersOptions | null {
  if (privacy === undefined) return null;
  if (!privacy || privacy.constructor !== Object) {
    throw new TypeError(`${INTEGRATION_NAME}: privacy must be an options object.`);
  }
  return {
    varyOnGpc: privacy.varyOnGpc ?? false,
  };
}
