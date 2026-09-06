import { describe, expect, test } from "bun:test";
import {
  HTMLString,
  isIterable,
  iterate,
  type IterationSource,
  evaluateCase,
  getSwitchState,
  isTruthyWhenProps,
  popSwitchState,
  pushSwitchState,
  statesOfSwitch,
  type SwitchState,
} from "../src/index.js";

async function collect<Value>(source: AsyncIterable<Value>): Promise<Value[]> {
  const values: Value[] = [];
  for await (const value of source) values.push(value);
  return values;
}

describe("@fullsnacklab/astro-flow", () => {
  describe("iterate() protocol", () => {
    test("iterates synchronous arrays with 0-based numeric indexes", async () => {
      const result = await collect(
        iterate(["apple", "banana", "cherry"], (item, index) => `${index}:${item}`),
      );
      expect(result).toEqual(["0:apple", "1:banana", "2:cherry"]);
    });

    test("iterates synchronous Sets with numeric indexes", async () => {
      const set = new Set([10, 20, 30]);
      const result = await collect(iterate(set, (item, index) => `${index}:${item}`));
      expect(result).toEqual(["0:10", "1:20", "2:30"]);
    });

    test("iterates string-keyed object records with property keys", async () => {
      const record = { title: "Astro", category: "Framework", year: 2026 };
      const result = await collect(iterate(record, (value, key) => `${key}=${value}`));
      expect(result).toEqual(["title=Astro", "category=Framework", "year=2026"]);
    });

    test("handles empty arrays, sets, and records gracefully", async () => {
      expect(await collect(iterate([], () => 1))).toEqual([]);
      expect(await collect(iterate(new Set(), () => 1))).toEqual([]);
      expect(await collect(iterate({}, () => 1))).toEqual([]);
    });

    test("iterates asynchronous generators sequentially", async () => {
      async function* generateNumbers() {
        yield 1;
        yield 2;
        yield 3;
      }

      const result = await collect(
        iterate(generateNumbers(), async (num, index) => `${index}:${num * 10}`),
      );
      expect(result).toEqual(["0:10", "1:20", "2:30"]);
    });

    test("flattens values yielded by synchronous generator callbacks", async () => {
      const result = await collect(
        iterate([1, 2], function* (n) {
          yield n;
          yield n * 10;
        }),
      );
      expect(result).toEqual([1, 10, 2, 20]);
    });

    test("flattens values yielded by asynchronous generator callbacks", async () => {
      const result = await collect(
        iterate(["a", "b"], async function* (char) {
          yield char.toUpperCase();
          yield `${char}!`;
        }),
      );
      expect(result).toEqual(["A", "a!", "B", "b!"]);
    });

    test("flattens generators even when constructor property is tampered or null", async () => {
      const generatorFn = function* (x: number) {
        yield x;
        yield x * 2;
      };
      Object.defineProperty(generatorFn, "constructor", { value: null });

      const result = await collect(iterate([5], generatorFn));
      expect(result).toEqual([5, 10]);
    });

    test("throws descriptive error when source is null or undefined", async () => {
      await expect(collect(iterate(null as unknown as IterationSource<unknown>, () => {}))).rejects.toThrow(
        "Iteration source must be a non-null iterable or object.",
      );
      await expect(collect(iterate(undefined as unknown as IterationSource<unknown>, () => {}))).rejects.toThrow(
        "Iteration source must be a non-null iterable or object.",
      );
    });

    test("throws descriptive error when callback is not a function", async () => {
      await expect(collect(iterate([1, 2], null as unknown as () => void))).rejects.toThrow(
        "Iteration callback must be a function.",
      );
      await expect(collect(iterate({ a: 1 }, undefined as unknown as () => void))).rejects.toThrow(
        "Iteration callback must be a function.",
      );
    });
  });

  describe("isIterable() type guard", () => {
    test("returns true for synchronous and asynchronous iterables", () => {
      expect(isIterable([])).toBe(true);
      expect(isIterable(new Set())).toBe(true);
      expect(isIterable(new Map())).toBe(true);
      expect(isIterable("string")).toBe(true);
      expect(isIterable((function* () {})())).toBe(true);
      expect(isIterable((async function* () {})())).toBe(true);

      const customIterable = {
        [Symbol.iterator]: function* () {
          yield 1;
        },
      };
      expect(isIterable(customIterable)).toBe(true);
    });

    test("returns false for non-iterables, objects, and primitives", () => {
      expect(isIterable({})).toBe(false);
      expect(isIterable({ length: 5 })).toBe(false);
      expect(isIterable(123)).toBe(false);
      expect(isIterable(true)).toBe(false);
      expect(isIterable(Symbol("test"))).toBe(false);
      expect(isIterable(null)).toBe(false);
      expect(isIterable(undefined)).toBe(false);
    });
  });

  describe("HTMLString class", () => {
    test("subclasses String and preserves string value", () => {
      const html = new HTMLString("<strong>Bold content</strong>");
      expect(html instanceof String).toBe(true);
      expect(String(html)).toBe("<strong>Bold content</strong>");
      expect(html.toString()).toBe("<strong>Bold content</strong>");
    });

    test("defines Symbol.toStringTag as 'HTMLString'", () => {
      const html = new HTMLString("<div>test</div>");
      expect(html[Symbol.toStringTag]).toBe("HTMLString");
      expect(Object.prototype.toString.call(html)).toBe("[object HTMLString]");
    });
  });

  describe("Switch and Case state machine", () => {
    test("pushes and pops switch state onto stack", () => {
      const state: SwitchState = {
        value: "winner",
        hasRenderedCase: false,
        hasRenderedDefault: false,
      };

      pushSwitchState(state);
      expect(getSwitchState()).toBe(state);

      const popped = popSwitchState();
      expect(popped).toBe(state);
      expect(getSwitchState()).toBeUndefined();
    });

    test("statesOfSwitch provides backward-compatible array view", () => {
      const state: SwitchState = {
        value: "compat",
        hasRenderedCase: false,
        hasRenderedDefault: false,
      };
      statesOfSwitch.push(state);
      expect(statesOfSwitch.length).toBe(1);
      expect(statesOfSwitch.at(-1)).toBe(state);
      statesOfSwitch.pop();
      expect(statesOfSwitch.length).toBe(0);
    });

    test("evaluates exact matching Case and prevents subsequent cases", () => {
      const state: SwitchState = {
        value: "second",
        hasRenderedCase: false,
        hasRenderedDefault: false,
      };
      pushSwitchState(state);

      // Case 1: value "first" -> no match
      const case1Matches = evaluateCase({ of: "first" }, state);
      expect(case1Matches).toBe(false);
      expect(state.hasRenderedCase).toBe(false);

      // Case 2: value "second" -> matches!
      const case2Matches = evaluateCase({ of: "second" }, state);
      expect(case2Matches).toBe(true);
      expect(state.hasRenderedCase).toBe(true);

      // Case 3: value "second" -> should NOT render because hasRenderedCase is true
      const case3Matches = evaluateCase({ of: "second" }, state);
      expect(case3Matches).toBe(false);

      // Case 4: default case -> should NOT render because a case already matched
      const defaultMatches = evaluateCase({ default: true }, state);
      expect(defaultMatches).toBe(false);

      popSwitchState();
    });

    test("evaluates function predicate in Case", () => {
      const state: SwitchState = {
        value: 42,
        hasRenderedCase: false,
        hasRenderedDefault: false,
      };
      pushSwitchState(state);

      const predicate = (val: unknown) => typeof val === "number" && val > 40;
      const matches = evaluateCase({ of: predicate }, state);
      expect(matches).toBe(true);
      expect(state.hasRenderedCase).toBe(true);

      // Subsequent matching predicate must not render because hasRenderedCase is true
      const matchesAgain = evaluateCase({ of: (val: unknown) => typeof val === "number" && val > 20 }, state);
      expect(matchesAgain).toBe(false);

      popSwitchState();
    });

    test("renders default case only when no prior case matched", () => {
      // Scenario A: Case matched
      const stateA: SwitchState = {
        value: "matched",
        hasRenderedCase: false,
        hasRenderedDefault: false,
      };
      pushSwitchState(stateA);
      const matched = evaluateCase({ of: "matched" }, stateA);
      expect(matched).toBe(true);
      const defaultA = evaluateCase({ default: true }, stateA);
      expect(defaultA).toBe(false);
      popSwitchState();

      // Scenario B: No case matched
      const stateB: SwitchState = {
        value: "unmatched",
        hasRenderedCase: false,
        hasRenderedDefault: false,
      };
      pushSwitchState(stateB);
      const notMatched = evaluateCase({ of: "other" }, stateB);
      expect(notMatched).toBe(false);
      const defaultB = evaluateCase({ default: true }, stateB);
      expect(defaultB).toBe(true);
      expect(stateB.hasRenderedDefault).toBe(true);

      // Second default case must not render
      const defaultBSecond = evaluateCase({ default: true }, stateB);
      expect(defaultBSecond).toBe(false);
      popSwitchState();
    });
  });

  describe("When condition evaluation", () => {
    test("is truthy when all props are truthy", () => {
      const propsTrue = { isLoaded: true, hasAccess: 1, name: "Admin" };
      expect(isTruthyWhenProps(propsTrue)).toBe(true);
    });

    test("is falsy when any prop is falsy", () => {
      const propsFalse = { isLoaded: true, hasAccess: 0, name: "Admin" };
      expect(isTruthyWhenProps(propsFalse)).toBe(false);
    });

    test("is falsy for empty props object", () => {
      expect(isTruthyWhenProps({})).toBe(false);
    });
  });
});
