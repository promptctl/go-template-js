/**
 * Integration: composition of funcs from multiple sources.
 *
 * Mirrors the consumer pattern of mixing sprig categories with
 * project-specific funcs (rich-js + claude-powerline use case).
 */

import { describe, expect, it } from "vitest";
import {
  createEngine,
  sprigDefaults,
  sprigLists,
  sprigStrings,
  type TemplateFunc,
} from "../../src/index.js";

describe("funcmap composition", () => {
  it("merges multiple sprig categories with consumer funcs", () => {
    const projectFuncs: Record<string, TemplateFunc> = {
      shout: {
        fn: (s: unknown) => `${String(s).toUpperCase()}!`,
        argTypes: ["string"],
      },
    };
    const engine = createEngine<string>({
      fromString: (s) => s,
      funcs: {
        ...sprigDefaults(),
        ...sprigStrings(),
        ...sprigLists(),
        ...projectFuncs,
      },
    });
    const out = engine.parse('{{ .name | default "anon" | shout }}').evaluate({ name: "" });
    expect(out.join("")).toBe("ANON!");
  });

  it("consumer funcs override sprig on name collision (escape hatch)", () => {
    const overrides: Record<string, TemplateFunc> = {
      upper: { fn: () => "OVERRIDE", argTypes: ["value"] },
    };
    const engine = createEngine<string>({
      fromString: (s) => s,
      funcs: { ...sprigStrings(), ...overrides },
    });
    expect(engine.parse('{{ "hi" | upper }}').evaluate(null).join("")).toBe("OVERRIDE");
  });
});
