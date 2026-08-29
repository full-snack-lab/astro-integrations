import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

const playgroundRoot = fileURLToPath(new URL("../../../playground/", import.meta.url));

test("playground builds with the injected route and middleware", async () => {
  const child = Bun.spawn(["bun", "run", "build"], {
    cwd: playgroundRoot,
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);

  if (exitCode !== 0) {
    throw new Error(`Playground build failed:\n${stderr}`);
  }

  expect(exitCode).toBe(0);
}, 60_000);
