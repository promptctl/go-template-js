import { describe, expect, it } from "vitest";
import { createEngine } from "../../evaluator/evaluator.js";
import { sprigLists } from "./index.js";

const render = (src: string, scope: unknown = null): string =>
  createEngine<string>({ fromString: (s) => s, funcs: sprigLists() })
    .parse(src)
    .evaluate(scope)
    .join("");

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

  it("'int' slot normalizes bigint scope values for slice/chunk", () => {
    expect(render("{{ slice .list .i .j }}", { list: [10, 20, 30, 40], i: 1n, j: 3n })).toBe(
      "[20 30]",
    );
    expect(render("{{ chunk .n .list }}", { list: [1, 2, 3, 4, 5], n: 2n })).toBe(
      "[[1 2] [3 4] [5]]",
    );
  });

  it("'int' slot truncates fractional scope values for slice/chunk", () => {
    expect(render("{{ slice .list .i .j }}", { list: [10, 20, 30, 40], i: 1.7, j: 3.4 })).toBe(
      "[20 30]",
    );
  });
});
