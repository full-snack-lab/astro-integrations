import { betterAuth, type BetterAuthOptions } from "better-auth";
import { createAuthOptions, type AuthPolicyInput } from "./policy.js";

type BetterAuthDatabase = NonNullable<BetterAuthOptions["database"]>;

export interface CloudflareD1AuthOptions extends Omit<AuthPolicyInput<BetterAuthDatabase>, "database" | "defer"> {
  /** Cloudflare D1 database binding (e.g. env.DB). */
  database: BetterAuthDatabase;
  /** Cloudflare ExecutionContext.waitUntil function for background task lifecycle dispatch. */
  waitUntil: (task: Promise<unknown>) => void;
  /** Additional Better Auth options (e.g. plugins, hooks, providers). */
  extraOptions?: Partial<BetterAuthOptions>;
}

/**
 * Creates a Better Auth instance configured for Cloudflare Workers D1 runtime
 * with background task execution wired to waitUntil.
 */
export function createCloudflareD1Auth(
  options: CloudflareD1AuthOptions,
): ReturnType<typeof betterAuth> {
  if (!options || typeof options !== "object") {
    throw new TypeError("@fullsnacklab/astro-better-auth/d1: options must be an object.");
  }
  if (!options.database) {
    throw new TypeError("@fullsnacklab/astro-better-auth/d1: D1 database must be provided.");
  }
  if (typeof options.waitUntil !== "function") {
    throw new TypeError("@fullsnacklab/astro-better-auth/d1: waitUntil must be a function.");
  }

  const basePolicy = createAuthOptions({
    baseURL: options.baseURL,
    database: options.database,
    secret: options.secret,
    defer: options.waitUntil,
    production: options.production ?? true,
    sessionExpirySeconds: options.sessionExpirySeconds,
    sessionUpdateAgeSeconds: options.sessionUpdateAgeSeconds,
    disablePasswordAuth: options.disablePasswordAuth,
  });

  const mergedOptions: BetterAuthOptions = {
    ...basePolicy,
    ...options.extraOptions,
    advanced: {
      ...basePolicy.advanced,
      ...options.extraOptions?.advanced,
      backgroundTasks: {
        handler: options.waitUntil,
      },
    },
    session: {
      ...basePolicy.session,
      ...options.extraOptions?.session,
    },
  };

  return betterAuth(mergedOptions);
}
