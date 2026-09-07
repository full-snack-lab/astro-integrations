import { describe, expect, mock, test } from "bun:test";
import { createAuthOptions } from "../src/policy.js";

describe("@fullsnacklab/astro-better-auth/policy", () => {
  const dummyDatabase = { query: () => [] };

  test("creates normalized policy with defaults", () => {
    const policy = createAuthOptions({
      baseURL: " https://example.com/api/auth ",
      secret: " secret-key-12345 ",
      database: dummyDatabase,
    });

    expect(policy.baseURL).toBe("https://example.com/api/auth");
    expect(policy.secret).toBe("secret-key-12345");
    expect(policy.database).toBe(dummyDatabase);
    expect(policy.advanced.useSecureCookies).toBe(false);
    expect(policy.session.expiresIn).toBe(2592000); // 30 days
    expect(policy.session.updateAge).toBe(86400); // 1 day
    expect(policy.emailAndPassword).toEqual({ enabled: false });
  });

  test("enforces secure cookies in production mode", () => {
    const policy = createAuthOptions({
      baseURL: "https://example.com",
      secret: "secret-123",
      database: dummyDatabase,
      production: true,
    });

    expect(policy.advanced.useSecureCookies).toBe(true);
  });

  test("wires background defer function to advanced.backgroundTasks.handler", () => {
    const deferSpy = mock((_p: Promise<unknown>) => undefined);
    const policy = createAuthOptions({
      baseURL: "https://example.com",
      secret: "secret-123",
      database: dummyDatabase,
      defer: deferSpy,
    });

    expect(policy.advanced.backgroundTasks?.handler).toBe(deferSpy);
  });

  test("allows custom session expiry and update age", () => {
    const policy = createAuthOptions({
      baseURL: "https://example.com",
      secret: "secret-123",
      database: dummyDatabase,
      sessionExpirySeconds: 3600,
      sessionUpdateAgeSeconds: 300,
    });

    expect(policy.session.expiresIn).toBe(3600);
    expect(policy.session.updateAge).toBe(300);
  });

  test("allows keeping password auth enabled when explicitly requested", () => {
    const policy = createAuthOptions({
      baseURL: "https://example.com",
      secret: "secret-123",
      database: dummyDatabase,
      disablePasswordAuth: false,
    });

    expect(policy.emailAndPassword).toBeUndefined();
  });

  test("validates input defensively", () => {
    // @ts-expect-error Missing input
    expect(() => createAuthOptions()).toThrow("input must be an object");
    // @ts-expect-error Missing baseURL
    expect(() => createAuthOptions({ secret: "x", database: dummyDatabase })).toThrow("baseURL must be a non-empty string");
    // @ts-expect-error Missing secret
    expect(() => createAuthOptions({ baseURL: "x", database: dummyDatabase })).toThrow("secret must be a non-empty string");
    // @ts-expect-error Missing database
    expect(() => createAuthOptions({ baseURL: "x", secret: "y" })).toThrow("database must be provided");
    // @ts-expect-error Invalid defer
    expect(() => createAuthOptions({ baseURL: "x", secret: "y", database: dummyDatabase, defer: "not-fn" })).toThrow(
      "defer must be a function if provided",
    );
  });
});
