import { describe, expect, it } from "vitest";
import { createEngine, parse } from "./index.js";

describe("public API smoke test", () => {
  it("parses + evaluates a simple template via the public surface", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const { root } = parse("Hello, {{ .name }}!");
    expect(engine.evaluate(root, { name: "world" }).join("")).toBe("Hello, world!");
  });

  it("returns T[] without flattening for non-string T", () => {
    type Frag = { kind: "text"; v: string };
    const engine = createEngine<Frag>({
      fromString: (s) => ({ kind: "text", v: s }),
    });
    const { root } = parse("hi {{ . }}");
    expect(engine.evaluate(root, "x")).toEqual([
      { kind: "text", v: "hi " },
      { kind: "text", v: "x" },
    ]);
  });
});
