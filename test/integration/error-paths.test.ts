/**
 * Integration: every error type triggered through the public API,
 * message format asserted.
 */

import { describe, expect, it } from "vitest";
import {
  createEngine,
  FuncNotFoundError,
  MissingFieldError,
  ParseError,
  TemplateError,
  type TemplateFunc,
  TypeMismatchError,
} from "../../src/index.js";

const eng = (funcs: Record<string, TemplateFunc> = {}) =>
  createEngine<string>({ fromString: (s) => s, funcs });

describe("error paths via the public API", () => {
  it("ParseError on bad syntax", () => {
    expect(() => eng().parse("{{ if .x }}")).toThrow(ParseError);
    expect(() => eng().parse("{{ }}")).toThrow(/empty action/);
  });

  it("ParseError carries source snippet on toString()", () => {
    let err: unknown;
    try {
      eng().parse("hello\n{{ broken");
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(TemplateError);
    if (err instanceof TemplateError) {
      const out = err.toString();
      expect(out).toMatch(/at line/);
      expect(out).toMatch(/\^/);
    }
  });

  it("FuncNotFoundError lists nearest matches", () => {
    let err: unknown;
    try {
      eng({ myFunc: { fn: () => "", argTypes: ["any"] } })
        .parse("{{ myFnc }}")
        .evaluate(null);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(FuncNotFoundError);
    if (err instanceof FuncNotFoundError) {
      expect(err.suggestions).toContain("myFunc");
    }
  });

  it("MissingFieldError exposes the failed path", () => {
    let err: unknown;
    try {
      eng()
        .parse("{{ .a.b.c }}")
        .evaluate({ a: { x: 1 } });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(MissingFieldError);
    if (err instanceof MissingFieldError) {
      expect(err.path).toEqual(["a", "b", "c"]);
    }
  });

  it("TypeMismatchError when a non-string T flows into a string param", () => {
    interface Frag {
      color: string;
      text: string;
    }
    const fragEngine = createEngine<Frag>({
      fromString: (s) => ({ color: "default", text: s }),
      funcs: {
        upper: {
          fn: (s: unknown) => String(s).toUpperCase(),
          argTypes: ["string"],
        },
      },
    });
    let err: unknown;
    try {
      fragEngine.parse("{{ . | upper }}").evaluate({ color: "red", text: "X" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(TypeMismatchError);
    if (err instanceof TypeMismatchError) {
      expect(err.funcName).toBe("upper");
      expect(err.argIndex).toBe(1);
      expect(err.message).toMatch(/expected string/);
    }
  });
});
