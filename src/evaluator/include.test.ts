import { describe, expect, it } from "vitest";
import {
  createEngine,
  EvalError,
  FuncNotFoundError,
  include,
  marked,
  sprigStrings,
  TypeMismatchError,
} from "../index.js";

const stringEngine = (funcs = {}) =>
  createEngine<string>({ fromString: (s) => s, funcs: { ...sprigStrings(), include, ...funcs } });

function thrown(f: () => unknown): unknown {
  try {
    f();
  } catch (e) {
    return e;
  }
  throw new Error("expected a throw");
}

describe("include", () => {
  it("is opt-in: an engine that did not register it has no such func", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const e = thrown(() =>
      engine.parse('{{ define "x" }}x{{ end }}{{ include "x" . }}').evaluate({}),
    );
    expect(e).toBeInstanceOf(FuncNotFoundError);
  });

  it("works under any registered name, because the evaluator knows the func, not the name", () => {
    const engine = createEngine<string>({ fromString: (s) => s, funcs: { partial: include } });
    const out = engine.parse('{{ define "x" }}<{{ . }}>{{ end }}{{ partial "x" 1 }}').evaluate({});
    expect(out.join("")).toBe("<1>");
  });

  it("returns one string, so the action emits once", () => {
    const out = stringEngine()
      .parse('{{ define "x" }}a{{ . }}b{{ end }}{{ include "x" 1 }}')
      .evaluate({});
    expect(out).toEqual(["a1b"]);
  });

  it("renders a define inherited from another parse", () => {
    const engine = stringEngine();
    const helpers = engine.parse('{{ define "shout" }}{{ upper . }}!{{ end }}').defines();
    const out = engine
      .parse('{{ include "shout" .name | lower }}', helpers)
      .evaluate({ name: "hi" });
    expect(out.join("")).toBe("hi!");
  });

  it("does not let the body see the caller's variables", () => {
    const e = thrown(() =>
      stringEngine()
        .parse('{{ define "x" }}{{ $v }}{{ end }}{{ $v := 1 }}{{ include "x" . }}')
        .evaluate({}),
    );
    expect(e).toBeInstanceOf(Error);
  });

  it("fails on an undefined name with an error at the call that names it", () => {
    const src = 'ok {{ include "nope" . }}';
    const e = thrown(() => stringEngine().parse(src).evaluate({}));
    expect(e).toBeInstanceOf(EvalError);
    expect((e as EvalError).message).toContain('template "nope" is not defined');
    expect((e as EvalError).pos.offset).toBe(src.indexOf("include"));
  });

  it("reports an error inside an inherited body against the source that declared it", () => {
    const engine = stringEngine();
    const preamble = '{{ define "boom" }}{{ nosuchfn . }}{{ end }}';
    const helpers = engine.parse(preamble).defines();
    const e = thrown(() => engine.parse('{{ include "boom" . }}', helpers).evaluate({}));
    expect(e).toBeInstanceOf(FuncNotFoundError);
    expect((e as FuncNotFoundError).source).toBe(preamble);
  });

  describe("provenance", () => {
    const PULSE = Symbol("pulse");
    const pulse = { fn: () => marked("p", PULSE), argTypes: [], arity: { kind: "exact" } as const };

    function emissions(src: string): ReadonlySet<unknown>[] {
      const seen: ReadonlySet<unknown>[] = [];
      createEngine<string>({
        fromString: (s) => s,
        funcs: { include, pulse },
        emitted: (value, marks) => {
          seen.push(marks);
          return value;
        },
      })
        .parse(src)
        .evaluate({});
      return seen;
    }

    it("a mark read inside the body reaches the include's emission", () => {
      const seen = emissions('{{ define "x" }}a{{ pulse }}{{ end }}{{ include "x" . }}');
      // The body's fragments are captured, not emitted: only the include's
      // own action reaches `emitted`.
      expect(seen).toHaveLength(1);
      expect(seen[0]?.has(PULSE)).toBe(true);
    });

    it("a mark on the data argument reaches the include's emission", () => {
      const seen = emissions('{{ define "x" }}{{ . }}{{ end }}{{ include "x" pulse }}');
      expect(seen[0]?.has(PULSE)).toBe(true);
    });

    it("an include that reads nothing marked carries no mark", () => {
      const seen = emissions('{{ define "x" }}plain{{ end }}{{ include "x" . }}');
      expect(seen[0]?.size).toBe(0);
    });
  });

  describe("with a non-string T", () => {
    interface Frag {
      readonly text: string;
    }
    const isFrag = (v: unknown): v is Frag => typeof v === "object" && v !== null && "text" in v;
    const src = '{{ define "x" }}a{{ . }}{{ end }}{{ include "x" 1 }}';

    it("flattens the body's fragments with the engine's toString", () => {
      const engine = createEngine<Frag>({
        fromString: (text) => ({ text }),
        toString: (f) => f.text,
        isT: isFrag,
        funcs: { include },
      });
      expect(engine.parse(src).evaluate({})).toEqual([{ text: "a1" }]);
    });

    it("fails loudly when the engine has no toString to flatten them", () => {
      const engine = createEngine<Frag>({
        fromString: (text) => ({ text }),
        isT: isFrag,
        funcs: { include },
      });
      expect(thrown(() => engine.parse(src).evaluate({}))).toBeInstanceOf(TypeMismatchError);
    });
  });
});
