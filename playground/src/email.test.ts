/// <reference types="bun" />

import { describe, expect, test } from "bun:test";
import {
  createAuthEmailCallbacks,
  sendEmail,
  type AuthEmail,
  type EmailEnvironment,
} from "./email.js";

const email: AuthEmail = {
  subject: "Verify your email",
  text: "Open the verification link.",
  to: "user@example.com",
};

const environment: EmailEnvironment = {
  AUTH_EMAIL_FROM: "Full Snack Lab <auth@example.com>",
  RESEND_API_KEY: "re_test_key",
};

describe("sendEmail", () => {
  test("sends transactional email through Resend", async () => {
    let request: { input: RequestInfo | URL; init?: RequestInit } | undefined;
    const fetchImplementation = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      request = { input, init };
      return new Response(null, { status: 202 });
    };

    await sendEmail(email, { environment, fetch: fetchImplementation });

    expect(request?.input).toBe("https://api.resend.com/emails");
    expect(request?.init?.method).toBe("POST");
    expect(request?.init?.headers).toEqual({
      Authorization: "Bearer re_test_key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(request?.init?.body))).toEqual({
      from: "Full Snack Lab <auth@example.com>",
      subject: "Verify your email",
      text: "Open the verification link.",
      to: ["user@example.com"],
    });
  });

  test("rejects missing provider configuration", () => {
    return expect(sendEmail(email, { environment: {} })).rejects.toThrow("RESEND_API_KEY");
  });

  test("surfaces provider failures", () => {
    const fetchImplementation = async (): Promise<Response> => new Response(null, { status: 503 });

    return expect(sendEmail(email, { environment, fetch: fetchImplementation })).rejects.toThrow(
      "status 503",
    );
  });
});

describe("createAuthEmailCallbacks", () => {
  test("maps Better Auth verification and reset payloads to user emails", async () => {
    const delivered: AuthEmail[] = [];
    const callbacks = createAuthEmailCallbacks(async (message) => {
      delivered.push(message);
    });

    callbacks.sendVerificationEmail({
      token: "verification-token",
      url: "https://example.com/verify-email?token=verification-token",
      user: { email: "verify@example.com" },
    });
    callbacks.sendResetPassword({
      token: "reset-token",
      url: "https://example.com/reset-password/reset-token",
      user: { email: "reset@example.com" },
    });
    await Promise.resolve();

    expect(delivered).toEqual([
      {
        subject: "Verify your email address",
        text: "Verify your email address: https://example.com/verify-email?token=verification-token",
        to: "verify@example.com",
      },
      {
        subject: "Reset your password",
        text: "Reset your password: https://example.com/reset-password/reset-token",
        to: "reset@example.com",
      },
    ]);
  });

  test("hands delivery to a serverless background task handler", async () => {
    let deferredTask: Promise<unknown> | undefined;
    const callbacks = createAuthEmailCallbacks(async () => undefined, {
      defer: (task) => {
        deferredTask = task;
      },
    });

    await callbacks.sendVerificationEmail({
      token: "verification-token",
      url: "https://example.com/verify-email?token=verification-token",
      user: { email: "verify@example.com" },
    });

    expect(deferredTask).toBeInstanceOf(Promise);
    await deferredTask;
  });
});
