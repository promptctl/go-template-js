import { describe, expect, it } from "vitest";
import { createEngine } from "../../evaluator/evaluator.js";
import { parse } from "../../parser/parser.js";
import { sprigStrings } from "./index.js";

const render = (src: string, scope: unknown = null): string => {
  const result = parse(src);
  return createEngine<string>({ fromString: (s) => s, funcs: sprigStrings() })
    .evaluate(result, scope)
    .join("");
};

describe("sprig strings — integration", () => {
  it("typical statusline-style pipeline: trim | upper", () => {
    expect(render('{{ "  hi  " | trim | upper }}')).toBe("HI");
  });

  it("indent + repeat", () => {
    expect(render('{{ "x" | repeat 3 }}')).toBe("xxx");
  });

  it("splitList | join round-trip", () => {
    expect(render('{{ "a/b/c" | splitList "/" | join "-" }}')).toBe("a-b-c");
  });

  it("trunc with negative N", () => {
    expect(render('{{ "hello" | trunc -3 }}')).toBe("llo");
  });

  it("initials of a name", () => {
    expect(render('{{ initials "Ada Lovelace" }}')).toBe("AL");
  });
});
