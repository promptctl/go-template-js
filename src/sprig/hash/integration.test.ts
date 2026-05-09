import { describe, expect, it } from "vitest";
import { createEngine } from "../../evaluator/evaluator.js";
import { sprigHash } from "./index.js";

const render = (src: string, scope: unknown = null): string =>
  createEngine<string>({ fromString: (s) => s, funcs: sprigHash() })
    .parse(src)
    .evaluate(scope)
    .join("");

describe("sprig hash — integration", () => {
  it("b64enc via pipeline", () => {
    expect(render('{{ "hello" | b64enc }}')).toBe("aGVsbG8=");
  });

  it("b64dec via pipeline", () => {
    expect(render('{{ "aGVsbG8=" | b64dec }}')).toBe("hello");
  });

  it("b64enc | b64dec round-trip", () => {
    expect(render('{{ "foo bar" | b64enc | b64dec }}')).toBe("foo bar");
  });

  it("b32enc via pipeline", () => {
    expect(render('{{ "foo" | b32enc }}')).toBe("MZXW6===");
  });

  it("b32dec via pipeline", () => {
    expect(render('{{ "MZXW6===" | b32dec }}')).toBe("foo");
  });

  it("sha256sum via pipeline", () => {
    expect(render('{{ "hello" | sha256sum }}')).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("sha1sum via pipeline", () => {
    expect(render('{{ "hello" | sha1sum }}')).toBe(
      "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d",
    );
  });

  it("sha512sum via pipeline", () => {
    expect(render('{{ "hello" | sha512sum }}')).toHaveLength(128);
  });

  it("adler32sum via pipeline", () => {
    expect(render('{{ "Wikipedia" | adler32sum }}')).toBe("300286872");
  });

  it("uuidv4 returns valid UUID", () => {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(render("{{ uuidv4 }}")).toMatch(UUID_RE);
  });
});
