/**
 * SemVer parsing and comparison utilities.
 *
 * Mirrors Masterminds/semver v3 semantics used by Go sprig:
 * - Optional v prefix; missing minor/patch default to 0
 * - Standard semver 2.0.0 ordering: major.minor.patch then pre-release
 * - Release (no pre-release) > pre-release of same version
 *
 * [LAW:one-source-of-truth] One parser, one comparator. Constraint
 * evaluation imports from here rather than re-implementing comparison.
 */

// Matches: v?major[.minor[.patch]][-prerelease][+metadata]
// Groups: 1=major, 2=minor, 3=patch, 4=prerelease, 5=metadata
<<<<<<< HEAD
const VERSION_RE =
  /^v?(\d+)(?:\.(\d+)(?:\.(\d+))?)?(?:-([\w][\w.-]*))?(?:\+([\w][\w.-]*))?$/;
=======
// SemVer 2.0.0: prerelease/metadata use [0-9A-Za-z-] with . separators.
const VERSION_RE =
  /^v?(\d+)(?:\.(\d+)(?:\.(\d+))?)?(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
>>>>>>> d650ee9 (fix(review): address 8 remaining PR review findings)

// [LAW:types-are-the-program] SemVer mirrors the fields Go sprig exposes
// from Masterminds/semver v3's Version struct. Template access `.Major`
// etc. maps directly to these keys via the engine's field accessor.
export interface SemVer {
  readonly Major: number;
  readonly Minor: number;
  readonly Patch: number;
  readonly Prerelease: string;
  readonly Metadata: string;
  readonly Original: string;
}

export function parseSemVer(s: string): SemVer {
  const input = s.trim();
  const m = VERSION_RE.exec(input);
  if (!m) throw new Error(`invalid semver: ${JSON.stringify(s)}`);
  return {
    Major: parseInt(m[1]!, 10),
    Minor: m[2] !== undefined ? parseInt(m[2], 10) : 0,
    Patch: m[3] !== undefined ? parseInt(m[3], 10) : 0,
    Prerelease: m[4] ?? "",
    Metadata: m[5] ?? "",
    Original: input,
  };
}

/** Returns negative if a < b, 0 if equal, positive if a > b. */
export function compareSemVer(a: SemVer, b: SemVer): number {
  const d =
    a.Major - b.Major ||
    a.Minor - b.Minor ||
    a.Patch - b.Patch;
  if (d !== 0) return d;
  return comparePrerelease(a.Prerelease, b.Prerelease);
}

function comparePrerelease(a: string, b: string): number {
  if (a === b) return 0;
  if (a === "") return 1; // release > pre-release
  if (b === "") return -1; // pre-release < release

  const aParts = a.split(".");
  const bParts = b.split(".");
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const ap = aParts[i];
    const bp = bParts[i];
    if (ap === undefined) return -1; // fewer identifiers = smaller
    if (bp === undefined) return 1;
    const an = /^\d+$/.test(ap) ? parseInt(ap, 10) : null;
    const bn = /^\d+$/.test(bp) ? parseInt(bp, 10) : null;
    if (an !== null && bn !== null) {
      if (an !== bn) return an - bn;
    } else if (an !== null) {
      return -1; // numeric < alphanumeric per semver spec
    } else if (bn !== null) {
      return 1;
    } else {
      if (ap < bp) return -1;
      if (ap > bp) return 1;
    }
  }
  return 0;
}
