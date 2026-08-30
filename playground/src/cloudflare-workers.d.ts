declare module "#cloudflare-workers" {
  import type { D1Database } from "@cloudflare/workers-types";

  interface WorkerEnvironment {
    AUTH_EMAIL_FROM?: string;
    BETTER_AUTH_SECRET?: string;
    BETTER_AUTH_URL?: string;
    DB: D1Database;
    RESEND_API_KEY?: string;
  }

  export const env: WorkerEnvironment;
  export function waitUntil(promise: Promise<unknown>): void;
}
