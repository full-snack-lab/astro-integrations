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
]);
