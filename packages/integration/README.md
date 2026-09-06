# @fullsnacklab/astro-integration

Universal authoring SDK and testing harness for Astro integrations.

## Installation

```bash
bun add @fullsnacklab/astro-integration
```

## Usage

```ts
import { defineSharedAstroIntegration } from "@fullsnacklab/astro-integration";

export default defineSharedAstroIntegration({
  name: "my-integration",
  routes: [
    {
      pattern: "/demo",
      entrypoint: "src/pages/demo.astro",
      prerender: false,
    },
  ],
  hooks: {
    "astro:config:setup": async ({ logger }) => {
      logger.info("Custom setup complete");
    },
  },
});
```

## Testing Harness

```ts
import { collectIntegrationRoutes, createMockSetupContext } from "@fullsnacklab/astro-integration/testing";

const routes = collectIntegrationRoutes(myIntegrationDefinition);
const { context, injectedRoutes } = createMockSetupContext();
```
