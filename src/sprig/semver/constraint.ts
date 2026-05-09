/**
 * Masterminds/semver v3-compatible constraint parsing and evaluation.
 *
 * Supports operators: =, !=, >, >=, <, <=, ~ (tilde), ^ (caret), "" (=).
 * AND groups: comma- or whitespace-separated.
 * OR groups: || separated.
 *
 * [LAW:types-are-the-program] A constraint IS a predicate function —
 * parsing produces (v: SemVer) => boolean directly. No intermediate
 * structural representation is needed at the call site.
 */

import { compareSemVer, parseSemVer, type SemVer } from "./parse.js";

type Predicate = (v: SemVer) => boolean;

// Tokenizes individual constraint items: optional op + version string.
// Version portion allows partial versions (1, 1.2, 1.2.3) and alphanumeric
// pre-release/metadata suffixes. Commas are separators (skipped by \d match).
// Operators: =, !=, >, >=, <, <=, ~, ^ (longest-first for greedy matching).
const TOKEN_RE = /(!=|>=|<=|>|<|~|\^|=)?\s*(v?\d[^\s,]*)/g;

export function parseConstraintExpr(s: string): Predicate {
  const orGroups = s
    .split(/\|\|/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (orGroups.length === 0) throw new Error(`empty constraint: ${JSON.stringify(s)}`);
  const preds = orGroups.map(parseAndGroup);
  return (v) => preds.some((p) => p(v));
}

function parseAndGroup(s: string): Predicate {
  TOKEN_RE.lastIndex = 0;
  const preds: Predicate[] = [];
  let m: RegExpExecArray | null;
  let consumed = 0;
  while ((m = TOKEN_RE.exec(s)) !== null) {
    preds.push(buildSingle(m[1] ?? "", m[2]!));
    consumed = m.index + m[0].length;
  }
  if (preds.length === 0) throw new Error(`no constraint tokens in: ${JSON.stringify(s)}`);
  // Validate entire string was consumed (allowing trailing whitespace)
  const remaining = s.slice(consumed).trim();
  if (remaining.length > 0) throw new Error(`unexpected characters in constraint: ${JSON.stringify(remaining)}`);
  return (v) => preds.every((p) => p(v));
}

// Counts explicitly-given version components (1 = major only, 2 = major.minor, 3 = all).
// Needed for tilde/caret semantics where partial specs have different bounds.
function countComponents(vstr: string): number {
  const core = vstr.replace(/^v/, "").replace(/[-+].*$/, "");
  return Math.min(core.split(".").length, 3);
}

function makeSemVer(major: number, minor: number, patch: number, pre: string): SemVer {
  const vstr = pre ? `${major}.${minor}.${patch}-${pre}` : `${major}.${minor}.${patch}`;
  return { Major: major, Minor: minor, Patch: patch, Prerelease: pre, Metadata: "", Original: vstr };
}

// Masterminds/semver v3 pre-release exclusion rule: a version with a
// pre-release is excluded from a non-pre-release constraint unless the
// constraint has a pre-release at the exact same major.minor.patch.
function preReleaseCheck(v: SemVer, constraint: SemVer): boolean {
  if (v.Prerelease === "") return true;
  if (constraint.Prerelease !== "") {
    return (
      v.Major === constraint.Major &&
      v.Minor === constraint.Minor &&
      v.Patch === constraint.Patch
    );
  }
  return false;
}

function buildSingle(op: string, vstr: string): Predicate {
  const cv = parseSemVer(vstr);
  const components = countComponents(vstr);
  const minorDirty = components < 2;
  const patchDirty = components < 3;

  switch (op) {
    case "":
    case "=":
      return (v) => compareSemVer(v, cv) === 0;
    case "!=":
      return (v) => compareSemVer(v, cv) !== 0;
    case ">":
      return (v) => preReleaseCheck(v, cv) && compareSemVer(v, cv) > 0;
    case ">=":
      return (v) => preReleaseCheck(v, cv) && compareSemVer(v, cv) >= 0;
    case "<":
      return (v) => preReleaseCheck(v, cv) && compareSemVer(v, cv) < 0;
    case "<=":
      return (v) => preReleaseCheck(v, cv) && compareSemVer(v, cv) <= 0;
    case "~":
      return buildTilde(cv, minorDirty);
    case "^":
      return buildCaret(cv, minorDirty, patchDirty);
    default:
      throw new Error(`unknown constraint operator: ${JSON.stringify(op)}`);
  }
}

// Tilde: locks major (and minor if given). Allows patch-level changes.
// ~X.Y.Z or ~X.Y → >=X.Y.Z, <X.(Y+1).0
// ~X            → >=X.0.0, <(X+1).0.0
function buildTilde(cv: SemVer, minorDirty: boolean): Predicate {
  if (minorDirty) {
    const lower = makeSemVer(cv.Major, 0, 0, cv.Prerelease);
    const upper = makeSemVer(cv.Major + 1, 0, 0, "");
    return (v) => preReleaseCheck(v, lower) && compareSemVer(v, lower) >= 0 && compareSemVer(v, upper) < 0;
  }
  const upper = makeSemVer(cv.Major, cv.Minor + 1, 0, "");
  return (v) => preReleaseCheck(v, cv) && compareSemVer(v, cv) >= 0 && compareSemVer(v, upper) < 0;
}

// Caret: locks the left-most non-zero element.
// ^X.Y.Z or ^X.Y where X>0  → >=X.Y.Z, <(X+1).0.0
// ^0.Y.Z or ^0.Y where Y>0  → >=0.Y.Z, <0.(Y+1).0
// ^0.0.Z (patch explicit)    → >=0.0.Z, <0.0.(Z+1)
// ^0.0 (patch dirty)         → >=0.0.0, <0.1.0
// ^0 or ^X (minor dirty)     → >=X.0.0, <(X+1).0.0
function buildCaret(cv: SemVer, minorDirty: boolean, patchDirty: boolean): Predicate {
  let upper: SemVer;
  if (minorDirty) {
    upper = makeSemVer(cv.Major + 1, 0, 0, "");
  } else if (cv.Major > 0) {
    upper = makeSemVer(cv.Major + 1, 0, 0, "");
  } else if (cv.Minor > 0) {
    upper = makeSemVer(0, cv.Minor + 1, 0, "");
  } else if (patchDirty) {
    // ^0.0 (minor explicit 0, patch not given) → <0.1.0
    upper = makeSemVer(0, 1, 0, "");
  } else {
    // ^0.0.Z (patch explicit) → <0.0.(Z+1)
    upper = makeSemVer(0, 0, cv.Patch + 1, "");
  }
  return (v) => preReleaseCheck(v, cv) && compareSemVer(v, cv) >= 0 && compareSemVer(v, upper) < 0;
}
