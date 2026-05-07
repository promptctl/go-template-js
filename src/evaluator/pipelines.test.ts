import { describe, expect, it } from "vitest";
import { FuncNotFoundError, TypeMismatchError } from "./errors.js";
import { createEngine, type FuncMap } from "./evaluator.js";

const upper: FuncMap = {
  upper: {
    fn: (s: unknown) => (typeof s === "string" ? s.toUpperCase() : String(s)),
    argTypes: ["string"],
    returnType: "string",
  },
};

const concat: FuncMap = {
  concat: {
    fn: (a: unknown, b: unknown) => `${String(a)}${String(b)}`,
    argTypes: ["string", "string"],
    returnType: "string",
  },
};

const stringEngine = (funcs: FuncMap = {}) => createEngine<string>({ fromString: (s) => s, funcs });

const renderString = (src: string, scope: unknown, funcs: FuncMap = {}): string =>
  stringEngine(funcs).parse(src).evaluate(scope).join("");

describe("pipelines — multi-command", () => {
  it("threads the previous result as the LAST argument of the next command", () => {
    expect(renderString("{{ .x | upper }}", { x: "hello" }, upper)).toBe("HELLO");
  });

  it("chains three commands left-to-right", () => {
    const funcs: FuncMap = {
      ...upper,
      bang: {
        fn: (s: unknown) => `${String(s)}!`,
        argTypes: ["string"],
        returnType: "string",
      },
    };
    expect(renderString("{{ .x | upper | bang }}", { x: "hi" }, funcs)).toBe("HI!");
  });

  it("`a b | c` calls c(b_result, then_a_args_via_pipe)", () => {
    const funcs: FuncMap = {
      ...concat,
      shout: {
        fn: (s: unknown) => `${String(s).toUpperCase()}!`,
        argTypes: ["string"],
      },
    };
    // "concat .pre .body" produces "<pre><body>", piped to shout
    expect(
      renderString("{{ concat .pre .body | shout }}", { pre: "go-", body: "lang" }, funcs),
    ).toBe("GO-LANG!");
  });

  it("the piped value lands at LAST position, not first", () => {
    // Build a function that's order-sensitive: subtract a from b →
    // for `2 | sub 10` Go's last-arg piping computes sub(10, 2) = 8.
    const funcs: FuncMap = {
      sub: {
        fn: (a: unknown, b: unknown) => Number(a) - Number(b),
        argTypes: ["number", "number"],
      },
    };
    expect(renderString("{{ 2 | sub 10 }}", null, funcs)).toBe("8");
  });

  it("propagates explicit undefined through a pipeline", () => {
    // [LAW:dataflow-not-control-flow] A function returning undefined
    // followed by another command should pipe `undefined` as a real
    // value — not collapse to "no pipe" via sentinel collision.
    const funcs: FuncMap = {
      maybe: { fn: () => undefined, argTypes: [] },
      isnil: {
        fn: (v: unknown) => (v === undefined ? "nil" : "set"),
        argTypes: ["any"],
      },
    };
    expect(renderString("{{ maybe | isnil }}", null, funcs)).toBe("nil");
  });
});

describe("pipelines — function dispatch + missing func", () => {
  it("looks up identifiers in the funcs registry", () => {
    expect(renderString("{{ upper .x }}", { x: "yo" }, upper)).toBe("YO");
  });

  it("throws FuncNotFoundError naming the missing function and its position", () => {
    let err: unknown;
    try {
      renderString("hi {{ totallymadeup .x }}", { x: "y" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(FuncNotFoundError);
    if (err instanceof FuncNotFoundError) {
      expect(err.funcName).toBe("totallymadeup");
      expect(err.message).toMatch(/"totallymadeup".*not registered/);
      expect(err.pos.line).toBe(1);
    }
  });
});

describe("type guard — no silent flatten", () => {
  type Frag = { color: string; text: string };
  const fragEngine = (funcs: FuncMap) =>
    createEngine<Frag>({ fromString: (s) => ({ color: "default", text: s }), funcs });

  it("piping a T into a string-typed parameter raises TypeMismatchError", () => {
    const styled: Frag = { color: "red", text: "ALERT" };
    const funcs: FuncMap = { upper: upper.upper as never };
    let err: unknown;
    try {
      fragEngine(funcs).parse("{{ . | upper }}").evaluate(styled);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(TypeMismatchError);
    if (err instanceof TypeMismatchError) {
      expect(err.funcName).toBe("upper");
      expect(err.argIndex).toBe(1);
      expect(err.message).toMatch(/expected string/);
      expect(err.message).toMatch(/Pass it through `unstyled`/);
    }
  });

  it("piping a string into a string-typed parameter is fine", () => {
    expect(renderString("{{ .x | upper }}", { x: "a" }, upper)).toBe("A");
  });

  it("piping a T into a T-typed parameter is fine", () => {
    type Frag = { color: string; text: string };
    const styled: Frag = { color: "red", text: "ALERT" };
    const funcs: FuncMap = {
      stripColor: {
        fn: (f: unknown) => ({ ...(f as Frag), color: "default" }),
        argTypes: ["T"],
        returnType: "T",
      },
    };
    const out = createEngine<Frag>({
      fromString: (s) => ({ color: "default", text: s }),
      funcs,
    })
      .parse("{{ . | stripColor }}")
      .evaluate(styled);
    expect(out).toEqual([{ color: "default", text: "ALERT" }]);
  });

  it("piping a T into an `any` parameter is fine", () => {
    const funcs: FuncMap = {
      describe: {
        fn: (v: unknown) => `kind=${typeof v}`,
        argTypes: ["any"],
        returnType: "string",
      },
    };
    const eng = createEngine<string>({ fromString: (s) => s, funcs });
    expect(eng.parse("{{ . | describe }}").evaluate({ color: "red", text: "x" }).join("")).toMatch(
      /kind=object/,
    );
  });

  it("argTypes ['any'] is the explicit permissive escape — T flows through unchanged", () => {
    type Frag = { color: string; text: string };
    const funcs: FuncMap = {
      identity: { fn: (x: unknown) => x, argTypes: ["any"] },
    };
    const eng = createEngine<Frag>({
      fromString: (s) => ({ color: "default", text: s }),
      funcs,
    });
    const styled: Frag = { color: "red", text: "x" };
    expect(eng.parse("{{ . | identity }}").evaluate(styled)).toEqual([styled]);
  });

  it("number-typed slot rejects strings", () => {
    const funcs: FuncMap = {
      double: { fn: (n: unknown) => Number(n) * 2, argTypes: ["number"] },
    };
    expect(() => renderString('{{ "5" | double }}', null, funcs)).toThrow(TypeMismatchError);
  });
});
