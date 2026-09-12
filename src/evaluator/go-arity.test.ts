/**
 * Every `TemplateFunc.arity` is a map; the Go function it mirrors is the
 * territory. This test redraws the comparison on every run against
 * `go-arity.fixture.json`, which `conformance/gen/arity` extracts from
 * the real `sprig.GenericFuncMap()` and `text/template`'s `builtins()`.
 *
 * [LAW:one-source-of-truth] Go's signature is the only authority on how
 * many arguments a func takes. Before this test the survey was a claim
 * in a JSDoc comment, which is a map a human has to remember to redraw —
 * and it had already drifted: `slice`, `default`, `divf`, `subf`, `keys`
 * and `round` were declared `exact` against variadic Go signatures,
 * because the heuristic that produced them (`fn.length ===
 * argTypes.length`) cannot see a Go-variadic function whose JS body
 * takes fixed optional parameters.
 *
 * Regenerate the fixture with `pnpm arity:regen` after a Go or sprig
 * bump. A diff there is a real change in the territory: fix the
 * declarations, don't re-point the map.
 */

import { describe, expect, it } from "vitest";
import { sprigConversions } from "../sprig/conversions/index.js";
import { sprigDatetime } from "../sprig/datetime/index.js";
import { sprigDefaults } from "../sprig/defaults/index.js";
import { sprigDicts } from "../sprig/dicts/index.js";
import { sprigFlow } from "../sprig/flow/index.js";
import { sprigHash } from "../sprig/hash/index.js";
import { sprigLists } from "../sprig/lists/index.js";
import { sprigMath } from "../sprig/math/index.js";
import { sprigRandom } from "../sprig/random/index.js";
import { sprigRegex } from "../sprig/regex/index.js";
import { sprigSemver } from "../sprig/semver/index.js";
import { sprigStrings } from "../sprig/strings/index.js";
import { sprigTypes } from "../sprig/types/index.js";
import { defaultBuiltins } from "./builtins.js";
import type { FuncMap } from "./evaluator.js";
import goArity from "./go-arity.fixture.json" with { type: "json" };

const goSignatures: Record<string, { numIn: number; variadic: boolean } | undefined> =
  goArity.funcs;

/**
 * Every func map the engine ships: the builtins `createEngine` merges in
 * itself, plus the thirteen sprig category factories a consumer opts
 * into.
 *
 * Kept as separate maps rather than spread into one, because `len` and
 * `slice` are each registered twice — once as a Go builtin and once by
 * `sprigLists`, mirroring two different Go functions that happen to
 * share a name. Flattening would check only whichever spread last and
 * silently skip the other declaration, which is exactly the kind of
 * unchecked registration this file exists to rule out.
 */
const funcMaps: ReadonlyArray<readonly [string, FuncMap]> = [
  ["defaultBuiltins", defaultBuiltins(String, () => false)],
  ["sprigConversions", sprigConversions()],
  ["sprigDatetime", sprigDatetime()],
  ["sprigDefaults", sprigDefaults()],
  ["sprigDicts", sprigDicts()],
  ["sprigFlow", sprigFlow()],
  ["sprigHash", sprigHash()],
  ["sprigLists", sprigLists()],
  ["sprigMath", sprigMath()],
  ["sprigRandom", sprigRandom()],
  ["sprigRegex", sprigRegex()],
  ["sprigSemver", sprigSemver()],
  ["sprigStrings", sprigStrings()],
  ["sprigTypes", sprigTypes()],
];

/** Every registration, flattened to one row per declaration site. */
const registrations = funcMaps.flatMap(([map, funcs]) =>
  Object.entries(funcs).map(([name, fn]) => ({ map, name, fn, go: goSignatures[name] })),
);

/** Registrations Go declares a signature for — the checkable ones. */
const mirrored = registrations.flatMap((r) => (r.go ? [{ ...r, go: r.go }] : []));

/**
 * Names whose declaration cannot be checked against a Go signature, each
 * with the reason it can't. Anything absent from Go *and* absent here is
 * a failure — a new registration must justify its arity or inherit one.
 */
const unmirrored: Record<string, string> = {
  sha512sum:
    "JS extension beyond sprig 3.2.3, which ships sha1sum and sha256sum only. " +
    "Mirrors their `func(string) string` shape; adopt Go's signature if sprig adds one.",
};

/**
 * `dict` is the one registration whose `argTypes` is not a parameter
 * list. Go declares `dict(v ...interface{})` — a flat variadic that
 * says nothing about the key/value alternation, because Go checks that
 * in the body. The engine lifts the alternation into the gate, so its
 * two entries are a *cycle*, not two parameters, and the slot-count
 * clause below does not apply. The minimum clause still does.
 */
const cycleNotParameterList = new Set(["dict"]);

describe("arity declarations mirror their Go signatures", () => {
  it("checks every registration the engine ships", () => {
    expect(registrations).toHaveLength(168);
  });

  it("declares `exact` for exactly the non-variadic Go signatures", () => {
    const wrong = mirrored
      .filter(({ fn, go }) => (fn.arity.kind === "exact") === go.variadic)
      .map(
        ({ map, name, fn, go }) =>
          `${map}.${name}: declared ${fn.arity.kind}, Go variadic=${go.variadic}`,
      );

    expect(wrong).toEqual([]);
  });

  it("declares one slot per Go parameter, the repeating one last", () => {
    const wrong = mirrored
      .filter(({ name }) => !cycleNotParameterList.has(name))
      .filter(({ fn, go }) => fn.argTypes.length !== go.numIn)
      .map(
        ({ map, name, fn, go }) =>
          `${map}.${name}: ${fn.argTypes.length} slots (${fn.argTypes.join(", ")}), Go declares ${go.numIn}`,
      );

    expect(wrong).toEqual([]);
  });

  it("declares an alternating minimum matching Go's arity gate", () => {
    const wrong = mirrored
      .filter(({ fn, go }) => fn.arity.kind === "alternating" && fn.arity.minimum !== go.numIn - 1)
      .map(
        ({ map, name, fn, go }) =>
          `${map}.${name}: minimum ${fn.arity.kind === "alternating" ? fn.arity.minimum : "n/a"}, Go requires ${go.numIn - 1}`,
      );

    expect(wrong).toEqual([]);
  });

  it("accounts for every registration Go does not declare", () => {
    const unexplained = registrations
      .filter(({ go }) => !go)
      .filter(({ name }) => !unmirrored[name])
      .map(({ map, name }) => `${map}.${name}`);

    expect(unexplained).toEqual([]);
  });

  it("keeps the unmirrored list free of names Go has since declared", () => {
    expect(Object.keys(unmirrored).filter((name) => goSignatures[name])).toEqual([]);
  });
});
