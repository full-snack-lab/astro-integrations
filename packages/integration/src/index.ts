import type { AstroIntegration } from "astro";
import {
  registerIntegrationRoutes,
  type SharedAstroIntegrationDefinition,
} from "./contract.js";

/**
 * Callable AstroIntegration object that functions both as an integration directly
 * and as a zero-argument integration factory function.
 */
export type SharedAstroIntegration = AstroIntegration & (() => AstroIntegration);

/**
 * Author an integration with shared injected-route mechanics and native Astro hooks.
 *
 * @remarks A supplied `astro:config:setup` hook runs after shared routes are registered. All other
 * hooks pass through untouched, so unsupported native hooks require no abstraction change.
 *
 * Returns an object that satisfies `AstroIntegration` and can also be called as `() => AstroIntegration`.
 */
export function defineSharedAstroIntegration(
  definition: SharedAstroIntegrationDefinition,
): SharedAstroIntegration {
  const configuredSetup = definition.hooks?.["astro:config:setup"];
  const setup: NonNullable<
    AstroIntegration["hooks"]["astro:config:setup"]
  > = async (options) => {
    registerIntegrationRoutes(definition.routes ?? [], options.injectRoute);
    await configuredSetup?.(options);
  };

  const integration: AstroIntegration = {
    name: definition.name,
    hooks: {
      ...definition.hooks,
      "astro:config:setup": setup,
    },
  };

  const fn = () => integration;
  Object.defineProperty(fn, "name", {
    value: definition.name,
    configurable: true,
    enumerable: true,
    writable: true,
  });
  const callable = Object.assign(fn, {
    hooks: integration.hooks,
  }) as SharedAstroIntegration;

  return callable;
}

export default defineSharedAstroIntegration;

export { registerIntegrationRoutes } from "./contract.js";
export { collectIntegrationRoutes, createMockSetupContext } from "./testing.js";
export type {
  AstroIntegration,
  InjectedRoute,
  SharedAstroIntegrationDefinition,
} from "./contract.js";

