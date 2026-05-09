import { describe, expect, it } from "vitest";
import { b64dec } from "./b64dec.js";
import { b64enc } from "./b64enc.js";

describe("sprig.b64dec", () => {
  it("decodes known base64 strings", () => {
    expect(b64dec("aGVsbG8=")).toBe("hello");
    expect(b64dec("aGVsbG8gd29ybGQ=")).toBe("hello world");
    expect(b64dec("")).toBe("");
  });

  it("round-trips through b64enc", () => {
    for (const s of ["hello", "café", "foo bar\nbaz", "🎉"]) {
      expect(b64dec(b64enc(s))).toBe(s);
    }
  });

  it("decodes UTF-8 encoded bytes correctly", () => {
    // 'café' was encoded as UTF-8 bytes → Y2Fmw6k=
    expect(b64dec("Y2Fmw6k=")).toBe("café");
  });
});
