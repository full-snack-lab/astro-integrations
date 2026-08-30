// @ts-check
import cloudflareAdapter from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";
import betterAuth from "@fullsnacklab/astro-better-auth";
import cloudflareConfig from "@fullsnacklab/astro-cloudflare";
import emdash from "@fullsnacklab/astro-emdash/cloudflare";
import siteSecurity from "@fullsnacklab/astro-security";
import theme from "@fullsnacklab/astro-theme";

export default defineConfig({
  adapter: cloudflareAdapter({ imageService: "passthrough" }),
  integrations: [
    betterAuth({
      auth: "./src/auth.cloudflare.ts",
      middleware: true,
    }),
    theme({ runtime: { loader: "./src/theme-loader.ts" } }),
    react(),
    emdash(),
    siteSecurity({ staticHeaders: true }),
    cloudflareConfig({
      environment: {
        PLAYGROUND_D1_DATABASE_ID: "00000000-0000-0000-0000-000000000000",
        PLAYGROUND_KV_NAMESPACE_ID: "11111111111111111111111111111111",
      },
      replacements: [
        {
          environmentVariable: "PLAYGROUND_D1_DATABASE_ID",
          placeholder: "REPLACE_WITH_D1_DATABASE_ID",
        },
        {
          environmentVariable: "PLAYGROUND_KV_NAMESPACE_ID",
          placeholder: "REPLACE_WITH_KV_NAMESPACE_ID",
        },
      ],
      workerModuleAliases: ["#cloudflare-workers"],
    }),
  ],
  outDir: "dist-cloudflare",
  output: "server",
});
