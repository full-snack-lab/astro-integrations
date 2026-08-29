// @ts-check
import node from "@astrojs/node";
import { defineConfig } from "astro/config";
import betterAuth from "@fullsnacklab/astro-better-auth";

// https://astro.build/config
export default defineConfig({
  adapter: node({ mode: "standalone" }),
  integrations: [
    betterAuth({
      auth: "./src/auth.ts",
      middleware: true,
    }),
  ],
  output: "server",
});
