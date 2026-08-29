import { describe, expect, test } from "bun:test";
import { createEntrypointSources } from "../src/entrypoint-codegen.js";
import { resolveAuthModuleSpecifier, resolveBetterAuthOptions } from "../src/options.js";

const projectRoot = new URL("file:///project/");

describe("Better Auth entrypoint codegen", () => {
  test("forwards every injected route request to the consumer auth handler", () => {
    const source = createEntrypointSources("/project/src/auth.ts").route;

    expect(source).toContain('import { auth } from "/project/src/auth.ts"');
    expect(source).toContain("export const prerender = false");
    expect(source).toContain("auth.handler(request)");
  });

  test("loads sessions into nullable locals without swallowing Better Auth errors", () => {
    const source = createEntrypointSources("/project/src/auth.ts").middleware;

    expect(source).toContain("from 'astro:middleware'");
    expect(source).toContain("auth.api.getSession");
    expect(source).toContain("context.locals.user = currentSession?.user ?? null");
    expect(source).toContain("context.locals.session = currentSession?.session ?? null");
    expect(source).not.toContain(".catch(");
  });

  test("resolves relative auth modules from the Astro project root", () => {
    expect(resolveAuthModuleSpecifier("./src/auth.ts", projectRoot)).toBe("/project/src/auth.ts");
    expect(resolveAuthModuleSpecifier("@/auth", projectRoot)).toBe("@/auth");
  });

  test("rejects invalid runtime middleware configuration", () => {
    expect(() =>
      resolveBetterAuthOptions({
        auth: "./src/auth.ts",
        // @ts-expect-error Runtime validation protects JavaScript consumers.
        middleware: { order: "middle" },
      }),
    ).toThrow("middleware order must be 'pre' or 'post'");
  });
});
