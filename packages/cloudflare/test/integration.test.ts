import { afterAll, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { AstroConfig, AstroIntegration } from "astro";
import cloudflareConfig, {
  cloudflareConfig as createCloudflareConfigIntegration,
} from "../src/index.js";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "astro-cloudflare-"));
const clientDirectory = pathToFileURL(`${temporaryDirectory}/client/`);
const serverDirectory = new URL("../server/", clientDirectory);

afterAll(() => rmSync(temporaryDirectory, { force: true, recursive: true }));

type SetupContext = Parameters<NonNullable<AstroIntegration["hooks"]["astro:config:setup"]>>[0];
type BuildDoneContext = Parameters<NonNullable<AstroIntegration["hooks"]["astro:build:done"]>>[0];

async function runSetup(
  integration: AstroIntegration,
  updateConfig: ReturnType<typeof mock>,
): Promise<void> {
  const hook = integration.hooks["astro:config:setup"];
  if (!hook) throw new Error("Expected astro:config:setup hook");
  // SAFETY: The alias hook reads only Astro's updateConfig callback.
  await hook({ updateConfig } as unknown as SetupContext);
}

async function runBuildDone(integration: AstroIntegration): Promise<void> {
  const hook = integration.hooks["astro:build:done"];
  if (!hook) throw new Error("Expected astro:build:done hook");
  // SAFETY: The replacement hook reads only Astro's output directory URL.
  await hook({ dir: clientDirectory } as BuildDoneContext);
}

describe("@fullsnacklab/astro-cloudflare", () => {
  test("exports the integration as both the default and named factory", () => {
    expect(cloudflareConfig).toBe(createCloudflareConfigIntegration);
  });

  test("aliases application-owned Worker module seams", async () => {
    const integration = cloudflareConfig({
      workerModuleAliases: ["#cloudflare-workers"],
    });
    const updateConfig = mock(() => ({}) as AstroConfig);

    await runSetup(integration, updateConfig);

    expect(updateConfig).toHaveBeenCalledWith({
      vite: {
        resolve: {
          alias: {
            "#cloudflare-workers": "cloudflare:workers",
          },
        },
      },
    });
  });

  test("patches the adapter-generated Wrangler config after the build", async () => {
    mkdirSync(serverDirectory, { recursive: true });
    writeFileSync(new URL("wrangler.json", serverDirectory), '{ "database_id": "REPLACE_D1" }');
    const integration = cloudflareConfig({
      environment: { CF_D1_ID: "database-id" },
      replacements: [{ environmentVariable: "CF_D1_ID", placeholder: "REPLACE_D1" }],
    });

    await runBuildDone(integration);

    expect(readFileSync(new URL("wrangler.json", serverDirectory), "utf8")).toContain(
      "database-id",
    );
  });

  test("rejects integrations with no Cloudflare behavior", () => {
    expect(() => cloudflareConfig({})).toThrow("at least one");
  });
});
