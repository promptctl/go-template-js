/**
 * Conformance harness — TS engine outcome vs. Go reference outcome, in
 * degenerate `T = string` mode.
 *
 * Go does one of two things with a template, so the corpus records one
 * of two outcomes and this file asserts both against the same engine:
 * rendered bytes (`expected.txt`, byte-for-byte) and refusals
 * (`expected-go-error.txt`, message-for-message). Each fixture is its
 * own vitest test for greppability — failures name the fixture directly.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  createEngine,
  type Delims,
  sprigConversions,
  sprigDatetime,
  sprigDefaults,
  sprigDicts,
  sprigFlow,
  sprigHash,
  sprigLists,
  sprigMath,
  sprigRegex,
  sprigSemver,
  sprigStrings,
  sprigTypes,
  TemplateError,
} from "../../src/index.js";

const FIXTURES_DIR = fileURLToPath(new URL("../../conformance/fixtures", import.meta.url));

/**
 * Fixtures whose Go outcome is recorded in `outcomeFile`. A fixture
 * declares which outcome it is about by which file it carries, so the
 * two harnesses below partition the corpus rather than filtering each
 * other's cases out by hand.
 */
function listFixtures(outcomeFile: string): string[] {
  if (!existsSync(FIXTURES_DIR)) return [];
  return readdirSync(FIXTURES_DIR)
    .filter((name) => statSync(join(FIXTURES_DIR, name)).isDirectory())
    .filter((name) => existsSync(join(FIXTURES_DIR, name, outcomeFile)))
    .sort();
}

interface FixtureInput {
  template: string;
  scope: unknown;
  delims: Delims | undefined;
}

// [LAW:single-enforcer] Mirrors `conformance/gen/main.go`'s fixtureConfig.
// The same on-disk JSON shape configures both engines, so the conformance
// guarantee is "same inputs → same outputs" with no harness-side
// divergence in how the inputs are interpreted.
interface FixtureConfig {
  delims?: [string, string];
}

/** The inputs Go was given — everything about a fixture except its outcome. */
function readFixtureInput(name: string): FixtureInput {
  const dir = join(FIXTURES_DIR, name);
  const template = readFileSync(join(dir, "template.tmpl"), "utf8");
  let scope: unknown = null;
  const scopePath = join(dir, "scope.json");
  if (existsSync(scopePath)) {
    scope = JSON.parse(readFileSync(scopePath, "utf8"));
  }
  let delims: Delims | undefined;
  const configPath = join(dir, "config.json");
  if (existsSync(configPath)) {
    const cfg = JSON.parse(readFileSync(configPath, "utf8")) as FixtureConfig;
    if (cfg.delims) {
      delims = { left: cfg.delims[0], right: cfg.delims[1] };
    }
  }
  return { template, scope, delims };
}

function readOutcome(name: string, outcomeFile: string): string {
  return readFileSync(join(FIXTURES_DIR, name, outcomeFile), "utf8");
}

const allSprig = () => ({
  ...sprigDefaults(),
  ...sprigStrings(),
  ...sprigMath(),
  ...sprigLists(),
  ...sprigDicts(),
  ...sprigRegex(),
  ...sprigTypes(),
  ...sprigConversions(),
  ...sprigSemver(),
  ...sprigFlow(),
  ...sprigHash(),
  ...sprigDatetime(),
});

// [LAW:one-source-of-truth] Both harnesses below face Go through the
// same engine. A refusal fixture proving the engine matches Go's message
// would prove nothing if it were rendered by a differently-configured
// engine than the one the rendering fixtures pin.
function makeEngine(delims: Delims | undefined) {
  return createEngine<string>({
    fromString: (s) => s,
    funcs: allSprig(),
    ...(delims ? { delims } : {}),
  });
}

const renderFixtures = listFixtures("expected.txt");
const refusalFixtures = listFixtures("expected-go-error.txt");

describe("conformance — string-mode (T = string)", () => {
  if (renderFixtures.length === 0) {
    it.skip("no fixtures present", () => {});
    return;
  }

  // [LAW:behavior-not-structure] No skip-list, no divergence file. A
  // fixture either parities (expected.txt byte-equality), parities on
  // Go's refusal (expected-go-error.txt), or asserts a JS-side parity
  // error (expected-error.json under the error-parity harness).
  // Anything in between is a fixture authoring problem, not a test
  // configuration problem.
  for (const name of renderFixtures) {
    it(name, () => {
      const { template, scope, delims } = readFixtureInput(name);
      const expected = readOutcome(name, "expected.txt");
      const output = makeEngine(delims).parse(template).evaluate(scope).join("");
      if (output !== expected) {
        // Show first divergence offset to aid debugging.
        let offset = 0;
        while (offset < output.length && offset < expected.length) {
          if (output[offset] !== expected[offset]) break;
          offset += 1;
        }
        console.error(
          `Fixture ${name} diverged at byte ${offset}:\n` +
            `  expected: ${JSON.stringify(expected)}\n` +
            `  actual:   ${JSON.stringify(output)}`,
        );
      }
      expect(output).toBe(expected);
    });
  }
});

/**
 * Refusal parity — the engine says what Go says when it turns a template
 * down.
 *
 * The expected text is generated by `pnpm conformance:regen` from the
 * reference implementation, never written here: a hand-transcribed Go
 * message is a second clock, and the whole point of this corpus is that
 * Go keeps the time. [LAW:one-source-of-truth]
 *
 * What is asserted is the message alone. Class membership is not fixture
 * data — that `every` wrong-count call raises `ArgCountError` and every
 * refused slot raises `TypeMismatchError` are universal properties over
 * the shipped registrations in `src/evaluator/arity-gate.test.ts`, and a
 * second enforcer here would only drift from that one. The
 * `TemplateError` check is this harness's own sanity guard: it separates
 * "the engine refused, in its own words" from "something raw escaped",
 * which would otherwise read as a plain message mismatch.
 */
describe("conformance — Go refusal parity (T = string)", () => {
  if (refusalFixtures.length === 0) {
    it.skip("no refusal fixtures present", () => {});
    return;
  }

  for (const name of refusalFixtures) {
    it(name, () => {
      const { template, scope, delims } = readFixtureInput(name);
      // The generator writes the message as a line; the newline is the
      // file's, not Go's.
      const expected = readOutcome(name, "expected-go-error.txt").replace(/\n$/, "");

      let caught: unknown;
      try {
        makeEngine(delims).parse(template).evaluate(scope);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(TemplateError);
      expect((caught as TemplateError).message).toBe(expected);
    });
  }
});
