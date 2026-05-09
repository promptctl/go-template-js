import { describe, expect, it } from "vitest";
import { createEngine } from "../../evaluator/evaluator.js";
import { sprigRandom } from "./index.js";

// Seeded PRNG: always returns 0 → easiest to reason about exact output.
const always0 = () => 0;

const render = (src: string, scope: unknown = null, random = always0): string =>
  createEngine<string>({ fromString: (s) => s, funcs: sprigRandom(random) })
    .parse(src)
    .evaluate(scope)
    .join("");

describe("sprig random — integration", () => {
  it("randInt via pipeline", () => {
    // PRNG=0 → floor(0*(20-5))+5 = 5
    expect(render("{{ randInt 5 20 }}")).toBe("5");
  });

  it("randAlpha via pipeline", () => {
    // PRNG=0 → always 'a' (index 0 of ALPHA charset)
    expect(render("{{ randAlpha 4 }}")).toBe("aaaa");
  });

  it("randNumeric via pipeline", () => {
    // PRNG=0 → always '0' (index 0 of NUMERIC charset)
    expect(render("{{ randNumeric 3 }}")).toBe("000");
  });

  it("shuffle preserves characters", () => {
    const input = "hello";
    const result = render("{{ . | shuffle }}", input, Math.random);
    expect([...result].sort().join("")).toBe([...input].sort().join(""));
  });

  it("randAlphaNum length correct", () => {
    const result = render("{{ randAlphaNum 10 }}", null, Math.random);
    expect(result).toHaveLength(10);
    expect(result).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("randAscii length and charset correct", () => {
    const result = render("{{ randAscii 8 }}", null, Math.random);
    expect(result).toHaveLength(8);
    expect(result).toMatch(/^[\x20-\x7E]+$/);
  });
});
