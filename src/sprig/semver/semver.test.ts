import { describe, expect, it } from "vitest";
import { compareSemVer } from "./parse.js";
import { semver } from "./semver.js";

describe("sprig.semver — parsing", () => {
  it("parses standard version", () => {
    const v = semver("1.2.3");
    expect(v.Major).toBe(1);
    expect(v.Minor).toBe(2);
    expect(v.Patch).toBe(3);
    expect(v.Prerelease).toBe("");
    expect(v.Metadata).toBe("");
    expect(v.Original).toBe("1.2.3");
  });

  it("preserves v prefix in Original", () => {
    const v = semver("v1.2.3");
    expect(v.Major).toBe(1);
    expect(v.Original).toBe("v1.2.3");
  });

  it("parses pre-release", () => {
    const v = semver("1.2.3-alpha.1");
    expect(v.Prerelease).toBe("alpha.1");
  });

  it("parses build metadata", () => {
    const v = semver("1.2.3+build.42");
    expect(v.Metadata).toBe("build.42");
  });

  it("fills missing minor and patch with 0", () => {
    expect(semver("1").Minor).toBe(0);
    expect(semver("1").Patch).toBe(0);
    expect(semver("1.2").Patch).toBe(0);
  });

  it("throws on invalid semver", () => {
    expect(() => semver("not-a-version")).toThrow(/invalid semver/);
    expect(() => semver("")).toThrow(/invalid semver/);
  });
});

describe("sprig.semver — comparison ordering", () => {
  it("pre-release compares less than release at same version", () => {
    const pre = semver("1.0.0-alpha");
    const rel = semver("1.0.0");
    expect(compareSemVer(pre, rel)).toBeLessThan(0);
    expect(compareSemVer(rel, pre)).toBeGreaterThan(0);
  });

  it("numeric pre-release identifier < alphanumeric", () => {
    expect(compareSemVer(semver("1.0.0-1"), semver("1.0.0-alpha"))).toBeLessThan(0);
  });

  it("numeric pre-release identifiers compared as integers", () => {
    expect(compareSemVer(semver("1.0.0-1"), semver("1.0.0-11"))).toBeLessThan(0);
  });

  it("pre-release identifiers: fewer identifiers = smaller", () => {
    expect(compareSemVer(semver("1.0.0-alpha"), semver("1.0.0-alpha.1"))).toBeLessThan(0);
  });

  it("major.minor.patch ordering", () => {
    expect(compareSemVer(semver("1.0.0"), semver("2.0.0"))).toBeLessThan(0);
    expect(compareSemVer(semver("1.2.0"), semver("1.3.0"))).toBeLessThan(0);
    expect(compareSemVer(semver("1.2.3"), semver("1.2.4"))).toBeLessThan(0);
  });

  it("equal versions compare as 0", () => {
    expect(compareSemVer(semver("1.2.3"), semver("1.2.3"))).toBe(0);
    expect(compareSemVer(semver("1.0.0-alpha"), semver("1.0.0-alpha"))).toBe(0);
  });
});
