import { describe, expect, it } from "vitest";
import { camelcase } from "./camelcase.js";

// Cases pulled from the xstrings.ToCamelCase docstring. Note that Go
// sprig's `camelcase` is **PascalCase** despite the name — this is
// the documented Go-sprig quirk we preserve byte-for-byte.
describe("sprig.camelcase", () => {
  it("uppercases the first letter (PascalCase, not camelCase)", () => {
    expect(camelcase("some_words")).toBe("SomeWords");
    expect(camelcase("some words")).toBe("SomeWords");
  });

  it("lowercases letters following the first letter of each word", () => {
    expect(camelcase("http_server")).toBe("HttpServer");
    expect(camelcase("no_https")).toBe("NoHttps");
  });

  it("preserves leading connectors verbatim", () => {
    expect(camelcase("_complex__case_")).toBe("_Complex_Case_");
  });

  it("collapses runs of two or more connectors to a single connector", () => {
    // Per xstrings: connector→connector pairs emit one connector and
    // start a new word at the next non-connector rune.
    expect(camelcase("foo__bar")).toBe("Foo_Bar");
  });

  it("returns empty for empty input", () => {
    expect(camelcase("")).toBe("");
  });
});
