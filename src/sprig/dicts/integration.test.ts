import { describe, expect, it } from "vitest";
import { createEngine } from "../../evaluator/evaluator.js";
import { parse } from "../../parser/parser.js";
import { sprigDicts } from "./index.js";

const render = (src: string, scope: unknown = null): string => {
  const result = parse(src);
  return createEngine<string>({ fromString: (s) => s, funcs: sprigDicts() })
    .evaluate(result, scope)
    .join("");
};

describe("sprig dicts — integration", () => {
  it("dict builds + get reads (direct-call form, matching sprig's get(d, key))", () => {
    // Note: sprig's `get(d, key)` doesn't compose with pipe form
    // because last-arg piping would put the dict in the key slot.
    // Use direct-call form instead: `get (dict ...) "a"`.
    expect(render('{{ get (dict "a" 1 "b" 2) "a" }}')).toBe("1");
  });
  it("hasKey predicate", () => {
    expect(render('{{ if hasKey . "a" }}YES{{ else }}NO{{ end }}', { a: 1 })).toBe("YES");
  });
});
