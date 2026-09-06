import { describe, expect, mock, test } from "bun:test";
import type { AstroConfig, AstroIntegration, AstroIntegrationLogger, InjectedRoute } from "astro";

import defineSharedAstroIntegrationDefault, {
  defineSharedAstroIntegration,
  registerIntegrationRoutes,
} from "../src/index.js";
import { collectIntegrationRoutes, createMockSetupContext } from "../src/testing.js";
import type { SharedAstroIntegrationDefinition } from "../src/contract.js";

type ConfigSetupContext = Parameters<
  NonNullable<AstroIntegration["hooks"]["astro:config:setup"]>
>[0];

function createMockAstroConfig(): AstroConfig {
  return Object.assign({} as AstroConfig, { root: new URL("file:///project/") });
}

function createMockLogger(): AstroIntegrationLogger {
  return Object.assign({} as AstroIntegrationLogger, {
    debug: mock(() => undefined),
    error: mock(() => undefined),
    flush: mock(() => undefined),
    fork: mock(() => createMockLogger()),
    info: mock(() => undefined),
    label: "test",
    warn: mock(() => undefined),
  });
}

function createSetupContext() {
  const injectRoute = mock((_route: InjectedRoute) => undefined);
  const addMiddleware = mock(() => undefined);
  const config = createMockAstroConfig();
  const context: ConfigSetupContext = {
    addClientDirective: mock(() => undefined),
    addDevToolbarApp: mock(() => undefined),
    addMiddleware,
    addRenderer: mock(() => undefined),
    addWatchFile: mock(() => undefined),
    command: "build",
    config,
    createCodegenDir: mock(() => new URL("file:///project/.astro/")),
    injectRoute,
    injectScript: mock(() => undefined),
    isRestart: false,
    logger: createMockLogger(),
    updateConfig: mock(() => config),
  };

  return { addMiddleware, context, injectRoute };
}

describe("@fullsnacklab/astro-integration", () => {
  const sampleRoutes: readonly InjectedRoute[] = [
    {
      pattern: "/categories/[category]",
      entrypoint: "src/pages/categories/[category].astro",
      prerender: false,
    },
    {
      pattern: "/api/health",
      entrypoint: "src/pages/api/health.ts",
      prerender: true,
    },
  ];

  test("exports defineSharedAstroIntegration as both default and named export", () => {
    expect(defineSharedAstroIntegrationDefault).toBe(defineSharedAstroIntegration);
  });

  describe("collectIntegrationRoutes", () => {
    test("collects routes without executing Astro lifecycle hooks", () => {
      const definition: SharedAstroIntegrationDefinition = {
        name: "test:catalogue",
        routes: sampleRoutes,
      };

      const collected = collectIntegrationRoutes(definition);
      expect(collected).toEqual(sampleRoutes);
      expect(collected.length).toBe(2);
    });

    test("returns an empty array when routes are undefined or empty", () => {
      expect(collectIntegrationRoutes({ name: "test:empty" })).toEqual([]);
      expect(collectIntegrationRoutes({ name: "test:empty-array", routes: [] })).toEqual([]);
    });

    test("preserves route parameters, entrypoints, and prerender flags", () => {
      const definition: SharedAstroIntegrationDefinition = {
        name: "test:routes",
        routes: [
          { pattern: "/a", entrypoint: "a.astro", prerender: true },
          { pattern: "/b", entrypoint: "b.astro", prerender: false },
          { pattern: "/c", entrypoint: "c.astro" },
        ],
      };

      const collected = collectIntegrationRoutes(definition);
      expect(collected[0]?.prerender).toBe(true);
      expect(collected[1]?.prerender).toBe(false);
      expect(collected[2]?.prerender).toBeUndefined();
    });
  });

  describe("registerIntegrationRoutes", () => {
    test("calls injectRoute for every route in order", () => {
      const spy = mock((_route: InjectedRoute) => undefined);
      registerIntegrationRoutes(sampleRoutes, spy);

      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenNthCalledWith(1, sampleRoutes[0]);
      expect(spy).toHaveBeenNthCalledWith(2, sampleRoutes[1]);
    });

    test("does not call injectRoute when routes array is empty", () => {
      const spy = mock((_route: InjectedRoute) => undefined);
      registerIntegrationRoutes([], spy);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("defineSharedAstroIntegration", () => {
    test("creates an AstroIntegration preserving name and registering setup hook", async () => {
      const definition: SharedAstroIntegrationDefinition = {
        name: "test:app-integration",
        routes: sampleRoutes,
      };

      const integration = defineSharedAstroIntegration(definition);
      expect(integration.name).toBe("test:app-integration");
      expect(integration.hooks["astro:config:setup"]).toBeFunction();

      const { context, injectRoute } = createSetupContext();
      const setupHook = integration.hooks["astro:config:setup"]!;
      await setupHook(context);

      expect(injectRoute).toHaveBeenCalledTimes(2);
      expect(injectRoute).toHaveBeenNthCalledWith(1, sampleRoutes[0]);
      expect(injectRoute).toHaveBeenNthCalledWith(2, sampleRoutes[1]);
    });

    test("functions both as an AstroIntegration object and callable factory", () => {
      const definition: SharedAstroIntegrationDefinition = {
        name: "test:dual-callable",
        routes: sampleRoutes,
      };
      const integration = defineSharedAstroIntegration(definition);
      expect(integration.name).toBe("test:dual-callable");
      expect(typeof integration).toBe("function");
      const called = integration();
      expect(called.name).toBe("test:dual-callable");
    });

    test("preserves native hooks outside route registration", () => {
      const buildDoneHook = () => undefined;
      const serverSetupHook = () => undefined;

      const definition: SharedAstroIntegrationDefinition = {
        name: "test:with-hooks",
        hooks: {
          "astro:build:done": buildDoneHook,
          "astro:server:setup": serverSetupHook,
        },
      };

      const integration = defineSharedAstroIntegration(definition);
      expect(integration.hooks["astro:build:done"]).toBe(buildDoneHook);
      expect(integration.hooks["astro:server:setup"]).toBe(serverSetupHook);
    });

    test("runs user-supplied astro:config:setup hook after route injection", async () => {
      const executionOrder: string[] = [];

      const definition: SharedAstroIntegrationDefinition = {
        name: "test:order",
        routes: [sampleRoutes[0]!],
        hooks: {
          "astro:config:setup": async () => {
            executionOrder.push("user-hook");
          },
        },
      };

      const integration = defineSharedAstroIntegration(definition);
      const { context, injectRoute } = createSetupContext();
      injectRoute.mockImplementation(() => {
        executionOrder.push("inject-route");
      });

      const setupHook = integration.hooks["astro:config:setup"]!;
      await setupHook(context);

      expect(executionOrder).toEqual(["inject-route", "user-hook"]);
    });

    test("propagates errors thrown by user-supplied setup hook", async () => {
      const definition: SharedAstroIntegrationDefinition = {
        name: "test:error",
        hooks: {
          "astro:config:setup": () => {
            throw new Error("Setup hook failed");
          },
        },
      };

      const integration = defineSharedAstroIntegration(definition);
      const { context } = createSetupContext();
      const setupHook = integration.hooks["astro:config:setup"]!;

      await expect(setupHook(context)).rejects.toThrow("Setup hook failed");
    });
  });

  describe("createMockSetupContext helper", () => {
    test("creates a reusable setup context tracking injected routes", () => {
      const mockHarness = createMockSetupContext();
      expect(mockHarness.context).toBeDefined();
      expect(mockHarness.injectedRoutes).toEqual([]);

      mockHarness.context.injectRoute(sampleRoutes[0]!);
      expect(mockHarness.injectedRoutes).toEqual([sampleRoutes[0]!]);
    });
  });
});
