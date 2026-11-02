/**
 * The conformance corpus as every harness reads it.
 *
 * [LAW:single-enforcer] Mirrors `conformance/gen/main.go`: the same
 * on-disk files configure both engines, so the conformance guarantee is
 * "same inputs → same outputs" with no harness-side divergence in how the
 * inputs are interpreted. Every harness reads a fixture and renders it
 * through here, whatever outcome file it asserts.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Delims, Engine } from "../../src/index.js";

const FIXTURES_DIR = fileURLToPath(new URL("../../conformance/fixtures", import.meta.url));

/**
 * Fixtures whose outcome is recorded in `outcomeFile`. A fixture declares
 * which outcome it is about by which file it carries, so the harnesses
 * partition the corpus rather than filtering each other's cases out by hand.
 */
export function listFixtures(outcomeFile: string): string[] {
  if (!existsSync(FIXTURES_DIR)) return [];
  return readdirSync(FIXTURES_DIR)
    .filter((name) => statSync(join(FIXTURES_DIR, name)).isDirectory())
    .filter((name) => existsSync(join(FIXTURES_DIR, name, outcomeFile)))
    .sort();
}

/** What a fixture sets on the engine; each harness spreads it into its own config. */
export interface FixtureEngineConfig {
  readonly delims?: Delims;
}

/** The inputs Go was given — everything about a fixture except its outcome. */
export interface FixtureInput {
  readonly template: string;
  readonly scope: unknown;
  readonly engine: FixtureEngineConfig;
  /** A define to render by name, as Go's `ExecuteTemplate`. */
  readonly execute: string | undefined;
}

export function readFixtureInput(name: string): FixtureInput {
  const dir = join(FIXTURES_DIR, name);
  const template = readFileSync(join(dir, "template.tmpl"), "utf8");
  const scopePath = join(dir, "scope.json");
  const scope: unknown = existsSync(scopePath) ? JSON.parse(readFileSync(scopePath, "utf8")) : null;
  const configPath = join(dir, "config.json");
  const cfg: Record<string, unknown> = existsSync(configPath)
    ? JSON.parse(readFileSync(configPath, "utf8"))
    : {};
  return { template, scope, ...readConfig(name, cfg) };
}

// main.go decodes config.json into fixtureConfig: a null field is unset,
// and a field of the wrong shape stops regen. Both readings hold here.
function readConfig(
  name: string,
  cfg: Record<string, unknown>,
): Pick<FixtureInput, "engine" | "execute"> {
  const bad = (field: string) =>
    new Error(`fixture ${name}: config.json ${field} is not what main.go accepts`);
  const { delims, execute } = cfg;
  if (delims != null && !isPair(delims)) throw bad("delims");
  if (execute != null && typeof execute !== "string") throw bad("execute");
  return {
    engine: delims != null ? { delims: { left: delims[0], right: delims[1] } } : {},
    execute: execute ?? undefined,
  };
}

const isPair = (v: unknown): v is [string, string] =>
  Array.isArray(v) && v.length === 2 && v.every((d) => typeof d === "string");

export function readOutcome(name: string, outcomeFile: string): string {
  return readFileSync(join(FIXTURES_DIR, name, outcomeFile), "utf8");
}

/**
 * The fixture's render, as main.go runs it: the whole template, or the
 * one define `execute` names. `makeEngine` builds the harness's engine
 * with the fixture's config spread in.
 */
export function renderFixture<T>(
  makeEngine: (config: FixtureEngineConfig) => Engine<T>,
  { template, scope, engine, execute }: FixtureInput,
): T[] {
  const parsed = makeEngine(engine).parse(template);
  return execute === undefined ? parsed.evaluate(scope) : parsed.evaluateDefine(execute, scope);
}
