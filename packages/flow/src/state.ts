import { AsyncLocalStorage } from "node:async_hooks";

export interface SwitchState {
  value: unknown;
  hasRenderedCase: boolean;
  hasRenderedDefault: boolean;
}

const symbol: symbol = Symbol.for("astro-switch");

interface GlobalWithSwitch {
  [key: symbol]: SwitchState[] | undefined;
}

const switchGlobal = globalThis as typeof globalThis & GlobalWithSwitch;
const fallbackGlobalStack: SwitchState[] = (switchGlobal[symbol] ??= []);

let asyncLocalStorage: AsyncLocalStorage<SwitchState[]> | undefined;
try {
  asyncLocalStorage = new AsyncLocalStorage<SwitchState[]>();
} catch {
  asyncLocalStorage = undefined;
}

function getActiveStack(): SwitchState[] {
  const store = asyncLocalStorage?.getStore();
  if (store) return store;
  return fallbackGlobalStack;
}

/**
 * Array of shared switch states. Delegates dynamically to the active AsyncLocalStorage
 * store if present, or to the globalThis fallback stack.
 */
export const statesOfSwitch: SwitchState[] = new Proxy(fallbackGlobalStack, {
  get(_target, prop) {
    const stack = getActiveStack();
    if (prop === "length") {
      return stack.length;
    }
    const val = Reflect.get(stack, prop, stack);
    if (typeof val === "function") {
      return val.bind(stack);
    }
    return val;
  },
  set(_target, prop, value) {
    const stack = getActiveStack();
    return Reflect.set(stack, prop, value, stack);
  },
  has(_target, prop) {
    const stack = getActiveStack();
    return Reflect.has(stack, prop);
  },
  deleteProperty(_target, prop) {
    const stack = getActiveStack();
    return Reflect.deleteProperty(stack, prop);
  },
  ownKeys(_target) {
    const stack = getActiveStack();
    return Reflect.ownKeys(stack);
  },
  getOwnPropertyDescriptor(_target, prop) {
    const stack = getActiveStack();
    return Reflect.getOwnPropertyDescriptor(stack, prop);
  },
});

/** Pushes a new SwitchState onto the current active switch stack. */
export function pushSwitchState(state: SwitchState): void {
  getActiveStack().push(state);
}

/** Pops the current active SwitchState from the active switch stack. */
export function popSwitchState(): SwitchState | undefined {
  return getActiveStack().pop();
}

/** Returns the current active SwitchState at the top of the active switch stack. */
export function getSwitchState(): SwitchState | undefined {
  return getActiveStack().at(-1);
}

/**
 * Evaluates whether a Case component should render.
 * Enforces that only the first matching case renders; subsequent matching cases or default cases
 * are ignored once a match has occurred.
 */
export function evaluateCase(
  caseProps: { of?: unknown; default?: boolean },
  switchState: SwitchState,
): boolean {
  if (caseProps.default) {
    if (!switchState.hasRenderedCase && !switchState.hasRenderedDefault) {
      switchState.hasRenderedDefault = true;
      return true;
    }
    return false;
  }

  if (switchState.hasRenderedCase || switchState.hasRenderedDefault) {
    return false;
  }

  const ofArg = caseProps.of;
  const isMatch =
    typeof ofArg === "function"
      ? Boolean((ofArg as (val: unknown) => boolean)(switchState.value))
      : ofArg === switchState.value;

  if (isMatch) {
    switchState.hasRenderedCase = true;
    return true;
  }

  return false;
}

/** Evaluates whether all properties in a When props object are truthy. */
export function isTruthyWhenProps(props: Record<string, unknown>): boolean {
  const values = Object.values(props);
  return values.length > 0 && values.every((v) => Boolean(v));
}

function removeSwitchState(state: SwitchState): void {
  const stack = getActiveStack();
  const index = stack.lastIndexOf(state);
  if (index !== -1) {
    stack.splice(index, 1);
  }
}

/**
 * Executes a callback within an isolated switch state context using AsyncLocalStorage.
 */
export function runWithSwitchState<T>(
  state: SwitchState,
  callback: () => T | Promise<T>,
): T | Promise<T> {
  const currentStore = asyncLocalStorage?.getStore();
  if (currentStore) {
    currentStore.push(state);
    try {
      const result = callback();
      if (result && typeof (result as Promise<T>).then === "function") {
        return (result as Promise<T>).finally(() => {
          removeSwitchState(state);
        });
      }
      removeSwitchState(state);
      return result;
    } catch (err) {
      removeSwitchState(state);
      throw err;
    }
  }

  const newStack: SwitchState[] = [state];
  if (asyncLocalStorage) {
    return asyncLocalStorage.run(newStack, () => {
      try {
        const result = callback();
        if (result && typeof (result as Promise<T>).then === "function") {
          return (result as Promise<T>).finally(() => {
            removeSwitchState(state);
          });
        }
        removeSwitchState(state);
        return result;
      } catch (err) {
        removeSwitchState(state);
        throw err;
      }
    });
  }

  fallbackGlobalStack.push(state);
  try {
    const result = callback();
    if (result && typeof (result as Promise<T>).then === "function") {
      return (result as Promise<T>).finally(() => {
        removeSwitchState(state);
      });
    }
    removeSwitchState(state);
    return result;
  } catch (err) {
    removeSwitchState(state);
    throw err;
  }
}

