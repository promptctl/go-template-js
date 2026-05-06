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
  it("dict builds + get reads (direct-call form)", () => {
    expect(render('{{ get (dict "a" 1 "b" 2) "a" }}')).toBe("1");
  });

  it("get composes with pipe form when the key is piped: `key | get d`", () => {
    // Last-arg piping puts the pipe value in the trailing slot, which
    // is `key` for `get(d, key)`. Matches Go sprig's behavior.
    expect(render('{{ "a" | get (dict "a" 1 "b" 2) }}')).toBe("1");
  });

  it("set mutates the dict and returns it (Go sprig parity)", () => {
    // Two-step: set, then read back. The read sees the mutation.
    expect(render('{{- $d := dict "a" 1 -}}{{- $_ := set $d "b" 2 -}}{{ $d.a }},{{ $d.b }}')).toBe(
      "1,2",
    );
  });

  it("unset mutates the dict in place", () => {
    expect(
      render('{{- $d := dict "a" 1 "b" 2 -}}{{- $_ := unset $d "a" -}}{{ hasKey $d "a" }}'),
    ).toBe("false");
  });

  it("hasKey predicate", () => {
    expect(render('{{ if hasKey . "a" }}YES{{ else }}NO{{ end }}', { a: 1 })).toBe("YES");
  });
});
