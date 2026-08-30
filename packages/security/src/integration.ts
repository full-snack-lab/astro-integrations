import { mkdir, writeFile } from "node:fs/promises";
import type { AstroIntegration } from "astro";
import { createSecurityMiddlewareSource } from "./entrypoint-codegen.js";
import { contentSecurityPolicy, createSecurityHeaders, staticHeadersArtifact } from "./headers.js";
import { resolveSiteSecurityOptions, type SiteSecurityOptions } from "./options.js";

const INTEGRATION_NAME = "@fullsnacklab/astro-security";

/**
 * Adds hash-aware page CSP, dynamic response headers, and optional static headers to Astro.
 *
 * @remarks Application-specific discovery links, reporting routes, third-party origins,
 * and route exceptions remain application-owned through explicit overrides.
 */
export function siteSecurity(options: SiteSecurityOptions = {}): AstroIntegration {
  const resolved = resolveSiteSecurityOptions(options);
  const responseHeaders = createSecurityHeaders(resolved.headers);

  return {
    name: INTEGRATION_NAME,
    hooks: {
      "astro:config:setup": async ({ addMiddleware, createCodegenDir, updateConfig }) => {
        if (resolved.csp) {
          updateConfig({
            security: {
              csp: {
                ...resolved.csp,
                algorithm: resolved.csp.algorithm ?? "SHA-384",
              },
            },
          });
        }
        if (!resolved.middleware) return;

        const codegenDirectory = createCodegenDir();
        const middlewareEntrypoint = new URL("middleware.mjs", codegenDirectory);
        await writeFile(
          middlewareEntrypoint,
          createSecurityMiddlewareSource(responseHeaders),
          "utf8",
        );
        addMiddleware({
          entrypoint: middlewareEntrypoint,
          order: resolved.middleware.order,
        });
      },
      "astro:build:done": async ({ dir }) => {
        if (!resolved.staticHeaders) return;
        const headers = createSecurityHeaders(resolved.headers);
        if (resolved.staticHeaders.contentSecurityPolicy && resolved.csp) {
          headers.set("Content-Security-Policy", contentSecurityPolicy(resolved.csp));
        }
        await mkdir(dir, { recursive: true });
        await writeFile(new URL("_headers", dir), staticHeadersArtifact(headers), "utf8");
      },
    },
  };
}
