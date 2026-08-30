import { betterAuth, type BetterAuthOptions } from "better-auth";

type BetterAuthDatabase = NonNullable<BetterAuthOptions["database"]>;

export interface CloudflareD1AuthOptions {
  baseURL: string;
  database: BetterAuthDatabase;
  secret: string;
  waitUntil: (task: Promise<unknown>) => void;
}

/** Copyable Workers example using a D1 binding and serverless task lifetime. */
export function createCloudflareD1Auth(options: CloudflareD1AuthOptions) {
  return betterAuth({
    baseURL: options.baseURL,
    database: options.database,
    secret: options.secret,
    advanced: {
      backgroundTasks: {
        handler: options.waitUntil,
      },
    },
  });
}
