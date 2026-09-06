import { describe, expect, mock, test } from "bun:test";
import type { APIContext, MiddlewareNext } from "astro";

import {
  defineAuthGuard,
  matchPattern,
  matchesAnyPattern,
} from "../src/guard.js";

function createMockContext(pathname: string, options: {
  headers?: Record<string, string>;
  locals?: Record<string, unknown>;
  search?: string;
} = {}): {
  context: APIContext;
  redirectTarget: string | null;
} {
  let redirectTarget: string | null = null;
  const searchStr = options.search ? `?${options.search}` : "";
  const url = new URL(`https://example.com${pathname}${searchStr}`);

  const headers = new Headers(options.headers);
  const request = new Request(url, { headers });

  const context: APIContext = Object.assign({} as APIContext, {
    clientAddress: "127.0.0.1",
    cookies: {} as never,
    generator: "Astro",
    isPrerendered: false,
    locals: options.locals ?? {},
    originPathname: pathname,
    params: {},
    props: {},
    redirect: (target: string, _status?: number) => {
      redirectTarget = target;
      return new Response(null, {
        status: 302,
        headers: { Location: target },
      });
    },
    request,
    rewrite: mock(() => Promise.resolve(new Response())),
    site: new URL("https://example.com"),
    url,
  });

  return { context, get redirectTarget() { return redirectTarget; } };
}

describe("@fullsnacklab/astro-better-auth/guard", () => {
  describe("pattern matching utilities", () => {
    test("matches exact route paths", () => {
      expect(matchPattern("/cases", "/cases")).toBe(true);
      expect(matchPattern("/cases/", "/cases")).toBe(true);
      expect(matchPattern("/cases/123", "/cases")).toBe(false);
    });

    test("matches wildcard prefixes (*)", () => {
      expect(matchPattern("/cases/123", "/cases/*")).toBe(true);
      expect(matchPattern("/cases/abc", "/cases/*")).toBe(true);
      expect(matchPattern("/cases", "/cases/*")).toBe(true);
      expect(matchPattern("/other", "/cases/*")).toBe(false);
    });

    test("matches recursive wildcard prefixes (**)", () => {
      expect(matchPattern("/cases/123/revisions/4", "/cases/**")).toBe(true);
      expect(matchPattern("/cases", "/cases/**")).toBe(true);
      expect(matchPattern("/about", "/cases/**")).toBe(false);
    });

    test("matches RegExp route patterns", () => {
      const regex = /^\/case\/\d+$/;
      expect(matchPattern("/case/123", regex)).toBe(true);
      expect(matchPattern("/case/abc", regex)).toBe(false);
    });

    test("matchesAnyPattern matches against a list of patterns", () => {
      const patterns = ["/cases/*", "/search", /^\/case\/\d+$/];
      expect(matchesAnyPattern("/search", patterns)).toBe(true);
      expect(matchesAnyPattern("/cases/5", patterns)).toBe(true);
      expect(matchesAnyPattern("/case/99", patterns)).toBe(true);
      expect(matchesAnyPattern("/home", patterns)).toBe(false);
    });
  });

  describe("defineAuthGuard middleware", () => {
    test("passes through requests to unprotected public routes", async () => {
      const guard = defineAuthGuard({
        protectedRoutes: ["/cases/**", "/user"],
      });

      const { context } = createMockContext("/about");
      const next: MiddlewareNext = mock(async () => new Response("Public content"));

      const response = (await guard(context, next)) as Response;

      expect(next).toHaveBeenCalledTimes(1);
      expect(await response.text()).toBe("Public content");
    });

    test("passes through requests when user and session are authenticated in locals", async () => {
      const guard = defineAuthGuard({
        protectedRoutes: ["/cases/**"],
      });

      const { context } = createMockContext("/cases/retracted-paper-1", {
        locals: {
          session: { id: "sess_123" },
          user: { id: "usr_123", name: "Alice" },
        },
      });

      const next: MiddlewareNext = mock(async () => new Response("Authorized content"));
      const response = (await guard(context, next)) as Response;

      expect(next).toHaveBeenCalledTimes(1);
      expect(await response.text()).toBe("Authorized content");
    });

    test("redirects unauthenticated browser navigation to login with encoded returnTo", async () => {
      const guard = defineAuthGuard({
        protectedRoutes: ["/cases/**", "/user"],
        loginPath: "/login",
      });

      const mockData = createMockContext("/cases/retracted-paper-1", {
        search: "sort=desc&page=2",
      });
      const next: MiddlewareNext = mock(async () => new Response("Unreachable"));

      const response = (await guard(mockData.context, next)) as Response;

      expect(next).not.toHaveBeenCalled();
      expect(response.status).toBe(302);
      expect(mockData.redirectTarget).toBe(
        "/login?returnTo=%2Fcases%2Fretracted-paper-1%3Fsort%3Ddesc%26page%3D2",
      );
    });

    test("supports custom loginPath and returnToParam", async () => {
      const guard = defineAuthGuard({
        protectedRoutes: ["/user"],
        loginPath: "/auth/signin",
        returnToParam: "next",
      });

      const mockData = createMockContext("/user");
      const next: MiddlewareNext = mock(async () => new Response());

      await guard(mockData.context, next);
      expect(mockData.redirectTarget).toBe("/auth/signin?next=%2Fuser");
    });

    test("disables returnTo query when returnToParam is false or null", async () => {
      const guard = defineAuthGuard({
        protectedRoutes: ["/user"],
        loginPath: "/login",
        returnToParam: false,
      });

      const mockData = createMockContext("/user");
      const next: MiddlewareNext = mock(async () => new Response());

      await guard(mockData.context, next);
      expect(mockData.redirectTarget).toBe("/login");
    });

    test("returns 401 JSON with Cache-Control: no-store for unauthenticated API requests", async () => {
      const guard = defineAuthGuard({
        protectedRoutes: ["/api/offline/**", "/api/cases/**"],
      });

      const { context } = createMockContext("/api/offline/sync");
      const next: MiddlewareNext = mock(async () => new Response());

      const response = (await guard(context, next)) as Response;

      expect(next).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
      expect(response.headers.get("Content-Type")).toBe("application/json");
      expect(response.headers.get("Cache-Control")).toBe("no-store");

      const body = (await response.json()) as Record<string, unknown>;
      expect(body).toEqual(expect.objectContaining({ code: "unauthorized" }));
    });

    test("returns 401 JSON when request includes accept: application/json header", async () => {
      const guard = defineAuthGuard({
        protectedRoutes: ["/cases/**"],
      });

      const { context } = createMockContext("/cases/data", {
        headers: { accept: "application/json" },
      });
      const next: MiddlewareNext = mock(async () => new Response());

      const response = (await guard(context, next)) as Response;
      expect(response.status).toBe(401);
      expect(response.headers.get("Content-Type")).toBe("application/json");
    });

    test("falls back to auth.api.getSession when locals are not yet populated", async () => {
      const getSessionMock = mock(async () => ({
        session: { id: "sess_fallback" },
        user: { id: "usr_fallback" },
      }));

      const guard = defineAuthGuard({
        protectedRoutes: ["/cases"],
        auth: {
          api: {
            getSession: getSessionMock,
          },
        },
      });

      const { context } = createMockContext("/cases");
      const next: MiddlewareNext = mock(async () => new Response("Success via fallback"));

      const response = (await guard(context, next)) as Response;

      expect(getSessionMock).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledTimes(1);
      expect(await response.text()).toBe("Success via fallback");
      expect((context.locals as Record<string, unknown>).session).toBeDefined();
      expect((context.locals as Record<string, unknown>).user).toBeDefined();
    });

    test("resets stateful RegExp lastIndex to prevent authentication bypass on subsequent requests", async () => {
      const statefulRegex = /^\/cases\/.+/g;
      const guard = defineAuthGuard({
        protectedRoutes: [statefulRegex],
        loginPath: "/login",
      });

      const { context: ctx1 } = createMockContext("/cases/confidential");
      const next1 = mock(async () => new Response("OK"));
      const res1 = (await guard(ctx1, next1)) as Response;
      expect(res1.status).toBe(302);
      expect(next1).not.toHaveBeenCalled();

      // Second identical unauthenticated request
      const { context: ctx2 } = createMockContext("/cases/confidential");
      const next2 = mock(async () => new Response("OK"));
      const res2 = (await guard(ctx2, next2)) as Response;
      expect(res2.status).toBe(302);
      expect(next2).not.toHaveBeenCalled();
    });

    test("automatically exempts loginPath to prevent infinite redirect loops under wildcard patterns", async () => {
      const guard = defineAuthGuard({
        protectedRoutes: ["/*", "/**"],
        loginPath: "/login",
      });

      const { context: ctxLogin } = createMockContext("/login");
      const nextLogin = mock(async () => new Response("Login Page"));
      const resLogin = (await guard(ctxLogin, nextLogin)) as Response;
      expect(resLogin.status).toBe(200);
      expect(nextLogin).toHaveBeenCalledTimes(1);

      const { context: ctxLoginSlash } = createMockContext("/login/");
      const nextLoginSlash = mock(async () => new Response("Login Page Slash"));
      const resLoginSlash = (await guard(ctxLoginSlash, nextLoginSlash)) as Response;
      expect(resLoginSlash.status).toBe(200);
      expect(nextLoginSlash).toHaveBeenCalledTimes(1);
    });

    test("sanitizes protocol-relative returnTo URLs to prevent open redirect injection", async () => {
      const guard = defineAuthGuard({
        protectedRoutes: ["/**"],
        loginPath: "/login",
      });

      const { context } = createMockContext("//evil.com/phish?payload=true");
      const next = mock(async () => new Response("OK"));
      const res = (await guard(context, next)) as Response;

      expect(res.status).toBe(302);
      const location = res.headers.get("Location")!;
      const parsedUrl = new URL(location, "https://example.com");
      const returnTo = parsedUrl.searchParams.get("returnTo")!;

      expect(returnTo.startsWith("/")).toBe(true);
      expect(returnTo.startsWith("//")).toBe(false);
      expect(returnTo.startsWith("/\\")).toBe(false);
      expect(returnTo).toBe("/evil.com/phish?payload=true");
    });

    test("validates configuration options defensively", () => {
      // @ts-expect-error Options are required
      expect(() => defineAuthGuard()).toThrow("options must be an object");
      // @ts-expect-error protectedRoutes must be a non-empty array
      expect(() => defineAuthGuard({})).toThrow("protectedRoutes must be a non-empty array");
      expect(() => defineAuthGuard({ protectedRoutes: [] })).toThrow(
        "protectedRoutes must be a non-empty array",
      );
    });
  });
});

