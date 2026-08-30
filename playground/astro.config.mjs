// @ts-check
import node from "@astrojs/node";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";
import betterAuth from "@fullsnacklab/astro-better-auth";
import emdash from "@fullsnacklab/astro-emdash";
import siteSecurity from "@fullsnacklab/astro-security";
import theme from "@fullsnacklab/astro-theme";

// https://astro.build/config
export default defineConfig({
  adapter: node({ mode: "standalone" }),
  integrations: [
    betterAuth({
      auth: "./src/auth.ts",
      middleware: true,
    }),
    theme({ runtime: { loader: "./src/theme-loader.ts" } }),
    react(),
    emdash(),
    siteSecurity({ staticHeaders: true }),
  ],
  output: "server",
});
