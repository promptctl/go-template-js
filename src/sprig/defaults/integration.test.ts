/**
 * End-to-end integration test: sprig defaults registered as a FuncMap
 * extension on the engine, used through real templates.
 */

import { describe, expect, it } from "vitest";
import { createEngine } from "../../evaluator/evaluator.js";
import { parse } from "../../parser/parser.js";
import { sprigDefaults } from "./index.js";

const render = (src: string, scope: unknown): string => {
  const result = parse(src);
  return createEngine<string>({ fromString: (s) => s, funcs: sprigDefaults() })
    .evaluate(result, scope)
    .join("");
};

describe("sprig defaults — integration through the engine", () => {
  it("default fills in for empty values via pipe", () => {
    expect(render('{{ .name | default "anon" }}', { name: "" })).toBe("anon");
    expect(render('{{ .name | default "anon" }}', { name: "ada" })).toBe("ada");
  });

  it("ternary chooses based on a piped condition", () => {
    expect(render('{{ .ok | ternary "Y" "N" }}', { ok: true })).toBe("Y");
    expect(render('{{ .ok | ternary "Y" "N" }}', { ok: 0 })).toBe("N");
  });

  it("coalesce picks the first non-empty across args", () => {
    expect(render('{{ coalesce "" .name "fallback" }}', { name: "" })).toBe("fallback");
    expect(render('{{ coalesce "" .name "fallback" }}', { name: "ada" })).toBe("ada");
  });

  it("toJson + fromJson round-trip", () => {
    expect(render("{{ . | toJson }}", { a: 1, b: "x" })).toBe('{"a":1,"b":"x"}');
    expect(render("{{ fromJson . }}", '{"a":1}')).toMatch(/object/);
  });

  it("toPrettyJson uses 2-space indent", () => {
    expect(render("{{ . | toPrettyJson }}", { a: 1 })).toBe('{\n  "a": 1\n}');
  });

  it("empty + if predicate", () => {
    expect(render("{{ if empty .x }}EMPTY{{ else }}FULL{{ end }}", { x: "" })).toBe("EMPTY");
    expect(render("{{ if empty .x }}EMPTY{{ else }}FULL{{ end }}", { x: "y" })).toBe("FULL");
  });
});
