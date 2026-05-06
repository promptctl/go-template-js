/**
 * Integration: parse-once-eval-many. Verifies the central invariant
 * that a parsed Template is reusable across many evaluate() calls.
 */

import { describe, expect, it } from "vitest";
import { createEngine } from "../../src/index.js";

describe("parse-once-eval-many", () => {
  it("Template.evaluate is reusable across scopes", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const greet = engine.parse("hi {{ .name }}");
    expect(greet.evaluate({ name: "a" }).join("")).toBe("hi a");
    expect(greet.evaluate({ name: "b" }).join("")).toBe("hi b");
    expect(greet.evaluate({ name: "c" }).join("")).toBe("hi c");
  });

  it("Engine.compile produces a closure that re-uses one parse", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const greet = engine.compile("hi {{ .name }}");
    expect(greet({ name: "a" }).join("")).toBe("hi a");
    expect(greet({ name: "b" }).join("")).toBe("hi b");
  });

  it("Template.source preserves the original text", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    expect(engine.parse("anything {{ .x }}").source).toBe("anything {{ .x }}");
  });

  it("parses are independent — scope does not leak between Templates", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const a = engine.parse("{{ .x }}");
    const b = engine.parse("{{ .y }}");
    const scope = { x: "X", y: "Y" };
    expect(a.evaluate(scope).join("")).toBe("X");
    expect(b.evaluate(scope).join("")).toBe("Y");
  });
});
