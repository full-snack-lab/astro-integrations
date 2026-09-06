import type {
  AstroConfig,
  AstroIntegration,
  AstroIntegrationLogger,
  InjectedRoute,
} from "astro";
import {
  registerIntegrationRoutes,
  type SharedAstroIntegrationDefinition,
} from "./contract.js";

/**
 * Collect the routes registered by a shared integration without starting an Astro server.
 *
 * @remarks This exercises the same route-registration function used by `astro:config:setup`.
 */
export function collectIntegrationRoutes(
  definition: SharedAstroIntegrationDefinition,
): readonly InjectedRoute[] {
  const routes: InjectedRoute[] = [];
  registerIntegrationRoutes(definition.routes ?? [], (route) => {
    routes.push(route);
  });
  return routes;
}

export interface MockAstroContextOptions {
  root?: URL;
  command?: "dev" | "build" | "preview";
}

export type ConfigSetupContext = Parameters<
  NonNullable<AstroIntegration["hooks"]["astro:config:setup"]>
>[0];

export interface MockSetupContextResult {
  context: ConfigSetupContext;
  injectedRoutes: InjectedRoute[];
  addedMiddleware: Array<{ entrypoint: string | URL; order: "pre" | "post" }>;
}

/**
 * Create a mock Astro `astro:config:setup` context for isolated integration testing.
 */
export function createMockSetupContext(options?: MockAstroContextOptions): MockSetupContextResult {
  const root = options?.root ?? new URL("file:///project/");
  const command = options?.command ?? "build";
  const injectedRoutes: InjectedRoute[] = [];
  const addedMiddleware: Array<{ entrypoint: string | URL; order: "pre" | "post" }> = [];

  const config = Object.assign({} as AstroConfig, { root });

  const logger: AstroIntegrationLogger = Object.assign({} as AstroIntegrationLogger, {
    debug: () => undefined,
    error: () => undefined,
    flush: () => undefined,
    fork: () => logger,
    info: () => undefined,
    label: "test",
    warn: () => undefined,
  });

  const context: ConfigSetupContext = {
    addClientDirective: () => undefined,
    addDevToolbarApp: () => undefined,
    addMiddleware: (mid) => {
      addedMiddleware.push(mid);
    },
    addRenderer: () => undefined,
    addWatchFile: () => undefined,
    command,
    config,
    createCodegenDir: () => new URL("file:///project/.astro/"),
    injectRoute: (route) => {
      injectedRoutes.push(route);
    },
    injectScript: () => undefined,
    isRestart: false,
    logger,
    updateConfig: () => config,
  };

  return { addedMiddleware, context, injectedRoutes };
}
