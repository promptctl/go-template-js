/**
 * Conformance harness — generic-T mode.
 *
 * Iterates the same fixtures as the string-mode harness, but only
 * runs against fixtures that opt in by providing an
 * `expected-fragments.json` file. The test instantiates the engine
 * with `T = TaggedFragment` and asserts the output fragment list
 * matches the expected tree structurally.
 *
 * The harness registers a small set of test-only styling funcs so
 * fixtures don't need a real consumer (rich-js, etc.) to exercise
 * the typed path:
 *
 *   tagAs "name" "value"     → { tag: "name", text: "value" }
 *   tagAs "name" .x          → { tag: "name", text: <stringified .x> }
 */

import { describe, expect, it } from "vitest";
import { createEngine, type FuncMap } from "../../src/index.js";
import { listFixtures, readFixtureInput, readOutcome, renderFixture } from "./fixtures.js";

interface TaggedFragment {
  readonly tag: string;
  readonly text: string;
}

const stylingFuncs: FuncMap = {
  tagAs: {
    fn: (tag: unknown, value: unknown): TaggedFragment => ({
      tag: String(tag),
      text: String(value),
    }),
    argTypes: ["string", "value"],
    arity: { kind: "exact" },
    returnType: "T",
  },
};

const fixtures = listFixtures("expected-fragments.json");

describe("conformance — typed-fragment (T = TaggedFragment)", () => {
  if (fixtures.length === 0) {
    it.skip("no typed-fragment fixtures (expected-fragments.json) present", () => {});
    return;
  }

  for (const name of fixtures) {
    it(name, () => {
      const expected = JSON.parse(readOutcome(name, "expected-fragments.json")) as TaggedFragment[];
      const output = renderFixture(
        (delims) =>
          createEngine<TaggedFragment>({
            fromString: (s) => ({ tag: "text", text: s }),
            funcs: stylingFuncs,
            ...(delims ? { delims } : {}),
          }),
        readFixtureInput(name),
      );
      expect(output).toEqual(expected);
    });
  }
});
