import { createAuthEmailCallbacks, type EmailSender, type EmailTaskHandler } from "./email.js";

interface AuthOptionsInput<Database> {
  baseURL: string;
  database: Database;
  defer?: EmailTaskHandler;
  deliverEmail: EmailSender;
  secret: string;
}

/** Builds the runtime-independent Better Auth policy shared by Node and Workers. */
export function createAuthOptions<Database>(input: AuthOptionsInput<Database>) {
  const emailCallbacks = createAuthEmailCallbacks(input.deliverEmail, {
    defer: input.defer,
  });

  return {
    baseURL: input.baseURL,
    database: input.database,
    secret: input.secret,
    advanced: input.defer
      ? {
          backgroundTasks: {
            handler: input.defer,
          },
        }
      : undefined,
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: emailCallbacks.sendResetPassword,
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: emailCallbacks.sendVerificationEmail,
    },
  };
}
