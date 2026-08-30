const RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails";

export interface AuthEmail {
  subject: string;
  text: string;
  to: string;
}

export interface EmailEnvironment {
  AUTH_EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
}

interface EmailDependencies {
  environment?: EmailEnvironment;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

interface BetterAuthEmailPayload {
  token: string;
  url: string;
  user: { email: string };
}

export type EmailSender = (email: AuthEmail) => Promise<void>;

interface EmailLogger {
  error(message: string, error: Error): void;
}

export type EmailTaskHandler = (promise: Promise<unknown>) => void;

interface AuthEmailCallbackOptions {
  defer?: EmailTaskHandler | undefined;
  logger?: EmailLogger | undefined;
}

const DEFAULT_EMAIL_LOGGER: EmailLogger = console;

/** Sends one transactional email through the playground's Resend account. */
export async function sendEmail(
  email: AuthEmail,
  dependencies: EmailDependencies = {},
): Promise<void> {
  const environment = dependencies.environment ?? (import.meta.env as EmailEnvironment);
  const apiKey = requireEnvironmentVariable(environment, "RESEND_API_KEY");
  const from = requireEnvironmentVariable(environment, "AUTH_EMAIL_FROM");
  const fetchImplementation = dependencies.fetch ?? globalThis.fetch;

  const response = await fetchImplementation(RESEND_EMAIL_ENDPOINT, {
    body: JSON.stringify({
      from,
      subject: email.subject,
      text: email.text,
      to: [email.to],
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Resend email delivery failed with status ${response.status}.`);
  }
}

/** Maps Better Auth's generated URLs to application-owned email delivery. */
export function createAuthEmailCallbacks(
  deliverEmail: EmailSender,
  options: AuthEmailCallbackOptions = {},
) {
  const logger = options.logger ?? DEFAULT_EMAIL_LOGGER;

  function dispatch(email: AuthEmail): void {
    const task = deliverEmail(email).catch((error: Error) => {
      logger.error("Failed to deliver authentication email.", error);
    });

    if (options.defer) {
      options.defer(task);
      return;
    }
    void task;
  }

  return {
    async sendResetPassword({ user, url }: BetterAuthEmailPayload): Promise<void> {
      dispatch({
        subject: "Reset your password",
        text: `Reset your password: ${url}`,
        to: user.email,
      });
    },
    async sendVerificationEmail({ user, url }: BetterAuthEmailPayload): Promise<void> {
      dispatch({
        subject: "Verify your email address",
        text: `Verify your email address: ${url}`,
        to: user.email,
      });
    },
  };
}

function requireEnvironmentVariable(
  environment: EmailEnvironment,
  name: keyof EmailEnvironment,
): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} must be configured to send authentication email.`);
  return value;
}
