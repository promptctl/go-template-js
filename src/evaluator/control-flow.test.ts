import { describe, expect, it } from "vitest";
import { parse } from "../parser/parser.js";
import { createEngine } from "./evaluator.js";

const render = (src: string, scope: unknown): string => {
  const result = parse(src);
  return createEngine<string>({ fromString: (s) => s })
    .evaluate(result, scope)
    .join("");
};

describe("control flow — if/else/end", () => {
  it("renders the then branch when the pipe is truthy", () => {
    expect(render("{{ if .ok }}YES{{ end }}", { ok: true })).toBe("YES");
  });

  it("emits nothing when truthy is false and no else", () => {
    expect(render("[{{ if .ok }}YES{{ end }}]", { ok: false })).toBe("[]");
  });

  it("renders the else branch when falsy", () => {
    expect(render("{{ if .ok }}YES{{ else }}NO{{ end }}", { ok: false })).toBe("NO");
  });

  it("else if chains pick the first truthy branch", () => {
    const tpl = "{{ if .a }}A{{ else if .b }}B{{ else if .c }}C{{ else }}D{{ end }}";
    expect(render(tpl, { a: false, b: false, c: true })).toBe("C");
    expect(render(tpl, { a: false, b: false, c: false })).toBe("D");
    expect(render(tpl, { a: true, b: true, c: true })).toBe("A");
  });

  it.each([
    ["", "EMPTY"],
    [0, "EMPTY"],
    [null, "EMPTY"],
    [undefined, "EMPTY"],
    [false, "EMPTY"],
    [[], "EMPTY"],
    [{}, "EMPTY"],
    ["x", "FULL"],
    [1, "FULL"],
    [true, "FULL"],
    [[1], "FULL"],
    [{ a: 1 }, "FULL"],
  ])("Go-template truthiness: %p → %s", (value, expected) => {
    expect(render("{{ if . }}FULL{{ else }}EMPTY{{ end }}", value)).toBe(expected);
  });
});

describe("control flow — with", () => {
  it("rebinds dot to the pipe's value when truthy", () => {
    expect(render("{{ with .opt }}{{ . }}{{ end }}", { opt: "hi" })).toBe("hi");
  });

  it("falls back to else when pipe is empty", () => {
    expect(render("{{ with .opt }}A{{ else }}B{{ end }}", { opt: null })).toBe("B");
  });

  it("inner dot does not leak past {{ end }}", () => {
    // Outer dot is the object; with rebinds dot to .opt for the body
    // and restores it after {{ end }}.
    expect(
      render("{{ .tag }}-{{ with .opt }}{{ . }}{{ end }}-{{ .tag }}", {
        tag: "OUTER",
        opt: "INNER",
      }),
    ).toBe("OUTER-INNER-OUTER");
  });
});

describe("control flow — range", () => {
  it("iterates an array; dot rebinds to each element", () => {
    expect(render("{{ range . }}[{{ . }}]{{ end }}", ["a", "b", "c"])).toBe("[a][b][c]");
  });

  it("emits nothing for an empty array (no else)", () => {
    expect(render("X{{ range . }}*{{ end }}Y", [])).toBe("XY");
  });

  it("runs the else branch when the iterable is empty", () => {
    expect(render("{{ range . }}*{{ else }}none{{ end }}", [])).toBe("none");
  });

  it("single-decl `range $x := items` binds the value", () => {
    expect(render("{{ range $v := . }}{{ $v }}{{ end }}", ["a", "b"])).toBe("ab");
  });

  it("two-decl `range $i, $v := items` binds index + value", () => {
    expect(render("{{ range $i, $v := . }}{{ $i }}={{ $v }};{{ end }}", ["x", "y"])).toBe(
      "0=x;1=y;",
    );
  });

  it("ranges over Map entries (key + value)", () => {
    const m = new Map<string, string>([
      ["a", "1"],
      ["b", "2"],
    ]);
    expect(render("{{ range $k, $v := . }}{{ $k }}={{ $v }};{{ end }}", m)).toBe("a=1;b=2;");
  });

  it("ranges over plain object entries", () => {
    expect(render("{{ range $k, $v := . }}{{ $k }}={{ $v }};{{ end }}", { a: "1", b: "2" })).toBe(
      "a=1;b=2;",
    );
  });

  it("ranges over a string by character", () => {
    expect(render("{{ range . }}[{{ . }}]{{ end }}", "abc")).toBe("[a][b][c]");
  });

  it("scope of a $var declared inside range does not leak across iterations", () => {
    // In each iteration, $x is freshly declared from the iteration's
    // value. After the range ends, $x is no longer reachable. To
    // prove no leak across iters, assert the per-iteration value.
    expect(render("{{ range . }}{{ $x := . }}{{ $x }}{{ end }}", ["a", "b"])).toBe("ab");
  });
});

describe("control flow — sub-templates (template / block / define)", () => {
  it("invokes a defined template by name", () => {
    expect(render('{{define "hi"}}HELLO{{end}}{{ template "hi" . }}', null)).toBe("HELLO");
  });

  it("template invocation rebinds dot to the optional pipe arg", () => {
    expect(render('{{define "g"}}<{{ . }}>{{end}}{{ template "g" .name }}', { name: "ada" })).toBe(
      "<ada>",
    );
  });

  it("template without a pipe inherits the caller's dot", () => {
    expect(render('{{define "g"}}<{{ . }}>{{end}}{{ template "g" }}', "outer")).toBe("<outer>");
  });

  it("block defines AND invokes inline; can be overridden via define", () => {
    // A block with no overriding define should run its own body.
    expect(render('{{block "h" .}}DEFAULT{{end}}', null)).toBe("DEFAULT");
    // When a `define "h"` precedes the block, the override wins.
    expect(render('{{define "h"}}OVERRIDE{{end}}{{block "h" .}}DEFAULT{{end}}', null)).toBe(
      "OVERRIDE",
    );
  });

  it("undefined template name surfaces as a clear EvalError", () => {
    expect(() => render('{{ template "missing" . }}', null)).toThrow(
      /template "missing" is not defined/,
    );
  });
});
