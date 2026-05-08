/**
 * `camelcase s` — port of `xstrings.ToCamelCase`. Note: despite the
 * name, Go sprig's `camelcase` is **PascalCase** — the first letter
 * is uppercased, not lowercased. This is a documented Go-sprig
 * quirk and we preserve it byte-for-byte.
 *
 * Examples (matching the xstrings docstring):
 *   "some_words"      -> "SomeWords"
 *   "http_server"     -> "HttpServer"
 *   "_complex__case_" -> "_Complex_Case_"
 */

// [LAW:one-source-of-truth] The walk lives in caseUtils alongside
// the snake/kebab algorithm.
import { camelCase } from "./caseUtils.js";

export function camelcase(s: string): string {
  return camelCase(s);
}
