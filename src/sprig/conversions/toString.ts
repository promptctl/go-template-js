import { formatV } from "../../evaluator/builtins.js";

/**
 * `toString v` — Go sprig's `strval`. Strings pass through; everything
 * else routes through Go's `%v` formatter (`fmt.Sprintf("%v", v)`).
 *
 * [LAW:one-source-of-truth] Shares `formatV` with printf's `%v` verb —
 * one place owns "what does Go's %v look like".
 */
export function toString(v: unknown): string {
  return typeof v === "string" ? v : formatV(v);
}
