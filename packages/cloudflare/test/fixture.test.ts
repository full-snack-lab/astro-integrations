import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const playgroundRoot = fileURLToPath(new URL("../../../playground/", import.meta.url));
const generatedWranglerConfig = new URL(
  "../../../playground/dist-cloudflare/server/wrangler.json",
  import.meta.url,
);
const staticHeaders = new URL(
  "../../../playground/dist-cloudflare/client/_headers",
  import.meta.url,
);

test("Cloudflare playground builds with patched resources and static headers", async () => {
  const child = Bun.spawn(["bun", "run", "build:cloudflare"], {
    cwd: playgroundRoot,
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  if (exitCode !== 0) {
    throw new Error(`Cloudflare playground build failed:\n${stderr}`);
  }

  const [wranglerConfig, headersArtifact] = await Promise.all([
    readFile(generatedWranglerConfig, "utf8"),
    readFile(staticHeaders, "utf8"),
  ]);
  expect(wranglerConfig).toContain("00000000-0000-0000-0000-000000000000");
  expect(wranglerConfig).toContain("11111111111111111111111111111111");
  expect(wranglerConfig).not.toContain("REPLACE_WITH_D1_DATABASE_ID");
  expect(wranglerConfig).not.toContain("REPLACE_WITH_KV_NAMESPACE_ID");
  expect(headersArtifact).toContain("strict-transport-security:");
}, 60_000);
