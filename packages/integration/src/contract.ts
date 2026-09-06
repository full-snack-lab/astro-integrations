import type { AstroIntegration, InjectedRoute } from "astro";

/** Inputs shared by app-owned and reusable Astro integrations. */
export interface SharedAstroIntegrationDefinition {
  readonly name: string;
  readonly routes?: readonly InjectedRoute[];
  /** Native Astro hooks remain available when the shared route mechanics are insufficient. */
  readonly hooks?: AstroIntegration["hooks"];
}

/** Register configured routes through Astro's native `injectRoute()` callback. */
export function registerIntegrationRoutes(
  routes: readonly InjectedRoute[],
  injectRoute: (route: InjectedRoute) => void,
): void {
  for (const route of routes) {
    injectRoute(route);
  }
}

export type { AstroIntegration, InjectedRoute } from "astro";
