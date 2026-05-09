import { describe, expect, it } from "vitest";
import { semverCompare } from "./semverCompare.js";

describe("sprig.semverCompare — simple operators", () => {
  it(">= includes equal and greater", () => {
    expect(semverCompare(">=1.0.0", "1.0.0")).toBe(true);
    expect(semverCompare(">=1.0.0", "1.5.0")).toBe(true);
    expect(semverCompare(">=1.0.0", "0.9.9")).toBe(false);
  });

  it("<= includes equal and lesser", () => {
    expect(semverCompare("<=1.0.0", "1.0.0")).toBe(true);
    expect(semverCompare("<=1.0.0", "0.9.0")).toBe(true);
    expect(semverCompare("<=1.0.0", "1.0.1")).toBe(false);
  });

  it("> strictly greater", () => {
    expect(semverCompare(">1.0.0", "1.0.1")).toBe(true);
    expect(semverCompare(">1.0.0", "1.0.0")).toBe(false);
  });

  it("< strictly lesser", () => {
    expect(semverCompare("<1.0.0", "0.9.9")).toBe(true);
    expect(semverCompare("<1.0.0", "1.0.0")).toBe(false);
  });

  it("= exact equality", () => {
    expect(semverCompare("=1.2.3", "1.2.3")).toBe(true);
    expect(semverCompare("=1.2.3", "1.2.4")).toBe(false);
  });

  it("!= inequality", () => {
    expect(semverCompare("!=1.2.3", "1.2.4")).toBe(true);
    expect(semverCompare("!=1.2.3", "1.2.3")).toBe(false);
  });

  it("bare version string = equality", () => {
    expect(semverCompare("1.2.3", "1.2.3")).toBe(true);
    expect(semverCompare("1.2.3", "1.2.4")).toBe(false);
  });
});

describe("sprig.semverCompare — tilde (~)", () => {
  it("~X.Y.Z allows minor-locked patch range", () => {
    expect(semverCompare("~1.2.3", "1.2.3")).toBe(true);
    expect(semverCompare("~1.2.3", "1.2.9")).toBe(true);
    expect(semverCompare("~1.2.3", "1.3.0")).toBe(false);
    expect(semverCompare("~1.2.3", "1.2.2")).toBe(false);
  });

  it("~X.Y allows minor-locked range from 0", () => {
    expect(semverCompare("~1.2", "1.2.0")).toBe(true);
    expect(semverCompare("~1.2", "1.2.9")).toBe(true);
    expect(semverCompare("~1.2", "1.3.0")).toBe(false);
    expect(semverCompare("~1.2", "1.1.9")).toBe(false);
  });

  it("~X allows major-locked range", () => {
    expect(semverCompare("~1", "1.0.0")).toBe(true);
    expect(semverCompare("~1", "1.9.9")).toBe(true);
    expect(semverCompare("~1", "2.0.0")).toBe(false);
    expect(semverCompare("~1", "0.9.9")).toBe(false);
  });
});

describe("sprig.semverCompare — caret (^)", () => {
  it("^X.Y.Z where X>0: allows up to next major", () => {
    expect(semverCompare("^1.2.3", "1.2.3")).toBe(true);
    expect(semverCompare("^1.2.3", "1.9.9")).toBe(true);
    expect(semverCompare("^1.2.3", "1.2.2")).toBe(false);
    expect(semverCompare("^1.2.3", "2.0.0")).toBe(false);
  });

  it("^0.Y.Z where Y>0: locks minor", () => {
    expect(semverCompare("^0.2.3", "0.2.3")).toBe(true);
    expect(semverCompare("^0.2.3", "0.2.9")).toBe(true);
    expect(semverCompare("^0.2.3", "0.3.0")).toBe(false);
    expect(semverCompare("^0.2.3", "0.2.2")).toBe(false);
  });

  it("^0.0.Z: locks patch range (< next patch)", () => {
    expect(semverCompare("^0.0.3", "0.0.3")).toBe(true);
    expect(semverCompare("^0.0.3", "0.0.4")).toBe(false);
    expect(semverCompare("^0.0.3", "0.0.2")).toBe(false);
  });

  it("^0.0 (patch dirty): >=0.0.0, <0.1.0", () => {
    expect(semverCompare("^0.0", "0.0.5")).toBe(true);
    expect(semverCompare("^0.0", "0.1.0")).toBe(false);
  });

  it("^0 (minor dirty): >=0.0.0, <1.0.0", () => {
    expect(semverCompare("^0", "0.9.9")).toBe(true);
    expect(semverCompare("^0", "1.0.0")).toBe(false);
  });
});

describe("sprig.semverCompare — AND / OR groups", () => {
  it("space-separated = AND", () => {
    expect(semverCompare(">=1.0.0 <2.0.0", "1.5.0")).toBe(true);
    expect(semverCompare(">=1.0.0 <2.0.0", "2.0.0")).toBe(false);
    expect(semverCompare(">=1.0.0 <2.0.0", "0.9.9")).toBe(false);
  });

  it("comma-separated = AND", () => {
    expect(semverCompare(">=1.0.0,<2.0.0", "1.5.0")).toBe(true);
    expect(semverCompare(">=1.0.0,<2.0.0", "2.0.0")).toBe(false);
  });

  it("|| = OR", () => {
    expect(semverCompare(">=3.0.0 || <1.0.0", "3.5.0")).toBe(true);
    expect(semverCompare(">=3.0.0 || <1.0.0", "0.5.0")).toBe(true);
    expect(semverCompare(">=3.0.0 || <1.0.0", "2.0.0")).toBe(false);
  });
});

describe("sprig.semverCompare — pre-release exclusion", () => {
  it("pre-release excluded from non-pre-release constraint", () => {
    expect(semverCompare(">=1.0.0", "1.5.0-alpha")).toBe(false);
  });

  it("pre-release allowed when constraint has pre-release at same version", () => {
    expect(semverCompare(">=1.0.0-alpha", "1.0.0-beta")).toBe(true);
  });

  it("pre-release at different patch excluded from pre-release constraint", () => {
    expect(semverCompare(">=1.0.0-alpha", "1.0.1-rc.1")).toBe(false);
  });
});
