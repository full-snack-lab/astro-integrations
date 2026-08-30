import { afterAll, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { AstroConfig, AstroIntegration } from "astro";
import siteSecurity, { siteSecurity as createSiteSecurityIntegration } from "../src/index.js";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "astro-security-"));
const codegenDirectory = pathToFileURL(`${temporaryDirectory}/codegen/`);
const outputDirectory = pathToFileURL(`${temporaryDirectory}/output/`);

afterAll(() => rmSync(temporaryDirectory, { force: true, recursive: true }));

type SetupContext = Parameters<NonNullable<AstroIntegration["hooks"]["astro:config:setup"]>>[0];
type BuildDoneContext = Parameters<NonNullable<AstroIntegration["hooks"]["astro:build:done"]>>[0];

function setupContext() {
  mkdirSync(codegenDirectory, { recursive: true });
  const addMiddleware = mock(() => undefined);
  const updateConfig = mock(() => ({}) as AstroConfig);
  // SAFETY: The integration reads only these explicitly supplied hook fields.
  const context = {
    addMiddleware,
    config: { root: new URL("file:///project/") },
    createCodegenDir: mock(() => codegenDirectory),
    updateConfig,
  } as unknown as SetupContext;
  return { addMiddleware, context, updateConfig };
}

async function runSetup(integration: AstroIntegration, context: SetupContext): Promise<void> {
  const hook = integration.hooks["astro:config:setup"];
  if (!hook) throw new Error("Expected astro:config:setup hook");
  await hook(context);
}

async function runBuildDone(integration: AstroIntegration): Promise<void> {
  const hook = integration.hooks["astro:build:done"];
  if (!hook) throw new Error("Expected astro:build:done hook");
  // SAFETY: The static-header hook reads only Astro's output directory URL.
  await hook({ dir: outputDirectory } as BuildDoneContext);
}

describe("@fullsnacklab/astro-security", () => {
  test("exports the integration as both the default and named factory", () => {
    expect(siteSecurity).toBe(createSiteSecurityIntegration);
  });

  test("configures hash-aware Astro CSP and post middleware", async () => {
    const integration = siteSecurity();
    const setup = setupContext();

    await runSetup(integration, setup.context);

    expect(setup.updateConfig).toHaveBeenCalledWith({
      security: {
        csp: expect.objectContaining({ algorithm: "SHA-384" }),
      },
    });
    expect(setup.addMiddleware).toHaveBeenCalledWith({
      entrypoint: new URL("middleware.mjs", codegenDirectory),
      order: "post",
    });
    expect(readFileSync(new URL("middleware.mjs", codegenDirectory), "utf8")).not.toContain(
      "Content-Security-Policy",
    );
  });

  test("can disable middleware and Astro CSP independently", async () => {
    const integration = siteSecurity({ csp: false, middleware: false });
    const setup = setupContext();

    await runSetup(integration, setup.context);

    expect(setup.updateConfig).not.toHaveBeenCalled();
    expect(setup.addMiddleware).not.toHaveBeenCalled();
  });

  test("writes an explicit static-asset header artifact with CSP", async () => {
    const integration = siteSecurity({
      staticHeaders: { contentSecurityPolicy: true },
    });

    await runBuildDone(integration);

    const artifact = readFileSync(new URL("_headers", outputDirectory), "utf8");
    expect(artifact).toContain("/*");
    expect(artifact).toContain("strict-transport-security:");
    expect(artifact).toContain("content-security-policy: default-src 'self'");
  });
});
