import { describe, expect, it } from "vitest";
import {
  EvalError,
  FuncNotFoundError,
  MissingFieldError,
  ParseError,
  TemplateError,
  TypeMismatchError,
} from "./errors.js";
import { createEngine } from "./evaluator/evaluator.js";

describe("error hierarchy", () => {
  it("ParseError extends TemplateError", () => {
    const err = new ParseError("nope", { line: 1, column: 1, offset: 0 });
    expect(err).toBeInstanceOf(TemplateError);
    expect(err).toBeInstanceOf(ParseError);
    expect(err.kind).toBe("ParseError");
  });

  it("EvalError + subclasses extend TemplateError", () => {
    const e = new EvalError("nope", { line: 1, column: 1, offset: 0 });
    expect(e).toBeInstanceOf(TemplateError);
    expect(e.kind).toBe("EvalError");

    const f = new FuncNotFoundError("foo", { line: 1, column: 1, offset: 0 });
    expect(f).toBeInstanceOf(EvalError);
    expect(f).toBeInstanceOf(TemplateError);
    expect(f.kind).toBe("FuncNotFoundError");

    const t = new TypeMismatchError("foo", 1, "string", "object", {
      line: 1,
      column: 1,
      offset: 0,
    });
    expect(t).toBeInstanceOf(EvalError);
    expect(t.kind).toBe("TypeMismatchError");

    const m = new MissingFieldError(["a", "b"], { line: 1, column: 1, offset: 0 });
    expect(m).toBeInstanceOf(EvalError);
    expect(m.kind).toBe("MissingFieldError");
  });
});

describe("FuncNotFoundError suggestions", () => {
  it("offers nearest-matching registered names by edit distance", () => {
    const engine = createEngine<string>({
      fromString: (s) => s,
      funcs: {
        myFunc: { fn: () => "", argTypes: ["value"] },
        anotherOne: { fn: () => "", argTypes: ["value"] },
        unrelated: { fn: () => "", argTypes: ["value"] },
      },
    });
    let err: unknown;
    try {
      engine.parse("{{ myFnc }}").evaluate(null);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(FuncNotFoundError);
    if (err instanceof FuncNotFoundError) {
      expect(err.message).toMatch(/did you mean: myFunc/);
      expect(err.suggestions).toContain("myFunc");
    }
  });

  it("omits suggestions when no candidates are close", () => {
    const engine = createEngine<string>({ fromString: (s) => s, funcs: {} });
    let err: unknown;
    try {
      engine.parse("{{ totallymadeup }}").evaluate(null);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(FuncNotFoundError);
    if (err instanceof FuncNotFoundError) {
      // With only built-ins available, "totallymadeup" is unlike any
      // registered name → no suggestions inside the cutoff window.
      expect(err.message).not.toMatch(/did you mean/);
    }
  });
});

describe("MissingFieldError details", () => {
  it("exposes the failed path", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    let err: unknown;
    try {
      engine.parse("{{ .a.b.c }}").evaluate({ a: { x: 1 } });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(MissingFieldError);
    if (err instanceof MissingFieldError) {
      expect(err.path).toEqual(["a", "b", "c"]);
      expect(err.kind).toBe("MissingFieldError");
    }
  });
});
