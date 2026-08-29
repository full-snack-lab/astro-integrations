import { afterAll, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { AstroConfig, AstroIntegration, AstroIntegrationLogger } from "astro";
import betterAuth, { betterAuth as createBetterAuthIntegration } from "../src/index.js";

const projectRoot = new URL("file:///project/");
const codegenPath = mkdtempSync(join(tmpdir(), "astro-better-auth-"));
const codegenDirectory = pathToFileURL(`${codegenPath}/`);

afterAll(() => rmSync(codegenPath, { force: true, recursive: true }));

type ConfigSetupContext = Parameters<
  NonNullable<AstroIntegration["hooks"]["astro:config:setup"]>
>[0];
type ConfigDoneContext = Parameters<NonNullable<AstroIntegration["hooks"]["astro:config:done"]>>[0];

function createAstroConfig(): AstroConfig {
  // SAFETY: Hook tests only observe Astro's root URL. Object.assign preserves the
  // nominal platform contract while making the accessed field concrete.
  return Object.assign({} as AstroConfig, { root: projectRoot });
}

function createLogger(): AstroIntegrationLogger {
  // SAFETY: The integration does not call the logger. No-op methods keep the
  // platform boundary complete if logging is added to a future hook.
  return Object.assign({} as AstroIntegrationLogger, {
    debug: mock(() => undefined),
    error: mock(() => undefined),
    flush: mock(() => undefined),
    fork: mock(() => createLogger()),
    info: mock(() => undefined),
    label: "test",
    warn: mock(() => undefined),
  });
}

function createSetupContext() {
  const addMiddleware = mock(() => undefined);
  const injectRoute = mock(() => undefined);
  const config = createAstroConfig();
  const context: ConfigSetupContext = {
    addClientDirective: mock(() => undefined),
    addDevToolbarApp: mock(() => undefined),
    addMiddleware,
    addRenderer: mock(() => undefined),
    addWatchFile: mock(() => undefined),
    command: "build",
    config,
    createCodegenDir: mock(() => codegenDirectory),
    injectRoute,
    injectScript: mock(() => undefined),
    isRestart: false,
    logger: createLogger(),
    updateConfig: mock(() => config),
  };

  return { addMiddleware, context, injectRoute };
}

function createDoneContext() {
  const injectTypes = mock(() => new URL("file:///project/.astro/types.d.ts"));
  const context: ConfigDoneContext = {
    buildOutput: "server",
    config: createAstroConfig(),
    injectTypes,
    logger: createLogger(),
    setAdapter: mock(() => undefined),
  };

  return { context, injectTypes };
}

async function runSetup(integration: AstroIntegration, context: ConfigSetupContext): Promise<void> {
  const hook = integration.hooks["astro:config:setup"];
  if (!hook) throw new Error("Expected astro:config:setup hook");
  await hook(context);
}

async function runDone(integration: AstroIntegration, context: ConfigDoneContext): Promise<void> {
  const hook = integration.hooks["astro:config:done"];
  if (!hook) throw new Error("Expected astro:config:done hook");
  await hook(context);
}

describe("@fullsnacklab/astro-better-auth", () => {
  test("exports the integration as both the default and named factory", () => {
    expect(betterAuth).toBe(createBetterAuthIntegration);
  });

  test("writes and injects a non-prerendered catch-all route", async () => {
    const integration = betterAuth({ auth: "./src/auth.ts" });
    const { context, injectRoute } = createSetupContext();
    const routeEntrypoint = new URL("route.mjs", codegenDirectory);

    await runSetup(integration, context);

    expect(injectRoute).toHaveBeenCalledWith({
      entrypoint: routeEntrypoint,
      pattern: "/api/auth/[...all]",
      prerender: false,
    });
    expect(readFileSync(routeEntrypoint, "utf8")).toContain("auth.handler(request)");
    expect(context.addMiddleware).not.toHaveBeenCalled();
  });

  test("optionally writes session middleware and injects matching locals types", async () => {
    const integration = betterAuth({ auth: "./src/auth.ts", middleware: true });
    const setup = createSetupContext();
    const done = createDoneContext();
    const middlewareEntrypoint = new URL("middleware.mjs", codegenDirectory);

    await runSetup(integration, setup.context);
    await runDone(integration, done.context);

    expect(setup.addMiddleware).toHaveBeenCalledWith({
      entrypoint: middlewareEntrypoint,
      order: "pre",
    });
    expect(readFileSync(middlewareEntrypoint, "utf8")).toContain("auth.api.getSession");
    expect(done.injectTypes).toHaveBeenCalledWith({
      content: expect.stringContaining("interface Locals"),
      filename: "locals.d.ts",
    });
  });

  test("supports an explicit route and middleware order", async () => {
    const integration = betterAuth({
      auth: "@/auth",
      middleware: { order: "post" },
      route: "/auth/[...path]",
    });
    const { addMiddleware, context, injectRoute } = createSetupContext();

    await runSetup(integration, context);

    expect(injectRoute).toHaveBeenCalledWith({
      entrypoint: new URL("route.mjs", codegenDirectory),
      pattern: "/auth/[...path]",
      prerender: false,
    });
    expect(addMiddleware).toHaveBeenCalledWith({
      entrypoint: new URL("middleware.mjs", codegenDirectory),
      order: "post",
    });
  });

  test("rejects missing auth modules and non-catch-all routes", () => {
    // @ts-expect-error The auth module is required for every integration.
    expect(() => betterAuth({})).toThrow("auth");
    expect(() => betterAuth({ auth: "./src/auth.ts", route: "/api/auth" })).toThrow("catch-all");
  });
});
