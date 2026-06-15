/**
 * Integration smoke test for the public API.
 * Imports go through ./index.js — no internal deep imports allowed.
 */

import { describe, expect, it } from "vitest";
import { createEngine, sprigDefaults, sprigStrings, type TemplateFunc } from "./index.js";

describe("public API — Engine.parse + Template.evaluate", () => {
  it("parses once and evaluates with multiple scopes", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const template = engine.parse("Hello, {{ .name }}!");
    expect(template.evaluate({ name: "world" }).join("")).toBe("Hello, world!");
    expect(template.evaluate({ name: "ada" }).join("")).toBe("Hello, ada!");
  });

  it("preserves the source on the Template handle", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const src = "x={{ .x }}";
    expect(engine.parse(src).source).toBe(src);
  });
});

describe("public API — Template.referencedFunctions", () => {
  it("reports a command-head function and excludes one never referenced", () => {
    const engine = createEngine<string>({
      fromString: (s) => s,
      funcs: { ...sprigStrings() },
    });
    const refs = engine.parse("{{ upper .name }}").referencedFunctions();
    expect(refs.has("upper")).toBe(true);
    expect(refs.has("lower")).toBe(false);
  });

  it("sees functions through pipelines and nested calls, not just heads", () => {
    const engine = createEngine<string>({
      fromString: (s) => s,
      funcs: { ...sprigStrings() },
    });
    const refs = engine
      .parse('{{ .name | upper | trim }}{{ printf "%s" (lower .x) }}')
      .referencedFunctions();
    expect(refs.has("upper")).toBe(true);
    expect(refs.has("trim")).toBe(true);
    expect(refs.has("lower")).toBe(true);
    expect(refs.has("printf")).toBe(true);
  });

  it("does not mistake a field path or a string literal for a function", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    // `.menu` is a field; "menu" is a string literal — neither is a call.
    const refs = engine.parse('{{ .menu }}{{ print "menu" }}').referencedFunctions();
    expect(refs.has("menu")).toBe(false);
    expect(refs.has("print")).toBe(true);
  });

  it("collects functions referenced inside {{ define }} blocks", () => {
    const engine = createEngine<string>({
      fromString: (s) => s,
      funcs: { ...sprigStrings() },
    });
    const refs = engine
      .parse('{{ define "x" }}{{ upper .y }}{{ end }}{{ template "x" . }}')
      .referencedFunctions();
    expect(refs.has("upper")).toBe(true);
  });
});

describe("public API — Engine.compile", () => {
  it("returns a closure usable many times", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const greet = engine.compile("hi {{ .name }}");
    expect(greet({ name: "a" }).join("")).toBe("hi a");
    expect(greet({ name: "b" }).join("")).toBe("hi b");
  });
});

describe("public API — generic-T parameterization", () => {
  type Frag = { kind: string; v: string };
  it("returns T[] for arbitrary T", () => {
    const engine = createEngine<Frag>({
      fromString: (s) => ({ kind: "text", v: s }),
    });
    expect(engine.parse("{{ . }}").evaluate("x")).toEqual([{ kind: "text", v: "x" }]);
  });
});

describe("public API — funcs registry composition", () => {
  it("merges sprig categories with user-defined funcs", () => {
    const myFuncs: Record<string, TemplateFunc> = {
      bang: { fn: (s: unknown) => `${String(s)}!`, argTypes: ["string"] },
    };
    const engine = createEngine<string>({
      fromString: (s) => s,
      funcs: { ...sprigDefaults(), ...sprigStrings(), ...myFuncs },
    });
    const result = engine.parse("{{ .name | upper | bang }}").evaluate({ name: "go" });
    expect(result.join("")).toBe("GO!");
  });
});

describe("public API — Engine instances are stateless", () => {
  it("two parses against the same engine don't share state", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const a = engine.parse("{{ .x }}");
    const b = engine.parse("{{ .y }}");
    expect(a.evaluate({ x: "X", y: "Y" }).join("")).toBe("X");
    expect(b.evaluate({ x: "X", y: "Y" }).join("")).toBe("Y");
  });
});
