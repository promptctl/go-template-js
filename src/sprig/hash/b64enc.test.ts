import { describe, expect, it } from "vitest";
import { b64enc } from "./b64enc.js";

describe("sprig.b64enc", () => {
  it("encodes ASCII strings", () => {
    expect(b64enc("hello")).toBe("aGVsbG8=");
    expect(b64enc("hello world")).toBe("aGVsbG8gd29ybGQ=");
    expect(b64enc("")).toBe("");
  });

  it("encodes UTF-8 strings as UTF-8 bytes", () => {
    // 'café' → UTF-8: 63 61 66 c3 a9 → base64 Y2Fmw6k=
    expect(b64enc("café")).toBe("Y2Fmw6k=");
  });

  it("uses standard base64 alphabet (+ and /)", () => {
    // produces + or / when bytes require them
    expect(b64enc(">>>")).toBe("Pj4+");
    expect(b64enc("???")).toBe("Pz8/");
  });

  it("produces padding characters as needed", () => {
    expect(b64enc("a")).toBe("YQ==");
    expect(b64enc("ab")).toBe("YWI=");
    expect(b64enc("abc")).toBe("YWJj");
  });
});
