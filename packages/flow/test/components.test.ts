import { describe, expect, test } from "bun:test";
import {
  AstroCase,
  AstroIterate,
  AstroSwitch,
  AstroWhen,
  Case,
  Iterate,
  Switch,
  When,
  type AstroSlots,
} from "../src/index.js";
import { statesOfSwitch } from "../src/state.js";

function createMockSlots(slots: Record<string, string | (() => unknown)>): AstroSlots {
  return {
    render: async (name: string) => {
      const val = slots[name];
      if (typeof val === "function") {
        const res = await val();
        return String(res ?? "");
      }
      return String(val ?? "");
    },
    has: (name: string) => name in slots,
    default: () => {
      const val = slots["default"];
      if (typeof val === "function") {
        return { expressions: [val] };
      }
      return { expressions: [] };
    },
  };
}

describe("Switch and Case component factories", () => {
  test("aliases match primary component names", () => {
    expect(AstroSwitch).toBe(Switch);
    expect(AstroCase).toBe(Case);
    expect(AstroWhen).toBe(When);
    expect(AstroIterate).toBe(Iterate);
  });

  test("evaluates matching case and skips non-matching cases", async () => {
    const renderedCases: string[] = [];

    const slots = createMockSlots({
      default: async () => {
        const case1 = await Case(
          {},
          { of: "target" },
          createMockSlots({ default: "case1-rendered" }),
        );
        if (String(case1)) renderedCases.push(String(case1));

        const case2 = await Case(
          {},
          { of: "other" },
          createMockSlots({ default: "case2-rendered" }),
        );
        if (String(case2)) renderedCases.push(String(case2));

        return renderedCases.join(",");
      },
    });

    const result = await Switch({}, { of: "target" }, slots);
    expect(String(result)).toBe("case1-rendered");
    expect(statesOfSwitch).toHaveLength(0); // State popped
  });

  test("renders default case when no cases match", async () => {
    const slots = createMockSlots({
      default: async () => {
        const c1 = await Case({}, { of: "one" }, createMockSlots({ default: "one" }));
        const def = await Case({}, { default: true }, createMockSlots({ default: "default-val" }));
        return [String(c1), String(def)].filter(Boolean).join("");
      },
    });

    const result = await Switch({}, { of: "unmatched" }, slots);
    expect(String(result)).toBe("default-val");
    expect(statesOfSwitch).toHaveLength(0);
  });

  test("cleans up switch stack even if inner rendering throws", async () => {
    const brokenSlots: AstroSlots = {
      render: async () => {
        throw new Error("rendering crash");
      },
      has: () => false,
    };

    await expect(Switch({}, { of: "test" }, brokenSlots)).rejects.toThrow("rendering crash");
    expect(statesOfSwitch).toHaveLength(0);
  });

  test("rejects Case rendered outside Switch", async () => {
    await expect(Case({}, { of: "x" }, createMockSlots({ default: "x" }))).rejects.toThrow(
      "<Case> must be rendered within an active <Switch>",
    );
  });
});

describe("When component factory", () => {
  test("renders default slot when conditions are truthy", async () => {
    const slots = createMockSlots({
      default: "visible",
      else: "hidden",
    });
    const result = await When({}, { a: true, b: 1, c: "text" }, slots);
    expect(String(result)).toBe("visible");
  });

  test("renders else slot when condition is falsy", async () => {
    const slots = createMockSlots({
      default: "visible",
      else: "fallback",
    });
    const result = await When({}, { active: false }, slots);
    expect(String(result)).toBe("fallback");
  });
});
