import { describe, expect, it } from "vitest";
import { createEngine } from "../../evaluator/evaluator.js";
import { parse } from "../../parser/parser.js";
import { sprigLists } from "./index.js";

const render = (src: string, scope: unknown = null): string => {
  const result = parse(src);
  return createEngine<string>({ fromString: (s) => s, funcs: sprigLists() })
    .evaluate(result, scope)
    .join("");
};

describe("sprig lists — integration", () => {
  it("range over a uniq'd list", () => {
    const out = render("{{ range . | uniq }}[{{ . }}]{{ end }}", [1, 2, 1, 3]);
    expect(out).toBe("[1][2][3]");
  });

  it("first / last via pipe", () => {
    expect(render("{{ . | first }}", [10, 20, 30])).toBe("10");
    expect(render("{{ . | last }}", [10, 20, 30])).toBe("30");
  });

  it("has via pipe", () => {
    expect(render("{{ if has 2 . }}YES{{ else }}NO{{ end }}", [1, 2, 3])).toBe("YES");
  });
});
