import { describe, expect, it } from "vitest";
import { createEngine } from "../../evaluator/evaluator.js";
import { parse } from "../../parser/parser.js";
import { sprigMath } from "./index.js";

const render = (src: string, scope: unknown = null): string => {
  const result = parse(src);
  return createEngine<string>({ fromString: (s) => s, funcs: sprigMath() })
    .evaluate(result, scope)
    .join("");
};

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
});
