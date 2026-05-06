import { describe, expect, it } from "vitest";
import { createEngine } from "./index.js";

describe("public API smoke test", () => {
  it("parses + evaluates a simple template via the public surface", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    expect(engine.parse("Hello, {{ .name }}!").evaluate({ name: "world" }).join("")).toBe(
      "Hello, world!",
    );
  });

  it("returns T[] without flattening for non-string T", () => {
    type Frag = { kind: "text"; v: string };
    const engine = createEngine<Frag>({
      fromString: (s) => ({ kind: "text", v: s }),
    });
    expect(engine.parse("hi {{ . }}").evaluate("x")).toEqual([
      { kind: "text", v: "hi " },
      { kind: "text", v: "x" },
    ]);
  });
});
