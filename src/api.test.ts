/**
 * Integration smoke test for the public API.
 * Imports go through ./index.js — no internal deep imports allowed.
 */

import { describe, expect, it } from "vitest";
import {
  createEngine,
  Defines,
  EvalError,
  FuncNotFoundError,
  marked,
  type ReferencedArg,
  type ReferencedLiteral,
  sprigDefaults,
  sprigStrings,
  staticDictEntries,
  TemplateError,
  type TemplateFunc,
} from "./index.js";

describe("public API — Engine.parse + Template.evaluate", () => {
  it("parses once and evaluates with multiple scopes", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const template = engine.parse("Hello, {{ .name }}!");
    expect(template.evaluate({ name: "world" }).join("")).toBe("Hello, world!");
    expect(template.evaluate({ name: "ada" }).join("")).toBe("Hello, ada!");
  });

  it("preserves the source on the Template handle", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const src = "x={{ .x }}";
    expect(engine.parse(src).source).toBe(src);
  });
});

describe("public API — Template.referencedFunctions", () => {
  it("reports a command-head function and excludes one never referenced", () => {
    const engine = createEngine<string>({
      fromString: (s) => s,
      funcs: { ...sprigStrings() },
    });
    const refs = engine.parse("{{ upper .name }}").referencedFunctions();
    expect(refs.has("upper")).toBe(true);
    expect(refs.has("lower")).toBe(false);
  });

  it("sees functions through pipelines and nested calls, not just heads", () => {
    const engine = createEngine<string>({
      fromString: (s) => s,
      funcs: { ...sprigStrings() },
    });
    const refs = engine
      .parse('{{ .name | upper | trim }}{{ printf "%s" (lower .x) }}')
      .referencedFunctions();
    expect(refs.has("upper")).toBe(true);
    expect(refs.has("trim")).toBe(true);
    expect(refs.has("lower")).toBe(true);
    expect(refs.has("printf")).toBe(true);
  });

  it("does not mistake a field path or a string literal for a function", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    // `.menu` is a field; "menu" is a string literal — neither is a call.
    const refs = engine.parse('{{ .menu }}{{ print "menu" }}').referencedFunctions();
    expect(refs.has("menu")).toBe(false);
    expect(refs.has("print")).toBe(true);
  });

  it("collects functions referenced inside {{ define }} blocks", () => {
    const engine = createEngine<string>({
      fromString: (s) => s,
      funcs: { ...sprigStrings() },
    });
    const refs = engine
      .parse('{{ define "x" }}{{ upper .y }}{{ end }}{{ template "x" . }}')
      .referencedFunctions();
    expect(refs.has("upper")).toBe(true);
  });
});

describe("public API — Template.referencedCalls", () => {
  it("reports a call's literal string args, with null for non-literals", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const calls = engine.parse('{{ menu "applyTheme" "themePage" false true }}').referencedCalls();
    const menu = calls.find((c) => c.name === "menu");
    expect(menu).toBeDefined();
    // strings decoded; bools (non-string-literals) become null, positions kept.
    expect(menu?.args).toEqual(["applyTheme", "themePage", null, null]);
  });

  it("reports two calls of the same function in one template", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const calls = engine
      .parse('{{ menu "applyTheme" "p1" }}{{ menu "applyStyle" "p2" }}')
      .referencedCalls()
      .filter((c) => c.name === "menu");
    expect(calls).toHaveLength(2);
    expect(calls[0]?.args[0]).toBe("applyTheme");
    expect(calls[1]?.args[0]).toBe("applyStyle");
  });

  it("projects a field argument to null (only its position is known statically)", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const calls = engine.parse('{{ menu "applyTheme" .pageVar }}').referencedCalls();
    const menu = calls.find((c) => c.name === "menu");
    expect(menu?.args).toEqual(["applyTheme", null]);
  });

  it("does not treat a bare field or string literal as a call", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const calls = engine.parse('{{ .menu }}{{ print "menu" }}').referencedCalls();
    expect(calls.some((c) => c.name === "menu")).toBe(false);
    expect(calls.some((c) => c.name === "print")).toBe(true);
  });

  it("collects calls inside {{ define }} blocks", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const calls = engine
      .parse('{{ define "x" }}{{ menu "applyTheme" "p" }}{{ end }}{{ template "x" . }}')
      .referencedCalls();
    expect(calls.some((c) => c.name === "menu" && c.args[0] === "applyTheme")).toBe(true);
  });
});

describe("public API — ReferencedCall.argExprs (static argument projection)", () => {
  const lit = (value: ReferencedLiteral): ReferencedArg => ({ kind: "literal", value });

  it("projects a literal (dict …) argument recursively, readable via staticDictEntries", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const calls = engine
      .parse('{{ menu "a" (dict "key" "pickers" "paged" false) }}')
      .referencedCalls();
    const menu = calls.find((c) => c.name === "menu");
    expect(menu?.argExprs).toEqual([
      lit("a"),
      {
        kind: "call",
        name: "dict",
        args: [lit("key"), lit("pickers"), lit("paged"), lit(false)],
      },
    ]);
    const dictArg = menu?.argExprs[1];
    expect(dictArg && staticDictEntries(dictArg)).toEqual({ key: "pickers", paged: false });
    // the legacy string-only view is unchanged by the richer projection.
    expect(menu?.args).toEqual(["a", null]);
  });

  it("reports a dict with a non-literal entry as unreadable — never a guessed value", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const calls = engine.parse('{{ menu "a" (dict "key" .x) }}').referencedCalls();
    const dictArg = calls.find((c) => c.name === "menu")?.argExprs[1];
    expect(dictArg).toEqual({
      kind: "call",
      name: "dict",
      args: [lit("key"), { kind: "dynamic" }],
    });
    expect(dictArg && staticDictEntries(dictArg)).toBeNull();
  });

  it("reports a nested non-dict call by name; staticDictEntries refuses it", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const calls = engine.parse('{{ menu "a" (upper "k") }}').referencedCalls();
    const arg = calls.find((c) => c.name === "menu")?.argExprs[1];
    expect(arg).toEqual({ kind: "call", name: "upper", args: [lit("k")] });
    expect(arg && staticDictEntries(arg)).toBeNull();
  });

  it("projects scalar literals to the values evaluation would produce", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const calls = engine.parse('{{ menu "a" 3 2.5 true nil }}').referencedCalls();
    const menu = calls.find((c) => c.name === "menu");
    expect(menu?.argExprs).toEqual([lit("a"), lit(3), lit(2.5), lit(true), lit(null)]);
    // only the string literal survives into the legacy view.
    expect(menu?.args).toEqual(["a", null, null, null, null]);
  });

  it("projects a multi-stage paren pipeline as dynamic", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const calls = engine.parse('{{ menu "a" (.x | upper) }}').referencedCalls();
    expect(calls.find((c) => c.name === "menu")?.argExprs[1]).toEqual({ kind: "dynamic" });
  });

  it("keeps argExprs aligned with args position-for-position", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const calls = engine.parse('{{ menu "a" .x "b" false }}').referencedCalls();
    const menu = calls.find((c) => c.name === "menu");
    expect(menu?.args).toEqual(["a", null, "b", null]);
    expect(menu?.argExprs).toEqual([lit("a"), { kind: "dynamic" }, lit("b"), lit(false)]);
  });
});

describe("public API — Engine.compile", () => {
  it("returns a closure usable many times", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const greet = engine.compile("hi {{ .name }}");
    expect(greet({ name: "a" }).join("")).toBe("hi a");
    expect(greet({ name: "b" }).join("")).toBe("hi b");
  });
});

describe("public API — generic-T parameterization", () => {
  type Frag = { kind: string; v: string };
  it("returns T[] for arbitrary T", () => {
    const engine = createEngine<Frag>({
      fromString: (s) => ({ kind: "text", v: s }),
      isT: (v): v is Frag => typeof v === "object" && v !== null && "kind" in v,
    });
    expect(engine.parse("{{ . }}").evaluate("x")).toEqual([{ kind: "text", v: "x" }]);
  });
});

describe("public API — funcs registry composition", () => {
  it("merges sprig categories with user-defined funcs", () => {
    const myFuncs: Record<string, TemplateFunc> = {
      bang: { fn: (s: unknown) => `${String(s)}!`, argTypes: ["string"], arity: { kind: "exact" } },
    };
    const engine = createEngine<string>({
      fromString: (s) => s,
      funcs: { ...sprigDefaults(), ...sprigStrings(), ...myFuncs },
    });
    const result = engine.parse("{{ .name | upper | bang }}").evaluate({ name: "go" });
    expect(result.join("")).toBe("GO!");
  });

  // [LAW:types-are-the-program] `arity` is required, so a registration
  // that omits it is rejected by the compiler rather than defaulting to
  // a permissive value the gate could never check. `@ts-expect-error`
  // fails the typecheck if the omission ever starts compiling, which
  // makes "every registered func declares an arity" a machine-checked
  // property of the public type and not a convention.
  it("rejects a registration that declares no arity", () => {
    const missingArity: Record<string, TemplateFunc> = {
      // @ts-expect-error — `arity` is required on TemplateFunc.
      bang: { fn: (s: unknown) => `${String(s)}!`, argTypes: ["string"] },
    };
    expect(Object.keys(missingArity)).toEqual(["bang"]);
  });
});

describe("public API — Engine instances are stateless", () => {
  it("two parses against the same engine don't share state", () => {
    const engine = createEngine<string>({ fromString: (s) => s });
    const a = engine.parse("{{ .x }}");
    const b = engine.parse("{{ .y }}");
    expect(a.evaluate({ x: "X", y: "Y" }).join("")).toBe("X");
    expect(b.evaluate({ x: "X", y: "Y" }).join("")).toBe("Y");
  });
});

describe("parse with inherited defines", () => {
  const engine = createEngine<string>({ fromString: (s) => s, funcs: sprigStrings() });
  const preambleSrc =
    '{{ define "shout" }}{{ upper . }}!{{ end }}{{ define "boom" }}{{ nosuchfn . }}{{ end }}';
  const helpers = engine.parse(preambleSrc).defines();

  it("evaluates inherited templates exactly as prepended ones", () => {
    const shared = engine.parse('{{ template "shout" .name }}', helpers);
    const prepended = engine.parse(`${preambleSrc}{{ template "shout" .name }}`);
    expect(shared.evaluate({ name: "hi" })).toEqual(prepended.evaluate({ name: "hi" }));
    expect(shared.evaluate({ name: "hi" }).join("")).toBe("HI!");
  });

  it("keeps the inheriting template's source free of the preamble", () => {
    const tpl = engine.parse('{{ template "shout" .name }}', helpers);
    expect(tpl.source).toBe('{{ template "shout" .name }}');
  });

  it("an error inside an inherited body snippets against the preamble's source", () => {
    const tpl = engine.parse('{{ template "boom" . }}', helpers);
    let caught: unknown;
    try {
      tpl.evaluate({});
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(FuncNotFoundError);
    expect((caught as FuncNotFoundError).source).toBe(preambleSrc);
  });

  it("referencedCalls/Functions describe this parse only, not the inherited set", () => {
    const tpl = engine.parse('{{ template "shout" (lower .name) }}', helpers);
    expect(tpl.referencedFunctions()).toEqual(new Set(["lower"]));
    expect(engine.parse(preambleSrc).referencedFunctions()).toEqual(new Set(["upper", "nosuchfn"]));
  });

  it("defines() chain: a template's own defines ride in front of the inherited ones", () => {
    const mid = engine.parse('{{ define "quiet" }}{{ lower . }}{{ end }}', helpers);
    const tpl = engine.parse('{{ template "quiet" .a }}{{ template "shout" .b }}', mid.defines());
    expect(tpl.evaluate({ a: "AB", b: "cd" }).join("")).toBe("abCD!");
  });
});

describe("public API — Template.evaluateDefine", () => {
  const engine = createEngine<string>({ fromString: (s) => s });

  it("renders one define with the scope as its dot and $, not the whole template", () => {
    const t = engine.parse(
      'body{{ define "card" }}[{{ .title }}|{{ $.title }}]{{ end }}{{ define "other" }}no{{ end }}',
    );
    expect(t.evaluateDefine("card", { title: "hi" }).join("")).toBe("[hi|hi]");
  });

  it("renders an inherited define, and a define that invokes another", () => {
    const helpers = engine.parse('{{ define "name" }}<{{ . }}>{{ end }}').defines();
    const t = engine.parse('{{ define "greet" }}hi {{ template "name" .who }}{{ end }}', helpers);
    expect(t.evaluateDefine("greet", { who: "ada" }).join("")).toBe("hi <ada>");
    expect(t.evaluateDefine("name", "go").join("")).toBe("<go>");
  });

  it("produces typed output through emitted, as a whole-template render does", () => {
    type Frag = { kind: "text"; v: string } | { kind: "node"; n: number };
    const typed = createEngine<Frag>({
      fromString: (v) => ({ kind: "text", v }),
      isT: (v): v is Frag => typeof v === "object" && v !== null && "kind" in v,
      emitted: (f) => (f.kind === "text" ? { kind: "text", v: f.v.toUpperCase() } : f),
    });
    const node: Frag = { kind: "node", n: 42 };
    const t = typed.parse('{{ define "d" }}a{{ .n }}{{ end }}');
    expect(t.evaluateDefine("d", { n: node })).toEqual([{ kind: "text", v: "A" }, node]);
  });

  it("reports the define's decisions and emissions with their marks", () => {
    const PULSE = Symbol("pulse");
    const pulse = {
      fn: () => marked(true, PULSE),
      argTypes: [],
      arity: { kind: "exact" } as const,
    };
    const decided: ReadonlySet<unknown>[] = [];
    const emitted: ReadonlySet<unknown>[] = [];
    createEngine<string>({
      fromString: (s) => s,
      funcs: { pulse },
      decided: (marks) => decided.push(marks),
      emitted: (value, marks) => {
        emitted.push(marks);
        return value;
      },
    })
      .parse('{{ define "d" }}{{ if pulse }}{{ end }}{{ pulse }}{{ end }}')
      .evaluateDefine("d", {});
    expect(decided.some((m) => m.has(PULSE))).toBe(true);
    expect(emitted.some((m) => m.has(PULSE))).toBe(true);
  });

  it("throws a plain Error for a name that was never defined, the host's mistake", () => {
    let caught: unknown;
    try {
      engine.parse('line one\n{{ define "a" }}{{ end }}').evaluateDefine("b", {});
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(TemplateError);
    expect((caught as Error).message).toBe('template "b" is not defined');
  });

  it("points an overflow inside an inherited define into the source that declared it", () => {
    const helpers = engine.parse('{{ define "r" }}{{ template "r" . }}{{ end }}').defines();
    let caught: unknown;
    try {
      engine.parse("xx", helpers).evaluateDefine("r", 1);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EvalError);
    expect((caught as EvalError).source).toBe('{{ define "r" }}{{ template "r" . }}{{ end }}');
  });
});

describe("public API — Defines.names", () => {
  const engine = createEngine<string>({ fromString: (s) => s });

  it("lists every name a template can render, own and inherited through the whole chain, sorted", () => {
    const base = engine.parse('{{ define "z" }}{{ end }}').defines();
    const mid = engine.parse('{{ block "b" . }}{{ end }}', base).defines();
    const top = engine.parse('{{ define "m" }}{{ end }}', mid).defines();
    expect(top.names()).toEqual(["b", "m", "z"]);
  });

  it("lists a block over an inherited define once, and the inherited body is what renders", () => {
    const base = engine.parse('{{ define "b" }}base{{ end }}').defines();
    const tpl = engine.parse('{{ block "b" . }}block{{ end }}', base);
    expect(tpl.defines().names()).toEqual(["b"]);
    expect(tpl.evaluateDefine("b", {}).join("")).toBe("base");
  });

  it("is empty for EMPTY and for a template that declares nothing", () => {
    expect(Defines.EMPTY.names()).toEqual([]);
    expect(engine.parse("plain").defines().names()).toEqual([]);
  });
});
