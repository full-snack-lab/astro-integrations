import { describe, expect, test } from "bun:test";
import {
  contentSecurityPolicy,
  createSecurityHeaders,
  DEFAULT_CONTENT_SECURITY_POLICY,
} from "../src/index.js";

describe("site security policy", () => {
  test("builds strong provider-neutral response headers", () => {
    const headers = createSecurityHeaders();

    expect(headers.get("Strict-Transport-Security")).toBe("max-age=63072000; includeSubDomains");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
    expect(headers.get("Cross-Origin-Resource-Policy")).toBe("same-site");
    expect(headers.get("Content-Security-Policy")).toBeNull();
    expect(headers.get("Link")).toBeNull();
    expect(headers.get("No-Vary-Search")).toBeNull();
    expect(headers.get("Reporting-Endpoints")).toBeNull();
    expect(headers.get("tdm-reservation")).toBeNull();
  });

  test("supports explicit additions and removals without mutating defaults", () => {
    const headers = createSecurityHeaders({
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Reporting-Endpoints": 'default="/reports"',
      "X-Frame-Options": null,
    });

    expect(headers.get("Cross-Origin-Resource-Policy")).toBe("cross-origin");
    expect(headers.get("Reporting-Endpoints")).toBe('default="/reports"');
    expect(headers.get("X-Frame-Options")).toBeNull();
    expect(createSecurityHeaders().get("X-Frame-Options")).toBe("DENY");
  });

  test("serializes Astro CSP resources without inventing page hashes", () => {
    const policy = contentSecurityPolicy(DEFAULT_CONTENT_SECURITY_POLICY);

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("style-src-elem 'self'");
    expect(policy).not.toContain("unsafe-inline");
    expect(policy).not.toContain("sha256-");
  });
});
