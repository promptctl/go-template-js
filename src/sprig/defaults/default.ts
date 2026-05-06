/**
 * `default defaultVal val` — returns `val` if non-empty (per `empty`),
 * else `defaultVal`.
 *
 * Argument order matches Go sprig: the *default* comes first, the
 * value comes second. Pipelines feed the trailing arg, so
 * `{{ .name | default "anonymous" }}` evaluates default("anonymous", .name).
 */

import { empty } from "./empty.js";

export function defaultFn(defaultVal: unknown, value: unknown): unknown {
  return empty(value) ? defaultVal : value;
}
