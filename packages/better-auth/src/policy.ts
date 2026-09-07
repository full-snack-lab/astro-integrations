/**
 * Framework-neutral inputs for constructing the application's Better Auth policy.
 */
export interface AuthPolicyInput<Database> {
  /** Canonical public base URL where auth routes are served. */
  baseURL: string;
  /** Runtime-specific database instance. */
  database: Database;
  /** Secret key used for session encryption and token signing. */
  secret: string;
  /** Optional background task scheduler (e.g. Cloudflare ExecutionContext.waitUntil). */
  defer?: (promise: Promise<unknown>) => void;
  /** Whether running in production mode, enforcing secure cookie settings. Defaults to false. */
  production?: boolean;
  /** Session expiration duration in seconds. Defaults to 30 days (2,592,000s). */
  sessionExpirySeconds?: number;
  /** Session update age in seconds. Defaults to 1 day (86,400s). */
  sessionUpdateAgeSeconds?: number;
  /** Whether to permanently disable local password storage. Defaults to true. */
  disablePasswordAuth?: boolean;
}

export interface AuthPolicyOptions<Database> {
  baseURL: string;
  database: Database;
  secret: string;
  advanced: {
    useSecureCookies: boolean;
    backgroundTasks?: {
      handler: (promise: Promise<unknown>) => void;
    };
  };
  session: {
    expiresIn: number;
    updateAge: number;
  };
  emailAndPassword?: {
    enabled: false;
  };
}

/**
 * Builds and validates a normalized Better Auth configuration policy
 * without importing runtime-specific drivers.
 *
 * @throws {TypeError} If baseURL or secret are invalid strings.
 * @throws {TypeError} If database is not provided.
 * @throws {TypeError} If defer is supplied but not a function.
 */
export function createAuthOptions<Database>(
  input: AuthPolicyInput<Database>,
): AuthPolicyOptions<Database> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("@fullsnacklab/astro-better-auth/policy: input must be an object.");
  }
  if (!input.baseURL || typeof input.baseURL !== "string" || input.baseURL.trim().length === 0) {
    throw new TypeError("@fullsnacklab/astro-better-auth/policy: baseURL must be a non-empty string.");
  }
  if (!input.secret || typeof input.secret !== "string" || input.secret.trim().length === 0) {
    throw new TypeError("@fullsnacklab/astro-better-auth/policy: secret must be a non-empty string.");
  }
  if (!input.database) {
    throw new TypeError("@fullsnacklab/astro-better-auth/policy: database must be provided.");
  }
  if (input.defer !== undefined && typeof input.defer !== "function") {
    throw new TypeError("@fullsnacklab/astro-better-auth/policy: defer must be a function if provided.");
  }

  const policy: AuthPolicyOptions<Database> = {
    baseURL: input.baseURL.trim(),
    database: input.database,
    secret: input.secret.trim(),
    advanced: {
      useSecureCookies: input.production ?? false,
      backgroundTasks: input.defer
        ? {
            handler: input.defer,
          }
        : undefined,
    },
    session: {
      expiresIn: input.sessionExpirySeconds ?? 60 * 60 * 24 * 30, // 30 days
      updateAge: input.sessionUpdateAgeSeconds ?? 60 * 60 * 24,    // 1 day
    },
  };

  if (input.disablePasswordAuth !== false) {
    policy.emailAndPassword = { enabled: false };
  }

  return policy;
}
