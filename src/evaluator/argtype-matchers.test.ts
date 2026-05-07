/**
 * Per-kind matcher coverage for the ArgType union extended in
 * template-laws-3gt.1.
 *
 * [LAW:single-enforcer + LAW:verifiable-goals] These tests pin the
 * matcher's per-kind behavior against synthetic FuncMaps so that the
 * migration tickets (.2–.8) move slots to a precise kind without
 * re-deriving "what does this kind mean" from scratch.
 *
 * Synthetic registrations are used deliberately: no built-in declares
 * any of the new kinds yet (that's .2–.8). The matcher is exercised
 * via `engine.parse(...).evaluate(...)` so the tests run through the
 * same dispatch path the production engine uses, including the
 * `engine.toString` plumbing.
 */

import { describe, expect, it } from "vitest";
import { TypeMismatchError } from "./errors.js";
import { createEngine, type FuncMap, type TemplateFunc } from "./evaluator.js";

// Build a string-output engine with one synthetic func registered
// against the kind under test. The body is a constant returning the
// arg's `typeof` (or "ok") so the test asserts on whether dispatch
// throws — the body itself never runs when the gate rejects.
function engineWithKind(
  funcName: string,
  funcDef: TemplateFunc,
  toString?: (value: unknown) => string,
) {
  const funcs: FuncMap = { [funcName]: funcDef };
  return createEngine<string>({
    fromString: (s) => s,
    funcs,
    ...(toString ? { toString: toString as (value: string) => string } : {}),
  });
}

const accept = (): TemplateFunc => ({
  fn: () => "ok",
  argTypes: [],
});

describe("matchesArgType — list", () => {
  it("accepts arrays", () => {
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["list"] });
    expect(eng.parse("{{ f . }}").evaluate([1, 2, 3]).join("")).toBe("ok");
  });

  it("rejects strings (Go-parity: string is not a list)", () => {
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["list"] });
    expect(() => eng.parse("{{ f . }}").evaluate("abc")).toThrow(TypeMismatchError);
  });

  it("rejects plain objects", () => {
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["list"] });
    expect(() => eng.parse("{{ f . }}").evaluate({ a: 1 })).toThrow(TypeMismatchError);
  });

  it("rejects null", () => {
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["list"] });
    expect(() => eng.parse("{{ f . }}").evaluate(null)).toThrow(TypeMismatchError);
  });
});

describe("matchesArgType — dict", () => {
  it("accepts plain objects", () => {
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["dict"] });
    expect(eng.parse("{{ f . }}").evaluate({ a: 1 }).join("")).toBe("ok");
  });

  it("accepts null-prototype objects", () => {
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["dict"] });
    const bag = Object.create(null) as Record<string, unknown>;
    bag.k = 1;
    expect(eng.parse("{{ f . }}").evaluate(bag).join("")).toBe("ok");
  });

  it("rejects arrays", () => {
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["dict"] });
    expect(() => eng.parse("{{ f . }}").evaluate([1, 2])).toThrow(TypeMismatchError);
  });

  it("rejects Maps (handled separately)", () => {
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["dict"] });
    expect(() => eng.parse("{{ f . }}").evaluate(new Map([["k", 1]]))).toThrow(TypeMismatchError);
  });

  it("rejects Sets and class instances", () => {
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["dict"] });
    expect(() => eng.parse("{{ f . }}").evaluate(new Set([1]))).toThrow(TypeMismatchError);
    class Wrapper {}
    expect(() => eng.parse("{{ f . }}").evaluate(new Wrapper())).toThrow(TypeMismatchError);
  });

  it("rejects null", () => {
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["dict"] });
    expect(() => eng.parse("{{ f . }}").evaluate(null)).toThrow(TypeMismatchError);
  });
});

describe("matchesArgType — sized", () => {
  it("accepts strings, arrays, Maps, Sets, plain objects", () => {
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["sized"] });
    expect(eng.parse("{{ f . }}").evaluate("abc").join("")).toBe("ok");
    expect(eng.parse("{{ f . }}").evaluate([1, 2]).join("")).toBe("ok");
    expect(
      eng
        .parse("{{ f . }}")
        .evaluate(new Map([["k", 1]]))
        .join(""),
    ).toBe("ok");
    expect(
      eng
        .parse("{{ f . }}")
        .evaluate(new Set([1]))
        .join(""),
    ).toBe("ok");
    expect(eng.parse("{{ f . }}").evaluate({ a: 1 }).join("")).toBe("ok");
  });

  it("rejects numbers and booleans", () => {
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["sized"] });
    expect(() => eng.parse("{{ f . }}").evaluate(42)).toThrow(TypeMismatchError);
    expect(() => eng.parse("{{ f . }}").evaluate(true)).toThrow(TypeMismatchError);
  });

  it("rejects null", () => {
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["sized"] });
    expect(() => eng.parse("{{ f . }}").evaluate(null)).toThrow(TypeMismatchError);
  });
});

describe("matchesArgType — comparable", () => {
  it("accepts strings, numbers, bigints, booleans, null, undefined", () => {
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["comparable"] });
    expect(eng.parse("{{ f . }}").evaluate("a").join("")).toBe("ok");
    expect(eng.parse("{{ f . }}").evaluate(1).join("")).toBe("ok");
    expect(eng.parse("{{ f . }}").evaluate(1n).join("")).toBe("ok");
    expect(eng.parse("{{ f . }}").evaluate(true).join("")).toBe("ok");
    expect(eng.parse("{{ f . }}").evaluate(null).join("")).toBe("ok");
    expect(eng.parse("{{ f . }}").evaluate(undefined).join("")).toBe("ok");
  });

  it("rejects arrays and plain objects (deep-equal layered in .5)", () => {
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["comparable"] });
    expect(() => eng.parse("{{ f . }}").evaluate([1, 2])).toThrow(TypeMismatchError);
    expect(() => eng.parse("{{ f . }}").evaluate({ a: 1 })).toThrow(TypeMismatchError);
  });
});

describe("matchesArgType — callable", () => {
  it("accepts function values from the scope", () => {
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["callable"] });
    expect(
      eng
        .parse("{{ f .fn }}")
        .evaluate({ fn: () => 1 })
        .join(""),
    ).toBe("ok");
  });

  it("rejects non-function scope values", () => {
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["callable"] });
    expect(() => eng.parse("{{ f . }}").evaluate(42)).toThrow(TypeMismatchError);
    expect(() => eng.parse("{{ f . }}").evaluate("not-a-fn")).toThrow(TypeMismatchError);
  });
});

describe("matchesArgType — stringifiable", () => {
  it("accepts strings without invoking engine.toString", () => {
    let called = 0;
    const toString = (v: unknown): string => {
      called += 1;
      return String(v);
    };
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["stringifiable"] }, toString);
    expect(eng.parse("{{ f . }}").evaluate("hello").join("")).toBe("ok");
    expect(called).toBe(0);
  });

  it("accepts non-strings when engine.toString returns a string", () => {
    const eng = engineWithKind(
      "f",
      { fn: () => "ok", argTypes: ["stringifiable"] },
      (v) => `[${String(v)}]`,
    );
    expect(eng.parse("{{ f . }}").evaluate({ tag: "x" }).join("")).toBe("ok");
  });

  it("rejects non-strings under the default toString (which throws)", () => {
    // No `toString` supplied → engine uses default, which throws for
    // non-strings. The matcher catches the throw and returns false,
    // and enforceArgTypes raises TypeMismatchError naming the slot.
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["stringifiable"] });
    let caught: unknown;
    try {
      eng.parse("{{ f . }}").evaluate({ tag: "x" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(TypeMismatchError);
    if (caught instanceof TypeMismatchError) {
      expect(caught.funcName).toBe("f");
      expect(caught.argIndex).toBe(1);
    }
  });

  it("rejects non-strings when consumer toString throws", () => {
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["stringifiable"] }, (v) => {
      if (typeof v === "string") return v;
      throw new Error("cannot flatten");
    });
    expect(() => eng.parse("{{ f . }}").evaluate(42)).toThrow(TypeMismatchError);
  });
});

describe("matchesArgType — serializable", () => {
  it("accepts plain JSON-encodable shapes", () => {
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["serializable"] });
    expect(
      eng
        .parse("{{ f . }}")
        .evaluate({ a: 1, b: [2, "x"] })
        .join(""),
    ).toBe("ok");
    expect(eng.parse("{{ f . }}").evaluate([1, 2, 3]).join("")).toBe("ok");
    expect(eng.parse("{{ f . }}").evaluate("hello").join("")).toBe("ok");
    expect(eng.parse("{{ f . }}").evaluate(null).join("")).toBe("ok");
  });

  it("rejects functions", () => {
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["serializable"] });
    expect(() => eng.parse("{{ f .fn }}").evaluate({ fn: () => 1 })).toThrow(TypeMismatchError);
  });

  it("rejects bigint (not JSON-encodable)", () => {
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["serializable"] });
    expect(() => eng.parse("{{ f . }}").evaluate(1n)).toThrow(TypeMismatchError);
  });

  it("rejects circular references", () => {
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["serializable"] });
    const circ: Record<string, unknown> = { a: 1 };
    circ.self = circ;
    expect(() => eng.parse("{{ f . }}").evaluate(circ)).toThrow(TypeMismatchError);
  });
});

describe('argTypePattern: "alternating" (template-laws-3gt.3)', () => {
  // The cycle pattern lets a func declare that argTypes describes a
  // *period*, not a fixed prefix. dict's `string, value, string, value …`
  // kv pairing is the motivating case: the gate validates every
  // even-index arg as a string, eliminating the body-level per-key check.

  const altDict = (): TemplateFunc => ({
    fn: (...kv) => {
      const out: Record<string, unknown> = {};
      const args = kv as unknown[];
      for (let i = 0; i < args.length; i += 2) out[args[i] as string] = args[i + 1];
      return out;
    },
    argTypes: ["string", "value"],
    argTypePattern: "alternating",
  });

  it("accepts alternating string/value pairs at every cycle", () => {
    const eng = engineWithKind("d", altDict());
    // 3 cycles of (string, value) = 6 args. Field access on the result
    // verifies the kv pairing took effect without needing a sibling
    // func registered alongside `d`.
    expect(eng.parse('{{ (d "a" 1 "b" 2 "c" 3).c }}').evaluate(null).join("")).toBe("3");
  });

  it("rejects a non-string at the second key position (slot 3)", () => {
    const eng = engineWithKind("d", altDict());
    let caught: unknown;
    try {
      eng.parse('{{ d "a" 1 2 "v" }}').evaluate(null);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(TypeMismatchError);
    if (caught instanceof TypeMismatchError) {
      expect(caught.funcName).toBe("d");
      expect(caught.argIndex).toBe(3);
    }
  });

  it("rejects a non-string at the third key position (slot 5)", () => {
    const eng = engineWithKind("d", altDict());
    let caught: unknown;
    try {
      eng.parse('{{ d "a" 1 "b" 2 3 4 }}').evaluate(null);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(TypeMismatchError);
    if (caught instanceof TypeMismatchError) {
      expect(caught.argIndex).toBe(5);
    }
  });

  it("single string-keyed pair passes (i=0 cycles to argTypes[0])", () => {
    const eng = engineWithKind("d", altDict());
    expect(eng.parse('{{ (d "only" 7).only }}').evaluate(null).join("")).toBe("7");
  });
});

describe("matchesArgType — intent-named pass-through kinds", () => {
  // truthy / reflective / value share the "any" runtime behavior; the
  // matcher must accept anything for these kinds. The label exists so a
  // future grep can distinguish documented intent from escape-hatch use.
  for (const kind of ["truthy", "reflective", "value"] as const) {
    it(`${kind} accepts anything`, () => {
      const eng = engineWithKind("f", { fn: () => "ok", argTypes: [kind] });
      expect(eng.parse("{{ f . }}").evaluate(null).join("")).toBe("ok");
      expect(eng.parse("{{ f . }}").evaluate(42).join("")).toBe("ok");
      expect(eng.parse("{{ f . }}").evaluate({ x: 1 }).join("")).toBe("ok");
      expect(eng.parse("{{ f . }}").evaluate([1, 2, 3]).join("")).toBe("ok");
    });
  }
});

describe("EngineConfig.toString — defaults", () => {
  // Sanity: zero-arg func with no-arg `accept()` registration; just
  // confirms engineWithKind without a toString boots the engine.
  it("engine boots without an explicit toString", () => {
    const eng = engineWithKind("f", accept());
    expect(eng.parse("{{ f }}").evaluate(null).join("")).toBe("ok");
  });

  it("string passthrough is identity by default (T = string case)", () => {
    // No `toString` configured → default. `stringifiable` accepts the
    // string without ever invoking the consumer (verified by the
    // earlier "accepts strings without invoking engine.toString" test).
    const eng = engineWithKind("f", { fn: () => "ok", argTypes: ["stringifiable"] });
    expect(eng.parse("{{ f . }}").evaluate("ok").join("")).toBe("ok");
  });

  // Regression: `toString` collides with `Object.prototype.toString`.
  // A naive `config.toString ?? default` resolves to the inherited
  // method (truthy), which would silently flatten any object as
  // `[object Object]`. The engine must use `Object.hasOwn` so the
  // default kicks in for unconfigured engines.
  it("does not bind Object.prototype.toString when consumer omits toString", () => {
    const eng = createEngine<string>({
      fromString: (s) => s,
      funcs: { f: { fn: () => "ok", argTypes: ["stringifiable"] } },
    });
    // A plain object should be rejected — if the prototype's toString
    // were bound, it would return "[object Object]" and the matcher
    // would (wrongly) accept the value.
    expect(() => eng.parse("{{ f . }}").evaluate({ tag: "x" })).toThrow(TypeMismatchError);
  });
});
