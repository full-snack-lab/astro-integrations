import { defineWorkspace } from "bunup";

// https://bunup.dev/docs/guide/workspaces

export default defineWorkspace([
  {
    name: "astro-better-auth",
    root: "packages/better-auth",
    config: {
      dts: true,
      entry: "src/index.ts",
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
      entry: "src/index.ts",
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
