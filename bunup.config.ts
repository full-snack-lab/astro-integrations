import { defineWorkspace } from "bunup";

// https://bunup.dev/docs/guide/workspaces

export default defineWorkspace([
  {
    name: "astro-integration",
    root: "packages/integration",
    config: {
      dts: true,
      entry: ["src/index.ts", "src/testing.ts"],
      format: ["esm"],
      sourcemap: "linked",
      target: "node",
    },
  },
  {
    name: "astro-flow",
    root: "packages/flow",
    config: {
      dts: true,
      entry: ["src/index.ts"],
      format: ["esm"],
      sourcemap: "linked",
      target: "node",
    },
  },
  {
    name: "astro-better-auth",
    root: "packages/better-auth",
    config: {
      dts: true,
      entry: [
        "src/index.ts",
        "src/guard.ts",
        "src/policy.ts",
        "src/sqlite.ts",
        "src/node.ts",
        "src/d1.ts",
        "src/cloudflare.ts",
      ],
      format: ["esm"],
      sourcemap: "linked",
      target: "node",
    },
  },
  {
    name: "astro-security",
    root: "packages/security",
    config: {
      dts: true,
      entry: ["src/index.ts", "src/cache.ts"],
      format: ["esm"],
      sourcemap: "linked",
      target: "node",
    },
  },
  {
    name: "astro-cloudflare",
    root: "packages/cloudflare",
    config: {
      dts: true,
      entry: "src/index.ts",
      format: ["esm"],
      sourcemap: "linked",
      target: "node",
    },
  },
  {
    name: "astro-emdash",
    root: "packages/emdash",
    config: {
      dts: true,
      entry: ["src/index.ts", "src/cloudflare.ts"],
      format: ["esm"],
      sourcemap: "linked",
      target: "node",
    },
  },
  {
    name: "astro-theme",
    root: "packages/theme",
    config: {
      dts: { inferTypes: true },
      entry: ["src/index.ts", "src/runtime.ts", "src/schema.ts"],
      format: ["esm"],
      sourcemap: "linked",
      target: "node",
    },
  },
]);
