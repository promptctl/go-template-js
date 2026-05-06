/**
 * Integration: T = string mode (Go-template default behaviour).
 *
 * Imports go through the package public surface only — no deep imports.
 */

import { describe, expect, it } from "vitest";
import { createEngine, sprigDefaults, sprigStrings } from "../../src/index.js";

const stringEngine = () =>
  createEngine<string>({
    fromString: (s) => s,
    funcs: { ...sprigDefaults(), ...sprigStrings() },
  });

const render = (src: string, scope: unknown = null): string =>
  stringEngine().parse(src).evaluate(scope).join("");

describe("string-mode integration", () => {
  it("pure interpolation", () => {
    expect(render("{{ .x }}", { x: "hi" })).toBe("hi");
  });

  it("conditional with else", () => {
    expect(render("{{ if .ok }}A{{ else }}B{{ end }}", { ok: true })).toBe("A");
    expect(render("{{ if .ok }}A{{ else }}B{{ end }}", { ok: false })).toBe("B");
  });

  it("range with index/value", () => {
    expect(render("{{ range $i, $v := .xs }}{{ $i }}:{{ $v }};{{ end }}", { xs: ["a", "b"] })).toBe(
      "0:a;1:b;",
    );
  });

  it("nested control flow", () => {
    const tpl = "{{ if .show }}{{ range .xs }}[{{ . }}]{{ end }}{{ end }}";
    expect(render(tpl, { show: true, xs: [1, 2] })).toBe("[1][2]");
    expect(render(tpl, { show: false, xs: [1, 2] })).toBe("");
  });

  it("pipeline with multiple funcs", () => {
    expect(render('{{ "  hi  " | trim | upper }}')).toBe("HI");
  });

  it("sub-template invocation", () => {
    const out = render('{{define "g"}}<{{ . }}>{{end}}{{ template "g" .name }}', { name: "ada" });
    expect(out).toBe("<ada>");
  });
});
