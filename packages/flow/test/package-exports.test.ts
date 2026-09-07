import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

const componentsDirectory = new URL("../src/components/", import.meta.url);
const components = readdirSync(componentsDirectory).filter((file) => file.endsWith(".astro"));

describe("published Astro component runtime imports", () => {
  test("includes source components", () => {
    expect(components.length).toBeGreaterThan(0);
  });

  test.each(components)("%s uses the public runtime shared with the factories", (file) => {
    const source = readFileSync(new URL(file, componentsDirectory), "utf8");

    expect(source).toMatch(/from ["']@fullsnacklab\/astro-flow["']/);
    expect(source).not.toMatch(/from ["']\.\.\/(?:factory|runtime|state)\.js["']/);
  });
});
