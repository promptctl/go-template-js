/**
 * Sprig semver functions — `semver`, `semverCompare`.
 *
 * [LAW:single-enforcer] One module owns the FuncMap registration.
 */

import type { FuncMap } from "../../evaluator/evaluator.js";
import { type SemVer, semver } from "./semver.js";
import { semverCompare } from "./semverCompare.js";

export { type SemVer, semver, semverCompare };

export function sprigSemver(): FuncMap {
  return {
    // [LAW:types-are-the-program] Returns a plain object whose keys mirror
    // Masterminds/semver v3's method names so Go template field access
    // (`.Major`, `.Prerelease`, etc.) works without an adapter.
    semver: { fn: (s) => semver(s as string), argTypes: ["string"] },
    semverCompare: {
      fn: (constraint, version) => semverCompare(constraint as string, version as string),
      argTypes: ["string", "string"],
      returnType: "bool",
    },
  };
}
