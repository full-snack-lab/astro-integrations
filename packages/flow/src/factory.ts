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

export interface AstroSlots {
  render(name: string): Promise<string>;
  has(name: string): boolean;
  default?(): Promise<{ expressions?: readonly unknown[] }> | { expressions?: readonly unknown[] };
}

export interface AstroComponentInstance {
  [Symbol.toStringTag]: string;
  [Symbol.asyncIterator](): AsyncGenerator<unknown, void, undefined>;
}

export interface AstroComponentFactory<Props = Record<string, unknown>, Result = unknown> {
  (result: unknown, props: Props, slots: AstroSlots): Result;
  isAstroComponentFactory: boolean;
}

function iterateComponent<Value, Result>(
  _result: unknown,
  props: { of?: IterationSource<Value> },
  slots: AstroSlots,
): AstroComponentInstance {
  const promiseOfGenerator = Promise.resolve(slots.default?.()).then(
    (res) => res?.expressions?.at(0) as ((item: Value, index: number | string) => Result) | undefined,
  );

  return {
    [Symbol.toStringTag]: "AstroComponent",
    async *[Symbol.asyncIterator]() {
      const generator = await promiseOfGenerator;
      if (generator && props.of !== undefined) {
        yield* iterate(props.of, generator);
      }
    },
  };
}

export const Iterate: AstroComponentFactory<{ of?: IterationSource<unknown> }, AstroComponentInstance> = Object.assign(
  iterateComponent,
  { isAstroComponentFactory: true },
);

async function switchComponent(
  _result: unknown,
  props: SwitchProps,
  slots: AstroSlots,
): Promise<HTMLString> {
  const condition = props.of ?? props.test;
  const state = { hasRenderedCase: false, hasRenderedDefault: false, value: condition };

  return runWithSwitchState(state, async () => {
    const htmlContent = await slots.render("default");
    return new HTMLString(htmlContent);
  });
}

export const Switch: AstroComponentFactory<SwitchProps, Promise<HTMLString>> = Object.assign(
  switchComponent,
  { isAstroComponentFactory: true },
);

async function caseComponent(
  _result: unknown,
  props: CaseProps,
  slots: AstroSlots,
): Promise<HTMLString> {
  const switchState = getSwitchState();
  if (!switchState) {
    throw new Error("<Case> must be rendered within an active <Switch> component.");
  }

  const shouldRender = evaluateCase(props, switchState);
  if (shouldRender) {
    return new HTMLString(await slots.render("default"));
  }

  return new HTMLString("");
}

export const Case: AstroComponentFactory<CaseProps, Promise<HTMLString>> = Object.assign(
  caseComponent,
  { isAstroComponentFactory: true },
);

async function whenComponent(
  _result: unknown,
  props: WhenProps,
  slots: AstroSlots,
): Promise<HTMLString> {
  const isTruthy = isTruthyWhenProps(props);
  if (isTruthy) {
    return new HTMLString(await slots.render("default"));
  }
  if (slots.has("else")) {
    return new HTMLString(await slots.render("else"));
  }
  return new HTMLString("");
}

export const When: AstroComponentFactory<WhenProps, Promise<HTMLString>> = Object.assign(
  whenComponent,
  { isAstroComponentFactory: true },
);

export const AstroIterate: AstroComponentFactory<{ of?: IterationSource<unknown> }, AstroComponentInstance> = Iterate;
export const AstroSwitch: AstroComponentFactory<SwitchProps, Promise<HTMLString>> = Switch;
export const AstroCase: AstroComponentFactory<CaseProps, Promise<HTMLString>> = Case;
export const AstroWhen: AstroComponentFactory<WhenProps, Promise<HTMLString>> = When;
