/**
 * Public entrypoint for go-template-js.
 *
 * Real engine arrives in subsequent tickets — this stub exists so the
 * build/test/lint/typecheck pipeline runs end-to-end on a clean checkout.
 */

export interface EngineOptions {
  readonly name?: string;
}

export interface Engine {
  readonly name: string;
}

export function createEngine(options: EngineOptions = {}): Engine {
  return { name: options.name ?? "go-template-js" };
}
