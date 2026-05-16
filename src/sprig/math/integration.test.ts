import { describe, expect, it } from "vitest";
import { createEngine } from "../../evaluator/evaluator.js";
import { sprigMath } from "./index.js";

const render = (src: string, scope: unknown = null): string =>
  createEngine<string>({ fromString: (s) => s, funcs: sprigMath() })
    .parse(src)
    .evaluate(scope)
    .join("");

describe("sprig math — integration", () => {
  it("add via pipe", () => {
    expect(render("{{ 5 | add 1 2 }}")).toBe("8");
  });
  it("div integer truncation", () => {
    expect(render("{{ div 10 3 }}")).toBe("3");
  });
  it("max + min variadic", () => {
    expect(render("{{ max 1 2 3 }}")).toBe("3");
    expect(render("{{ min 4 5 6 }}")).toBe("4");
  });
  it("bigint scope value at 'int' slot is normalized by the gate", () => {
    expect(render("{{ add1 .n }}", { n: 7n })).toBe("8");
    expect(render("{{ max .a 2 3 }}", { a: 10n })).toBe("10");
  });
  it("bigint scope value at 'float' slot is normalized by the gate", () => {
    expect(render("{{ add1f .n }}", { n: 7n })).toBe("8");
    expect(render("{{ maxf 1 .n 3 }}", { n: 2n })).toBe("3");
  });
  it("'int' slot truncates fractional scope values at the gate (Go int64 semantics)", () => {
    expect(render("{{ add .a .b }}", { a: 1.9, b: 2.1 })).toBe("3");
    expect(render("{{ max .a .b .c }}", { a: 1.5, b: 2.5, c: 3.5 })).toBe("3");
    expect(render("{{ until .n }}", { n: 3.7 })).toBe("[0 1 2]");
  });
  it("'float' slot does not truncate fractional scope values", () => {
    expect(render("{{ addf .a .b }}", { a: 1.5, b: 2.5 })).toBe("4");
    expect(render("{{ mulf .a .b }}", { a: 1.5, b: 2 })).toBe("3");
  });
});
