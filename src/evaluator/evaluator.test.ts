import { describe, expect, it } from "vitest";
import { MissingFieldError } from "../errors.js";
import { EvalError } from "./errors.js";
import { createEngine, type Engine, type MissingKeyOption } from "./evaluator.js";

const stringEngine = (missingKey?: MissingKeyOption): Engine<string> =>
  createEngine<string>({ fromString: (s) => s, ...(missingKey ? { missingKey } : {}) });

const renderString = (src: string, scope: unknown, missingKey?: MissingKeyOption): string =>
  stringEngine(missingKey).parse(src).evaluate(scope).join("");

describe("evaluator — text and dot", () => {
  it("emits text literals through fromString", () => {
    const eng = createEngine<{ kind: "txt"; v: string }>({
      fromString: (s) => ({ kind: "txt", v: s }),
    });
    expect(eng.parse("hello").evaluate(null)).toEqual([{ kind: "txt", v: "hello" }]);
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

  it("errors clearly on missing field under missingKey: 'error'", () => {
    let err: unknown;
    try {
      renderString("{{ .missing }}", { x: 1 }, "error");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(EvalError);
    if (err instanceof EvalError) {
      expect(err.message).toMatch(/field "missing" not found/);
    }
  });

  it("errors clearly on field access through nil under missingKey: 'error'", () => {
    let err: unknown;
    try {
      renderString("{{ .missing.deeper }}", { x: 1 }, "error");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(EvalError);
  });

  it("named-field access on an array is a missing-field error under 'error' mode", () => {
    expect(() => renderString("{{ .length }}", [1, 2, 3], "error")).toThrow(EvalError);
  });
});

// [LAW:dataflow-not-control-flow] One gate, three productions. The
// policy enum is the data; the gate body is fixed. These tests pin
// the visible behavior for each value of the enum so the gate stays
// honest about what each policy means.
describe("evaluator — missingKey policy", () => {
  it("default ('default'): missing field emits <no value> (Go text/template parity)", () => {
    // Policy not set — default is "default".
    expect(renderString("[{{ .missing }}]", { x: 1 })).toBe("[<no value>]");
  });

  it("default ('default'): chained access through a missing link emits <no value>", () => {
    expect(renderString("[{{ .a.b.c }}]", { x: 1 })).toBe("[<no value>]");
  });

  it("default ('default'): missing key on a Map emits <no value>", () => {
    const m = new Map<string, unknown>([["k", "present"]]);
    expect(renderString("[{{ .absent }}]", m)).toBe("[<no value>]");
  });

  it("'zero' is API-equivalent to 'default' (JS lacks static value-type info)", () => {
    expect(renderString("[{{ .missing }}]", { x: 1 }, "zero")).toBe("[<no value>]");
    expect(renderString("[{{ .a.b.c }}]", { x: 1 }, "zero")).toBe("[<no value>]");
  });

  it("'error': missing field throws MissingFieldError carrying the failed path", () => {
    let err: unknown;
    try {
      renderString("{{ .a.b.c }}", { a: { x: 1 } }, "error");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(MissingFieldError);
    if (err instanceof MissingFieldError) {
      expect(err.path).toEqual(["a", "b", "c"]);
    }
  });

  it("'default': named-field access on an array silently emits <no value>", () => {
    // The current (and Go's default) behavior: `len(arr)` is the only
    // way to read an array's length; `.length` as a named field is
    // simply missing. Under "default" mode the access is silent.
    expect(renderString("[{{ .length }}]", [1, 2, 3])).toBe("[<no value>]");
  });

  it("'default' does not change pipe-fed value semantics", () => {
    // The `<no value>` emit for an explicit nil pipeline is unchanged
    // — it lives in `emitFromValue`, not in the missing-key gate.
    expect(renderString("[{{ . }}]", null)).toBe("[<no value>]");
  });

  it("rejects an invalid missingKey value at construct time (boundary check)", () => {
    // [LAW:types-are-the-program] TS forbids this at compile time; the
    // boundary check enforces the same theorem at runtime so JS callers
    // and `as`-cast TS callers fail loud instead of silently degrading.
    expect(() =>
      createEngine<string>({
        fromString: (s) => s,
        missingKey: "erro" as MissingKeyOption,
      }),
    ).toThrow(/missingKey: expected/);
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
    const frags = eng.parse("hi {{ . }}!").evaluate("world");
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
    const out = eng.parse("{{ . }}").evaluate(tagged);
    expect(out).toEqual([tagged]);
  });
});

describe("evaluator — function dispatch failures", () => {
  it("throws FuncNotFoundError for an unregistered function", () => {
    expect(() => renderString("{{ totallymadeup }}", null)).toThrow(/is not registered/);
  });
});
