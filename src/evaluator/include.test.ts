import { describe, expect, it } from "vitest";
import {
  createEngine,
  EvalError,
  FailError,
  FuncNotFoundError,
  include,
  marked,
  sprigFlow,
  sprigLists,
  sprigMath,
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
    expect((e as EvalError).message).toContain("undefined variable: $v");
  });

  it("matches a copy of the registration, not only the exported object", () => {
    const engine = createEngine<string>({ fromString: (s) => s, funcs: { inc: { ...include } } });
    const out = engine.parse('{{ define "x" }}<{{ . }}>{{ end }}{{ inc "x" 1 }}').evaluate({});
    expect(out.join("")).toBe("<1>");
  });

  it("stops a recursive define at a fixed depth with an error naming it", () => {
    const e = thrown(() =>
      stringEngine()
        .parse('{{ define "r" }}{{ include "r" . }}{{ end }}{{ include "r" . }}')
        .evaluate({}),
    );
    expect(e).toBeInstanceOf(EvalError);
    expect((e as EvalError).message).toContain('template "r": exceeded maximum nesting depth');
  });

  it("stops a recursive {{ template }} the same way", () => {
    const e = thrown(() =>
      stringEngine()
        .parse('{{ define "r" }}{{ template "r" . }}{{ end }}{{ template "r" . }}')
        .evaluate({}),
    );
    expect((e as EvalError).message).toContain('template "r": exceeded maximum nesting depth');
  });

  it("recurses as deep as the data does, below the limit", () => {
    const src =
      '{{ define "n" }}{{ if . }}{{ range $i := until 1 }}{{ with $ }}x{{ include "n" (sub . 1) }}{{ end }}{{ end }}{{ end }}{{ end }}{{ include "n" 99 | len }}';
    const engine = createEngine<string>({
      fromString: (s) => s,
      funcs: {
        ...sprigStrings(),
        ...sprigLists(),
        ...sprigMath(),
        include,
        len: {
          fn: (s: string) => String(s.length),
          argTypes: ["string"],
          arity: { kind: "exact" },
        },
      },
    });
    expect(engine.parse(src).evaluate({}).join("")).toBe("99");
  });

  it("fails on an undefined name with an error at the call that names it", () => {
    const src = 'ok {{ include "nope" . }}';
    const e = thrown(() => stringEngine().parse(src).evaluate({}));
    expect(e).toBeInstanceOf(EvalError);
    expect((e as EvalError).message).toContain('template "nope" is not defined');
    expect((e as EvalError).pos.offset).toBe(src.indexOf("include"));
  });

  it("reports a body error at the call, with the body's own error as the cause", () => {
    const engine = stringEngine();
    const preamble = '{{ define "boom" }}{{ nosuchfn . }}{{ end }}';
    const helpers = engine.parse(preamble).defines();
    const src = 'top {{ include "boom" . }}';
    const e = thrown(() => engine.parse(src, helpers).evaluate({})) as EvalError;
    expect(e.message).toBe('error calling include "boom": function "nosuchfn" is not registered');
    expect(e.pos.offset).toBe(src.indexOf("include"));
    expect(e.source).toBe(src);
    expect(e.cause).toBeInstanceOf(FuncNotFoundError);
    expect((e.cause as FuncNotFoundError).source).toBe(preamble);
  });

  it("keeps the location of a fail inside an inherited body", () => {
    const engine = stringEngine({ ...sprigFlow() });
    const preamble = '{{ define "f" }}xx{{ fail "boom" }}{{ end }}';
    const helpers = engine.parse(preamble).defines();
    const e = thrown(() =>
      engine.parse('top {{ include "f" . }}', helpers).evaluate({}),
    ) as EvalError;
    const cause = e.cause as FailError;
    expect(cause).toBeInstanceOf(FailError);
    expect(cause.pos.offset).toBe(preamble.indexOf("fail"));
    expect(cause.source).toBe(preamble);
  });

  it("keeps the location of a type mismatch inside the body", () => {
    const src = '{{ define "t" }}yy{{ upper 1 }}{{ end }}top {{ include "t" . }}';
    const e = thrown(() => stringEngine().parse(src).evaluate({})) as EvalError;
    expect(e.cause).toBeInstanceOf(TypeMismatchError);
    expect((e.cause as TypeMismatchError).pos.offset).toBe(src.indexOf("upper"));
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

    it("a mark the body reads does not leak into the body's dot", () => {
      const decided: ReadonlySet<unknown>[] = [];
      createEngine<string>({
        fromString: (s) => s,
        funcs: { include, pulse },
        decided: (marks) => decided.push(marks),
      })
        .parse('{{ define "x" }}{{ pulse }}{{ if . }}y{{ end }}{{ end }}{{ include "x" true }}')
        .evaluate({});
      expect(decided.some((m) => m.has(PULSE))).toBe(false);
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
      const e = thrown(() => engine.parse(src).evaluate({})) as EvalError;
      expect(e.cause).toBeInstanceOf(TypeMismatchError);
    });
  });
});
