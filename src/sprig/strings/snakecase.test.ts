import { describe, expect, it } from "vitest";
import { snakecase } from "./snakecase.js";

// Cases pulled directly from the xstrings.ToSnakeCase docstring,
// which Go sprig delegates to. These pin parity with the reference.
describe("sprig.snakecase", () => {
  it("inserts underscores at PascalCase word boundaries", () => {
    expect(snakecase("FirstName")).toBe("first_name");
  });

  it("releases the last upper of an UPPER-run into the next word (HTTPServer)", () => {
    expect(snakecase("HTTPServer")).toBe("http_server");
    expect(snakecase("NoHTTPS")).toBe("no_https");
  });

  it("converts whitespace and hyphens between letters into underscores", () => {
    expect(snakecase("GO_PATH")).toBe("go_path");
    expect(snakecase("GO PATH")).toBe("go_path");
    expect(snakecase("GO-PATH")).toBe("go_path");
  });

  it("inserts an underscore between letter and number when followed by a letter", () => {
    expect(snakecase("http2xx")).toBe("http_2xx");
    expect(snakecase("HTTP20xOK")).toBe("http_20x_ok");
  });

  it("treats trailing alphanumerics as part of the previous word", () => {
    // "Duration2m3s": the 2/3 are number runs that absorb the trailing
    // letter into the same chunk after the initial split.
    expect(snakecase("Duration2m3s")).toBe("duration_2m3s");
    // "Bld4Floor3rd": "Bld4" stays together (digit absorbed by prev
    // word); new word starts at "Floor"; "3rd" is its own word.
    expect(snakecase("Bld4Floor3rd")).toBe("bld4_floor_3rd");
  });

  it("returns empty for empty input", () => {
    expect(snakecase("")).toBe("");
  });
});
