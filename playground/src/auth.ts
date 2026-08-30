import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";
import { createAuthOptions } from "./auth-options.js";
import { sendEmail, type AuthEmail, type EmailEnvironment } from "./email.js";

const environment = process.env;
const emailEnvironment: EmailEnvironment = {
  AUTH_EMAIL_FROM: environment.AUTH_EMAIL_FROM,
  RESEND_API_KEY: environment.RESEND_API_KEY,
};
const database = new DatabaseSync(environment.BETTER_AUTH_DATABASE_PATH ?? "./auth.db");
database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

function deliverEmail(email: AuthEmail): Promise<void> {
  return sendEmail(email, { environment: emailEnvironment });
}

export const auth = betterAuth(
  createAuthOptions({
    baseURL: requireEnvironmentVariable("BETTER_AUTH_URL"),
    database,
    deliverEmail,
    secret: requireEnvironmentVariable("BETTER_AUTH_SECRET"),
  }),
);

function requireEnvironmentVariable(name: "BETTER_AUTH_SECRET" | "BETTER_AUTH_URL"): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} must be configured.`);
  return value;
}
