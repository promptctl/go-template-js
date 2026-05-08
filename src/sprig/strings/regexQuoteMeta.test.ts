import { describe, expect, it } from "vitest";
import { regexQuoteMeta } from "./regexQuoteMeta.js";

describe("sprig.regexQuoteMeta", () => {
  it("escapes the Go regexp metacharacter set", () => {
    expect(regexQuoteMeta("a.b")).toBe("a\\.b");
    expect(regexQuoteMeta("a+b*c?")).toBe("a\\+b\\*c\\?");
    expect(regexQuoteMeta("(a|b)")).toBe("\\(a\\|b\\)");
    expect(regexQuoteMeta("[a-z]")).toBe("\\[a-z\\]");
    expect(regexQuoteMeta("{1,2}")).toBe("\\{1,2\\}");
    expect(regexQuoteMeta("^a$")).toBe("\\^a\\$");
    expect(regexQuoteMeta("a\\b")).toBe("a\\\\b");
  });

  it("leaves non-meta characters alone", () => {
    expect(regexQuoteMeta("hello world")).toBe("hello world");
    expect(regexQuoteMeta("")).toBe("");
  });

  it("escaped output matches its source literally when re-compiled", () => {
    const raw = "a.b+c";
    const re = new RegExp(`^${regexQuoteMeta(raw)}$`);
    expect(re.test(raw)).toBe(true);
    expect(re.test("aXb+c")).toBe(false);
  });
});
