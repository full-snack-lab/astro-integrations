import { describe, expect, mock, test } from "bun:test";
import { createCloudflareD1Auth } from "../src/d1.js";

describe("@fullsnacklab/astro-better-auth/d1", () => {
  const dummyD1Database = {
    batch: () => Promise.resolve([]),
    exec: () => Promise.resolve({ count: 0, duration: 0 }),
    prepare: () => ({
      bind: () => ({
        all: () => Promise.resolve([]),
        first: () => Promise.resolve(null),
        raw: () => Promise.resolve([]),
        run: () => Promise.resolve({ success: true }),
      }),
    }),
  } as unknown as Parameters<typeof createCloudflareD1Auth>[0]["database"];

  test("configures Better Auth for Cloudflare D1 with waitUntil", () => {
    const waitUntilSpy = mock((_p: Promise<unknown>) => undefined);
    const auth = createCloudflareD1Auth({
      baseURL: "https://example.com/api/auth",
      secret: "cf-d1-test-secret-at-least-32-chars!",
      database: dummyD1Database,
      waitUntil: waitUntilSpy,
    });

    expect(auth).toBeDefined();
    expect(typeof auth.handler).toBe("function");
    expect(auth.options.advanced?.useSecureCookies).toBe(true);

    const taskPromise = Promise.resolve("background task");
    auth.options.advanced?.backgroundTasks?.handler?.(taskPromise);
    expect(waitUntilSpy).toHaveBeenCalledWith(taskPromise);
  });

  test("allows overriding options through extraOptions", () => {
    const waitUntilSpy = mock((_p: Promise<unknown>) => undefined);
    const auth = createCloudflareD1Auth({
      baseURL: "https://example.com/api/auth",
      secret: "cf-d1-test-secret-at-least-32-chars!",
      database: dummyD1Database,
      waitUntil: waitUntilSpy,
      production: false,
      extraOptions: {
        appName: "CustomApp",
      },
    });

    expect(auth.options.advanced?.useSecureCookies).toBe(false);
    expect(auth.options.appName).toBe("CustomApp");
  });

  test("validates input defensively", () => {
    // @ts-expect-error missing options
    expect(() => createCloudflareD1Auth()).toThrow("options must be an object");

    expect(() =>
      // @ts-expect-error missing database
      createCloudflareD1Auth({
        baseURL: "https://example.com",
        secret: "s",
        waitUntil: () => undefined,
      }),
    ).toThrow("D1 database must be provided");

    expect(() =>
      // @ts-expect-error missing waitUntil
      createCloudflareD1Auth({
        baseURL: "https://example.com",
        secret: "s",
        database: dummyD1Database,
      }),
    ).toThrow("waitUntil must be a function");
  });
});
