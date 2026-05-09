import { describe, expect, it } from "vitest";
import { uuidv4 } from "./uuidv4.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("sprig.uuidv4", () => {
  it("returns a valid RFC 4122 v4 UUID", () => {
    expect(uuidv4()).toMatch(UUID_RE);
  });

  it("generates distinct values each call", () => {
    const results = new Set(Array.from({ length: 20 }, () => uuidv4()));
    expect(results.size).toBe(20);
  });
});
