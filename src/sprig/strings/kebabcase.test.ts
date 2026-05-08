import { describe, expect, it } from "vitest";
import { kebabcase } from "./kebabcase.js";

// kebabcase shares the snakecase state machine with `-` as the
// connector; the same docstring cases pin parity here too.
describe("sprig.kebabcase", () => {
  it("inserts hyphens at PascalCase word boundaries", () => {
    expect(kebabcase("FirstName")).toBe("first-name");
  });

  it("matches snakecase semantics with a different connector", () => {
    expect(kebabcase("HTTPServer")).toBe("http-server");
    expect(kebabcase("NoHTTPS")).toBe("no-https");
    expect(kebabcase("GO_PATH")).toBe("go-path");
    expect(kebabcase("GO PATH")).toBe("go-path");
    expect(kebabcase("GO-PATH")).toBe("go-path");
    expect(kebabcase("http2xx")).toBe("http-2xx");
  });

  it("returns empty for empty input", () => {
    expect(kebabcase("")).toBe("");
  });
});
