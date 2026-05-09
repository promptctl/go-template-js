/**
 * `semverCompare constraint version` — returns true iff `version`
 * satisfies `constraint`.
 *
 * Constraint syntax follows Masterminds/semver v3 (Go sprig's semver
 * library): =, !=, >, >=, <, <=, ~ (tilde), ^ (caret), || for OR,
 * comma/space for AND.
 *
 * Note: Go sprig's argument order is (constraint, version) — the
 * constraint comes first.
 */

import { parseConstraintExpr } from "./constraint.js";
import { parseSemVer } from "./parse.js";

export function semverCompare(constraint: string, version: string): boolean {
  const predicate = parseConstraintExpr(constraint);
  const v = parseSemVer(version);
  return predicate(v);
}
