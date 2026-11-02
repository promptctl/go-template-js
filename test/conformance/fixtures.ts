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

/** The inputs Go was given — everything about a fixture except its outcome. */
export interface FixtureInput {
  readonly template: string;
  readonly scope: unknown;
  readonly delims: Delims | undefined;
  /** A define to render by name, as Go's `ExecuteTemplate`. */
  readonly execute: string | undefined;
}

// Mirrors main.go's fixtureConfig.
interface FixtureConfig {
  delims?: [string, string];
  execute?: string;
}

export function readFixtureInput(name: string): FixtureInput {
  const dir = join(FIXTURES_DIR, name);
  const template = readFileSync(join(dir, "template.tmpl"), "utf8");
  const scopePath = join(dir, "scope.json");
  const scope: unknown = existsSync(scopePath) ? JSON.parse(readFileSync(scopePath, "utf8")) : null;
  const configPath = join(dir, "config.json");
  const cfg: FixtureConfig = existsSync(configPath)
    ? (JSON.parse(readFileSync(configPath, "utf8")) as FixtureConfig)
    : {};
  const delims = cfg.delims ? { left: cfg.delims[0], right: cfg.delims[1] } : undefined;
  return { template, scope, delims, execute: cfg.execute };
}

export function readOutcome(name: string, outcomeFile: string): string {
  return readFileSync(join(FIXTURES_DIR, name, outcomeFile), "utf8");
}

/**
 * The fixture's render, as main.go runs it: the whole template, or the
 * one define `execute` names. `makeEngine` builds the harness's engine
 * with the fixture's delimiters.
 */
export function renderFixture<T>(
  makeEngine: (delims: Delims | undefined) => Engine<T>,
  { template, scope, delims, execute }: FixtureInput,
): T[] {
  const parsed = makeEngine(delims).parse(template);
  return execute === undefined ? parsed.evaluate(scope) : parsed.evaluateDefine(execute, scope);
}
