import { formatV } from "../../evaluator/builtins.js";

/**
 * `toString v` — Go sprig's `strval`: Go's `%v` (`fmt.Sprintf("%v", v)`).
 *
 * [LAW:one-source-of-truth] `formatV` is the one `%v`, shared with printf's
 * `%v` verb and the engine's output stream. Sprig has no engine and so no
 * T: nothing is opaque here, and a class instance prints its own String
 * either way.
 */
export function toString(v: unknown): string {
  return formatV(v, () => false);
}
