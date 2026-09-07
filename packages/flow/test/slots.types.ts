import type { AstroGlobal } from "astro";
import type { HTMLString } from "astro/runtime/server/escape.js";
import type { ComponentSlots, renderSlotToString } from "astro/runtime/server/index.js";
import {
  Iterate,
  renderIteration,
  type AstroRenderContext,
  type AstroSlots,
} from "../src/index.js";

declare const frameworkResult: Parameters<typeof renderSlotToString>[0];
declare const frameworkSlots: AstroGlobal["slots"];
declare const rawSlots: ComponentSlots;

const context: AstroRenderContext = frameworkResult;
const slots: AstroSlots = frameworkSlots;
const items = [{ id: "one" }, { id: "two" }];

const factoryOutput: AsyncIterable<HTMLString> = Iterate(context, { of: items }, rawSlots);
const wrapperOutput: AsyncIterable<HTMLString> = renderIteration(items, slots);

// @ts-expect-error Raw compiler slots do not provide Astro.slots rendering operations.
renderIteration(items, rawSlots);
// @ts-expect-error Factories receive raw compiler slots, not the high-level slot utility object.
Iterate(context, { of: items }, frameworkSlots);
// @ts-expect-error A scalar number is not an iteration source.
renderIteration(123, slots);

void factoryOutput;
void wrapperOutput;
