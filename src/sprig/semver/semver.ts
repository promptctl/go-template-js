/**
 * `semver s` — parse a semver string into a struct with Major, Minor,
 * Patch, Prerelease, Metadata, Original fields.
 *
 * Mirrors Go sprig's `semver` which wraps Masterminds/semver v3's
 * `NewVersion`. Template field access (`.Major`, `.Prerelease`, etc.)
 * maps to the same-named keys on the returned object.
 *
 * Throws on invalid input — matches Go's behaviour where `semver` returns
 * (Version, error) and sprig panics on error.
 */

import { parseSemVer, type SemVer } from "./parse.js";

export { type SemVer };

export function semver(s: string): SemVer {
  return parseSemVer(s);
}
