import { env, waitUntil } from "#cloudflare-workers";
import { betterAuth } from "better-auth";
import { createAuthOptions } from "./auth-options.js";
import { sendEmail, type AuthEmail, type EmailEnvironment } from "./email.js";

const emailEnvironment: EmailEnvironment = {
  AUTH_EMAIL_FROM: env.AUTH_EMAIL_FROM,
  RESEND_API_KEY: env.RESEND_API_KEY,
};

function deliverEmail(email: AuthEmail): Promise<void> {
  return sendEmail(email, { environment: emailEnvironment });
}

export const auth = betterAuth(
  createAuthOptions({
    baseURL: requireEnvironmentVariable("BETTER_AUTH_URL"),
    database: env.DB,
    defer: waitUntil,
    deliverEmail,
    secret: requireEnvironmentVariable("BETTER_AUTH_SECRET"),
  }),
);

function requireEnvironmentVariable(name: "BETTER_AUTH_SECRET" | "BETTER_AUTH_URL"): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured.`);
  return value;
}
