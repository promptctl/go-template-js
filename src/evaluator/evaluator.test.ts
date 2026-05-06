import { describe, expect, it } from "vitest";
import { parse } from "../parser/parser.js";
import { EvalError } from "./errors.js";
import { createEngine, type Engine } from "./evaluator.js";

const stringEngine = (): Engine<string> => createEngine<string>({ fromString: (s) => s });

const renderString = (src: string, scope: unknown): string => {
  const { root } = parse(src);
  return stringEngine().evaluate(root, scope, src).join("");
};

describe("evaluator — text and dot", () => {
  it("emits text literals through fromString", () => {
    const eng = createEngine<{ kind: "txt"; v: string }>({
      fromString: (s) => ({ kind: "txt", v: s }),
    });
    const { root } = parse("hello");
    expect(eng.evaluate(root, null)).toEqual([{ kind: "txt", v: "hello" }]);
  });

  it("renders {{ . }} as the scope value via fromString", () => {
    expect(renderString("{{ . }}", "world")).toBe("world");
  });

  it("converts numeric dot values to text via fromString", () => {
    expect(renderString("n={{ . }}", 42)).toBe("n=42");
  });

  it("emits <no value> for nil/undefined pipe (matches Go text/template)", () => {
    // [LAW:dataflow-not-control-flow] Same emit path runs regardless
    // of pipe value; null/undefined produces the "<no value>" sentinel
    // instead of being silently dropped.
    expect(renderString("[{{ . }}]", null)).toBe("[<no value>]");
    expect(renderString("[{{ . }}]", undefined)).toBe("[<no value>]");
  });
});

describe("evaluator — field access", () => {
  it("walks .a.b.c on plain objects", () => {
    expect(renderString("{{ .a.b.c }}", { a: { b: { c: "deep" } } })).toBe("deep");
  });

  it("reads from a Map via .get", () => {
    const m = new Map<string, unknown>([["x", "from-map"]]);
    expect(renderString("{{ .x }}", m)).toBe("from-map");
  });

  it("reaches into nested objects + Maps", () => {
    const data = { wrap: new Map([["k", { v: "nested" }]]) };
    expect(renderString("{{ .wrap.k.v }}", data)).toBe("nested");
  });

  it("errors clearly on missing field", () => {
    let err: unknown;
    try {
      renderString("{{ .missing }}", { x: 1 });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(EvalError);
    if (err instanceof EvalError) {
      expect(err.message).toMatch(/field "missing" not found/);
    }
  });

  it("errors clearly on field access through nil", () => {
    let err: unknown;
    try {
      renderString("{{ .missing.deeper }}", { x: 1 });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(EvalError);
  });

  it("named-field access on an array is a missing-field error", () => {
    expect(() => renderString("{{ .length }}", [1, 2, 3])).toThrow(EvalError);
  });
});

describe("evaluator — $ and $vars", () => {
  it("$ refers to the original top-level scope", () => {
    expect(renderString("{{ $.x }}", { x: "root" })).toBe("root");
  });

  it("declared variables resolve via $name", () => {
    // {{ $x := .name }}{{ $x }}
    expect(renderString("{{ $x := .name }}{{ $x }}", { name: "ada" })).toBe("ada");
  });

  it("undefined $var fails clearly", () => {
    let err: unknown;
    try {
      renderString("{{ $absent }}", {});
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(EvalError);
    if (err instanceof EvalError) {
      expect(err.message).toMatch(/undefined variable \$absent/);
    }
  });

  it("supports $var.field chains", () => {
    expect(renderString("{{ $x := .obj }}{{ $x.k }}", { obj: { k: "val" } })).toBe("val");
  });
});

describe("evaluator — generic over T", () => {
  type Frag = { color: string; text: string };

  it("returns T[] without flattening to string", () => {
    const eng = createEngine<Frag>({
      fromString: (s) => ({ color: "default", text: s }),
    });
    const { root } = parse("hi {{ . }}!");
    const frags = eng.evaluate(root, "world");
    expect(frags).toEqual([
      { color: "default", text: "hi " },
      { color: "default", text: "world" },
      { color: "default", text: "!" },
    ]);
  });

  it("treats T-shaped scope values as T (passes through emitFromValue)", () => {
    const eng = createEngine<Frag>({
      fromString: (s) => ({ color: "default", text: s }),
    });
    const tagged: Frag = { color: "red", text: "ALERT" };
    const { root } = parse("{{ . }}");
    const out = eng.evaluate(root, tagged);
    expect(out).toEqual([tagged]);
  });
});

describe("evaluator — function dispatch failures", () => {
  it("throws FuncNotFoundError for an unregistered function", () => {
    expect(() => renderString("{{ totallymadeup }}", null)).toThrow(/is not registered/);
  });
});
