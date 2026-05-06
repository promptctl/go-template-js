/**
 * Integration: generic-T mode with a typed fragment shape.
 *
 * Models the consumer pattern from rich-js / claude-powerline where
 * the engine emits structured fragments, not strings.
 */

import { describe, expect, it } from "vitest";
import { createEngine, type TemplateFunc } from "../../src/index.js";

interface Frag {
  readonly color: string;
  readonly text: string;
}

const fragEngine = (funcs: Record<string, TemplateFunc> = {}) =>
  createEngine<Frag>({ fromString: (s) => ({ color: "default", text: s }), funcs });

describe("typed-fragment integration", () => {
  it("emits T values from text literals", () => {
    expect(fragEngine().parse("hi").evaluate(null)).toEqual([{ color: "default", text: "hi" }]);
  });

  it("flows T-typed scope values through unchanged", () => {
    const styled: Frag = { color: "red", text: "ALERT" };
    expect(fragEngine().parse("{{ . }}").evaluate(styled)).toEqual([styled]);
  });

  it("T-returning func produces T directly", () => {
    const funcs: Record<string, TemplateFunc> = {
      red: {
        fn: (s: unknown) => ({ color: "red", text: String(s) }),
        argTypes: ["string"],
        returnType: "T",
      },
    };
    expect(fragEngine(funcs).parse('{{ red "hi" }}').evaluate(null)).toEqual([
      { color: "red", text: "hi" },
    ]);
  });

  it("range over arrays produces an interleaved T stream", () => {
    const out = fragEngine().parse("{{ range . }}({{ . }}){{ end }}").evaluate(["a", "b"]);
    expect(out.map((f) => f.text)).toEqual(["(", "a", ")", "(", "b", ")"]);
  });
});
