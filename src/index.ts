/**
 * Public entrypoint for go-template-js.
 *
 * [LAW:one-source-of-truth] This file is the *only* declaration of
 * the package's stability surface. Anything not re-exported here is
 * internal — subject to change without a major-version bump. The
 * README's "Versioning policy" section is the human-readable mirror
 * of what lives below.
 *
 * Exposed:
 * - Engine API: createEngine, Engine, Template, EngineConfig, FuncMap,
 *   TemplateFunc, ArgType.
 * - Error hierarchy: TemplateError → ParseError, EvalError; EvalError
 *   → FuncNotFoundError, TypeMismatchError, MissingFieldError; the
 *   ErrorKind discriminator string union.
 * - Sprig category factories: sprigDefaults, sprigStrings, sprigMath,
 *   sprigLists, sprigDicts, sprigRegex, sprigTypes, sprigConversions,
 *   sprigSemver, sprigFlow, sprigRandom, sprigHash, sprigDatetime.
 * - Error classes: FailError (thrown by sprig `fail`).
 *
 * Hidden (intentionally): the parser/lexer/walker/stringifier modules,
 * concrete AST node interfaces, position helpers, internal symbols.
 * Reach into `src/parser/...` directly if you need them — and accept
 * that those imports carry no compatibility promise.
 */

export {
  type ErrorKind,
  EvalError,
  FailError,
  FuncNotFoundError,
  MissingFieldError,
  ParseError,
  TemplateError,
  TypeMismatchError,
} from "./errors.js";
export {
  type ArgType,
  createEngine,
  Engine,
  type EngineConfig,
  type FuncMap,
  type MissingKeyOption,
  Template,
  type TemplateFunc,
} from "./evaluator/evaluator.js";
export { sprigConversions } from "./sprig/conversions/index.js";
export { sprigDatetime } from "./sprig/datetime/index.js";
export { sprigDefaults } from "./sprig/defaults/index.js";
export { sprigDicts } from "./sprig/dicts/index.js";
export { sprigFlow } from "./sprig/flow/index.js";
export { sprigHash } from "./sprig/hash/index.js";
export { sprigLists } from "./sprig/lists/index.js";
export { sprigMath } from "./sprig/math/index.js";
export { sprigRandom } from "./sprig/random/index.js";
export { sprigRegex } from "./sprig/regex/index.js";
export { sprigSemver } from "./sprig/semver/index.js";
export { sprigStrings } from "./sprig/strings/index.js";
export { sprigTypes } from "./sprig/types/index.js";
