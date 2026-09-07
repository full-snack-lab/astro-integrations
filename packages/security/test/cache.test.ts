import { describe, expect, mock, test } from "bun:test";
import type { APIContext, MiddlewareNext } from "astro";

import {
  appendVaryHeader,
  defineCacheControl,
  resolveCacheControl,
  resolveCacheControlOptions,
} from "../src/cache.js";

function createMockContext(pathname: string, locals: Record<string, unknown> = {}): APIContext {
  const url = new URL(`https://example.com${pathname}`);
  return Object.assign({} as APIContext, {
    clientAddress: "127.0.0.1",
    cookies: {} as never,
    generator: "Astro",
    isPrerendered: false,
    locals,
    originPathname: pathname,
    params: {},
    props: {},
    redirect: mock(() => new Response()),
    request: new Request(url),
    rewrite: mock(() => Promise.resolve(new Response())),
    site: new URL("https://example.com"),
    url,
  });
}

describe("@fullsnacklab/astro-security/cache", () => {
  describe("resolveCacheControl invariants", () => {
    const defaultOptions = resolveCacheControlOptions();

    test("INVARIANT 1: response setting Set-Cookie is FORCED to private, no-store", () => {
      const context = createMockContext("/categories/coffee");
      const response = new Response("Public category page", {
        headers: { "Set-Cookie": "session_id=12345; HttpOnly; Path=/" },
      });

      const policy = resolveCacheControl("/categories/coffee", response, context, defaultOptions);
      expect(policy).toBe("private, no-store");
    });

    test("INVARIANT 2: authenticated response with locals.session is FORCED to private, no-store", () => {
      const context = createMockContext("/feed", { session: { id: "sess_1" } });
      const response = new Response("User feed");

      const policy = resolveCacheControl("/feed", response, context, defaultOptions);
      expect(policy).toBe("private, no-store");
    });

    test("INVARIANT 2b: authenticated response with locals.user is FORCED to private, no-store", () => {
      const context = createMockContext("/profile", { user: { id: "usr_1" } });
      const response = new Response("User profile");

      const policy = resolveCacheControl("/profile", response, context, defaultOptions);
      expect(policy).toBe("private, no-store");
    });

    test("INVARIANT 3: designated privateRoutes receive private, no-store", () => {
      const context = createMockContext("/api/metrics");
      const response = new Response(JSON.stringify({ ok: true }));

      const policy = resolveCacheControl("/api/metrics", response, context, defaultOptions);
      expect(policy).toBe("private, no-store");
    });

    test("INVARIANT 4: HTTP error responses (>= 400) receive defaultError policy", () => {
      const context = createMockContext("/not-found");
      const notFoundResponse = new Response("Not Found", { status: 404 });
      const serverErrorResponse = new Response("Internal Server Error", { status: 500 });

      expect(resolveCacheControl("/not-found", notFoundResponse, context, defaultOptions)).toBe(
        "public, max-age=0, must-revalidate",
      );
      expect(resolveCacheControl("/error", serverErrorResponse, context, defaultOptions)).toBe(
        "public, max-age=0, must-revalidate",
      );
    });

    test("INVARIANT 5: custom publicRoute rules are applied in priority order", () => {
      const options = resolveCacheControlOptions({
        publicRoutes: [
          { pattern: "/categories/**", policy: "public, s-maxage=900, stale-while-revalidate=60" },
          { pattern: "/results/**", policy: "public, s-maxage=300" },
        ],
      });

      const context = createMockContext("/categories/burgers");
      const response = new Response("Category detail");

      const policy = resolveCacheControl("/categories/burgers", response, context, options);
      expect(policy).toBe("public, s-maxage=900, stale-while-revalidate=60");
    });

    test("INVARIANT 6: explicit endpoint-assigned Cache-Control is preserved on unauthenticated public routes", () => {
      const context = createMockContext("/about");
      const customHeaderResponse = new Response("Static About", {
        headers: { "Cache-Control": "public, max-age=86400, immutable" },
      });

      const policy = resolveCacheControl("/about", customHeaderResponse, context, defaultOptions);
      expect(policy).toBe("public, max-age=86400, immutable");
    });

    test("INVARIANT 7: defaultPublic policy is applied when no rules match and no header exists", () => {
      const context = createMockContext("/terms");
      const response = new Response("Terms of service");

      const policy = resolveCacheControl("/terms", response, context, defaultOptions);
      expect(policy).toBe("public, max-age=0, must-revalidate");
    });
    test("INVARIANT 0: explicit endpoint private/no-store is preserved even on error status >= 400", () => {
      const context = createMockContext("/error-test");
      const errorResponse = new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Cache-Control": "no-store, private" },
      });

      const policy = resolveCacheControl("/error-test", errorResponse, context, defaultOptions);
      expect(policy).toBe("no-store, private");
    });

    test("INVARIANT 0b: explicit endpoint private/no-store is preserved on publicRoute matches", () => {
      const options = resolveCacheControlOptions({
        publicRoutes: [{ pattern: "/public/**", policy: "public, max-age=3600" }],
      });
      const context = createMockContext("/public/sensitive");
      const sensitiveResponse = new Response("Sensitive details", {
        headers: { "Cache-Control": "private, no-store" },
      });

      const policy = resolveCacheControl("/public/sensitive", sensitiveResponse, context, options);
      expect(policy).toBe("private, no-store");
    });
  });

  describe("appendVaryHeader utility", () => {
    test("creates new Vary header when existing is null", () => {
      expect(appendVaryHeader(null, ["Accept-Encoding"])).toBe("Accept-Encoding");
    });

    test("handles empty string existing Vary without producing leading comma", () => {
      expect(appendVaryHeader("", ["Accept-Encoding"])).toBe("Accept-Encoding");
    });

    test("appends items without duplicating existing tokens case-insensitively", () => {
      expect(appendVaryHeader("Accept-Encoding", ["Accept-Encoding", "Sec-GPC"])).toBe(
        "Accept-Encoding, Sec-GPC",
      );
      expect(appendVaryHeader("accept-encoding", ["Accept-Encoding"])).toBe("accept-encoding");
    });
  });

  describe("defineCacheControl middleware execution", () => {
    test("modifies response headers while preserving body and status", async () => {
      const middleware = defineCacheControl({
        publicRoutes: [
          { pattern: "/catalog/*", policy: "public, s-maxage=1200" },
        ],
        vary: ["Accept-Encoding", "Sec-GPC"],
      });

      const context = createMockContext("/catalog/items");
      const next: MiddlewareNext = mock(async () => {
        return new Response("Catalog item payload", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      });

      const response = (await middleware(context, next)) as Response;

      expect(response.status).toBe(200);
      expect(await response.text()).toBe("Catalog item payload");
      expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=1200");
      expect(response.headers.get("Vary")).toContain("Accept-Encoding");
      expect(response.headers.get("Vary")).toContain("Sec-GPC");
    });

    test("does not append public Vary headers to private/no-store responses", async () => {
      const middleware = defineCacheControl();
      const context = createMockContext("/api/me");
      const next: MiddlewareNext = mock(async () => new Response("Private API"));

      const response = (await middleware(context, next)) as Response;

      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(response.headers.get("Vary")).toBeNull();
    });
  });
});
