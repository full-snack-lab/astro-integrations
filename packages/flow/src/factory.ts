import { isHTMLString, type HTMLString as RenderedHTML } from "astro/runtime/server/escape.js";
import type { ComponentSlots } from "astro/runtime/server/index.js";
import { HTMLString, type IterationSource, iterate } from "./runtime.js";
import {
  evaluateCase,
  getSwitchState,
  isTruthyWhenProps,
  runWithSwitchState,
} from "./state.js";

export type CaseValue =
  | string
  | number
  | boolean
  | bigint
  | null
  | undefined
  | readonly CaseValue[]
  | Readonly<Record<string, unknown>>;

export type CasePredicate = (value: unknown) => boolean;

export type CaseProps =
  | { of: CaseValue | CasePredicate; default?: never }
  | { default: true; of?: never };

export interface SwitchProps {
  of?: unknown;
  test?: unknown;
}

export type WhenProps = Record<string, unknown>;

export interface IterateProps<Value, Result> {
  of?: IterationSource<Value>;
  children?: (item: Value, index: number | string) => Result;
}

/** The documented slot operations used by flow; raw compiler slots are separate. */
export interface AstroSlots {
  render<Value>(name: string, args?: [Value, number | string]): Promise<string | RenderedHTML>;
  has(name: string): boolean;
}

/** The slice of Astro's factory result that binds raw slots to their render context. */
export interface AstroRenderContext {
  createAstro(
    props: Record<string, unknown>,
    slots: ComponentSlots,
  ): { slots: AstroSlots };
}

export interface AstroComponentInstance {
  [Symbol.toStringTag]: string;
  [Symbol.asyncIterator](): AsyncGenerator<RenderedHTML, void, undefined>;
}

export interface AstroComponentFactory<Props = Record<string, unknown>, Result = unknown> {
  (result: AstroRenderContext, props: Props, slots: ComponentSlots): Result;
  isAstroComponentFactory: boolean;
}

/**
 * Render each item through Astro's function-child API, sequentially and with its index/key.
 *
 * @remarks Missing sources or default slots render nothing. Astro owns callback invocation,
 * escaping, and async child rendering; only its rendered HTML is marked trusted here.
 * Already-marked slot strings retain their identity and rendering instructions.
 * This adapter is shared by the factories and the source `.astro` entry points.
 */
export async function* renderIteration<Value>(
  source: IterationSource<Value> | undefined,
  slots: AstroSlots,
): AsyncGenerator<RenderedHTML, void, undefined> {
  if (source === undefined || !slots.has("default")) return;

  for await (const html of iterate(source, (value, index) => slots.render("default", [value, index]))) {
    yield isHTMLString(html) ? html : new HTMLString(html);
  }
}

function iterateComponent<Value>(
  result: AstroRenderContext,
  props: { of?: IterationSource<Value> },
  slots: ComponentSlots,
): AstroComponentInstance {
  const astroSlots = result.createAstro({ ...props }, slots).slots;
  return {
    [Symbol.toStringTag]: "AstroComponent",
    [Symbol.asyncIterator]() {
      return renderIteration(props.of, astroSlots);
    },
  };
}

export const Iterate: typeof iterateComponent & { isAstroComponentFactory: boolean } = Object.assign(
  iterateComponent,
  { isAstroComponentFactory: true },
);

async function switchComponent(
  result: AstroRenderContext,
  props: SwitchProps,
  slots: ComponentSlots,
): Promise<HTMLString> {
  const astroSlots = result.createAstro({ ...props }, slots).slots;
  const condition = props.of ?? props.test;
  const state = { hasRenderedCase: false, hasRenderedDefault: false, value: condition };

  return runWithSwitchState(state, async () => {
    const htmlContent = await astroSlots.render("default");
    return new HTMLString(htmlContent);
  });
}

export const Switch: AstroComponentFactory<SwitchProps, Promise<HTMLString>> = Object.assign(
  switchComponent,
  { isAstroComponentFactory: true },
);

async function caseComponent(
  result: AstroRenderContext,
  props: CaseProps,
  slots: ComponentSlots,
): Promise<HTMLString> {
  const switchState = getSwitchState();
  if (!switchState) {
    throw new Error("<Case> must be rendered within an active <Switch> component.");
  }

  const shouldRender = evaluateCase(props, switchState);
  if (shouldRender) {
    const astroSlots = result.createAstro({ ...props }, slots).slots;
    return new HTMLString(await astroSlots.render("default"));
  }

  return new HTMLString("");
}

export const Case: AstroComponentFactory<CaseProps, Promise<HTMLString>> = Object.assign(
  caseComponent,
  { isAstroComponentFactory: true },
);

async function whenComponent(
  result: AstroRenderContext,
  props: WhenProps,
  slots: ComponentSlots,
): Promise<HTMLString> {
  const astroSlots = result.createAstro(props, slots).slots;
  const isTruthy = isTruthyWhenProps(props);
  if (isTruthy) {
    return new HTMLString(await astroSlots.render("default"));
  }
  if (astroSlots.has("else")) {
    return new HTMLString(await astroSlots.render("else"));
  }
  return new HTMLString("");
}

export const When: AstroComponentFactory<WhenProps, Promise<HTMLString>> = Object.assign(
  whenComponent,
  { isAstroComponentFactory: true },
);

export const AstroIterate: typeof Iterate = Iterate;
export const AstroSwitch: AstroComponentFactory<SwitchProps, Promise<HTMLString>> = Switch;
export const AstroCase: AstroComponentFactory<CaseProps, Promise<HTMLString>> = Case;
export const AstroWhen: AstroComponentFactory<WhenProps, Promise<HTMLString>> = When;
