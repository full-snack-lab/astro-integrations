import { describe, expect, test } from "bun:test";
import { isHTMLString, type HTMLString } from "astro/runtime/server/escape.js";
import { SlotString } from "astro/runtime/server/render/slot.js";
import {
  AstroCase,
  AstroIterate,
  AstroSwitch,
  AstroWhen,
  Case,
  Iterate,
  Switch,
  When,
  renderIteration,
  type AstroRenderContext,
  type AstroSlots,
} from "../src/index.js";
import { statesOfSwitch } from "../src/state.js";

type SlotContent = string | (() => string | Promise<string>);

function createMockSlots(slots: Record<string, SlotContent>): AstroSlots {
  return {
    render: async (name: string) => {
      const value = slots[name];
      return typeof value === "function" ? await value() : value ?? "";
    },
    has: (name: string) => name in slots,
  };
}

function createRenderContext(slots: AstroSlots): AstroRenderContext {
  return { createAstro: () => ({ slots }) };
}

async function collectHTML(content: AsyncIterable<HTMLString>): Promise<string[]> {
  const values: string[] = [];
  for await (const html of content) {
    expect(isHTMLString(html)).toBe(true);
    values.push(String(html));
  }
  return values;
}

describe("Switch and Case component factories", () => {
  test("aliases match primary component names", () => {
    expect(AstroSwitch).toBe(Switch);
    expect(AstroCase).toBe(Case);
    expect(AstroWhen).toBe(When);
    expect(AstroIterate).toBe(Iterate);
  });

  test("evaluates matching case and skips non-matching cases", async () => {
    const slots = createMockSlots({
      default: async () => {
        const case1 = await Case(
          createRenderContext(createMockSlots({ default: "case1-rendered" })),
          { of: "target" },
          {},
        );
        const case2 = await Case(
          createRenderContext(createMockSlots({ default: "case2-rendered" })),
          { of: "other" },
          {},
        );
        return [String(case1), String(case2)].filter(Boolean).join(",");
      },
    });

    const result = await Switch(createRenderContext(slots), { of: "target" }, {});
    expect(String(result)).toBe("case1-rendered");
    expect(isHTMLString(result)).toBe(true);
    expect(statesOfSwitch).toHaveLength(0);
  });

  test("renders default case when no cases match", async () => {
    const slots = createMockSlots({
      default: async () => {
        const match = await Case(
          createRenderContext(createMockSlots({ default: "one" })),
          { of: "one" },
          {},
        );
        const fallback = await Case(
          createRenderContext(createMockSlots({ default: "default-val" })),
          { default: true },
          {},
        );
        return [String(match), String(fallback)].filter(Boolean).join("");
      },
    });

    const result = await Switch(createRenderContext(slots), { of: "unmatched" }, {});
    expect(String(result)).toBe("default-val");
    expect(statesOfSwitch).toHaveLength(0);
  });

  test("cleans up switch state even if slot rendering throws", async () => {
    const slots: AstroSlots = {
      render: async () => {
        throw new Error("rendering crash");
      },
      has: () => true,
    };

    await expect(Switch(createRenderContext(slots), { of: "test" }, {})).rejects.toThrow(
      "rendering crash",
    );
    expect(statesOfSwitch).toHaveLength(0);
  });

  test("rejects Case rendered outside Switch", async () => {
    const context = createRenderContext(createMockSlots({ default: "x" }));
    await expect(Case(context, { of: "x" }, {})).rejects.toThrow(
      "<Case> must be rendered within an active <Switch>",
    );
  });
});

describe("When component factory", () => {
  test("binds raw slots through the factory context and preserves trusted HTML", async () => {
    const rawSlots = {};
    const context: AstroRenderContext = {
      createAstro: (props, slots) => {
        expect(props).toEqual({ ready: true });
        expect(slots).toBe(rawSlots);
        return { slots: createMockSlots({ default: "<strong>visible</strong>" }) };
      },
    };

    const result = await When(context, { ready: true }, rawSlots);
    expect(String(result)).toBe("<strong>visible</strong>");
    expect(isHTMLString(result)).toBe(true);
  });

  test("renders else slot when condition is falsy", async () => {
    const slots = createMockSlots({ default: "visible", else: "fallback" });
    const result = await When(createRenderContext(slots), { active: false }, {});
    expect(String(result)).toBe("fallback");
  });

  test("renders nothing when no branch is available", async () => {
    const result = await When(createRenderContext(createMockSlots({})), {}, {});
    expect(String(result)).toBe("");
  });
});

describe("Iterate slot adapter", () => {
  const slots: AstroSlots = {
    has: (name) => name === "default",
    render: async (name, args) => {
      if (!args) throw new Error("Expected the iteration value and index/key.");
      return `${name}:${args[1]}:${String(args[0])}`;
    },
  };

  test("passes array values and numeric indexes through Astro.slots.render", async () => {
    const component = Iterate(createRenderContext(slots), { of: ["a", "b"] }, {});
    expect(await collectHTML(component)).toEqual(["default:0:a", "default:1:b"]);
  });

  test("preserves Astro slot strings and their rendering instructions", async () => {
    const html = new SlotString("<strong>child</strong>", null, ["<strong>child</strong>"]);
    const rendered: HTMLString[] = [];
    const markedSlots: AstroSlots = { has: () => true, render: async () => html };
    for await (const value of renderIteration([1], markedSlots)) rendered.push(value);
    expect(rendered).toHaveLength(1);
    expect(rendered[0]).toBe(html);
  });

  test("passes record keys without reading compiler expressions", async () => {
    expect(await collectHTML(renderIteration({ first: "a", second: "b" }, slots))).toEqual([
      "default:first:a",
      "default:second:b",
    ]);
  });

  test("renders asynchronous sources sequentially", async () => {
    async function* source(): AsyncGenerator<string, void, undefined> {
      yield "a";
      yield "b";
    }
    expect(await collectHTML(renderIteration(source(), slots))).toEqual([
      "default:0:a",
      "default:1:b",
    ]);
  });

  test("does not invoke slots for missing or empty sources", async () => {
    const unexpectedSlots: AstroSlots = {
      has: () => true,
      render: async () => {
        throw new Error("Unexpected slot rendering.");
      },
    };
    expect(await collectHTML(renderIteration(undefined, unexpectedSlots))).toEqual([]);
    expect(await collectHTML(renderIteration([], unexpectedSlots))).toEqual([]);
  });

  test("does not consume a source when its default slot is absent", async () => {
    let consumed = false;
    async function* source(): AsyncGenerator<string, void, undefined> {
      consumed = true;
      yield "unused";
    }
    expect(await collectHTML(renderIteration(source(), createMockSlots({})))).toEqual([]);
    expect(consumed).toBe(false);
  });

  test("propagates slot-rendering failures", async () => {
    const rejectedSlots: AstroSlots = {
      has: () => true,
      render: async () => {
        throw new Error("slot failed");
      },
    };
    await expect(collectHTML(renderIteration([1], rejectedSlots))).rejects.toThrow("slot failed");
  });
});
