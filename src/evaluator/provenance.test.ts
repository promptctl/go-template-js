import { describe, expect, it } from "vitest";
import { marked } from "../index.js";
import { sprigConversions } from "../sprig/conversions/index.js";
import { sprigDefaults } from "../sprig/defaults/index.js";
import { sprigDicts } from "../sprig/dicts/index.js";
import { sprigLists } from "../sprig/lists/index.js";
import { sprigMath } from "../sprig/math/index.js";
import { createEngine, type FuncMap } from "./evaluator.js";

// The shape rich-js has: animated funcs whose values change with time,
// evaluated at frame time 0.25 s, and a T that can carry what it depends on.
interface Frag {
  readonly text: string;
  readonly fg?: string;
  readonly marks?: readonly unknown[];
}

const T = 0.25;
const TWEEN = Symbol("tween");
const LOOP = Symbol("loop");
const STEPPED = Symbol("stepped");

// Each returns the value it has at T; `mark` says whether it marks its call.
function animated(mark: boolean): FuncMap {
  const carry = (value: unknown, token: symbol) => (mark ? marked(value, token) : value);
  return {
    // tween duration ease delay from to
    tween: {
      fn: (d: number, _e: string, delay: number, from: number, to: number) =>
        carry(from + (to - from) * Math.min(1, Math.max(0, (T - delay) / d)), TWEEN),
      argTypes: ["float", "string", "float", "float", "float"],
      arity: { kind: "exact" },
    },
    // loop period phase
    loop: {
      fn: (period: number, phase: number) => carry(((T + phase) % period) / period, LOOP),
      argTypes: ["float", "float"],
      arity: { kind: "exact" },
    },
    // stepped hold colour hold colour …
    stepped: {
      fn: (hold: number, colour: string) => carry(T < hold ? colour : "#000000", STEPPED),
      argTypes: ["float", "string", "float", "string"],
      arity: { kind: "variadic" },
    },
    fg: {
      fn: (colour: string, text: string): Frag => ({ text, fg: colour }),
      argTypes: ["string", "string"],
      arity: { kind: "exact" },
    },
    // Writes into nested structure of its argument: d.a.k = v.
    poke: {
      fn: (d: Record<string, Record<string, unknown>>, v: unknown) => {
        (d.a as Record<string, unknown>).k = v;
        return "";
      },
      argTypes: ["dict", "value"],
      arity: { kind: "exact" },
    },
  };
}

function engine(opts: { mark?: boolean; hooks?: boolean; decided?: unknown[][] } = {}) {
  const { mark = true, hooks = true, decided = [] } = opts;
  return createEngine<Frag>({
    fromString: (s) => ({ text: s }),
    toString: (f) => f.text,
    isT: (v): v is Frag => typeof v === "object" && v !== null && "text" in v,
    funcs: {
      ...sprigMath(),
      ...sprigConversions(),
      ...sprigDefaults(),
      ...sprigDicts(),
      ...sprigLists(),
      ...animated(mark),
    },
    ...(hooks
      ? {
          emitted: (value: Frag, marks: ReadonlySet<unknown>) => ({ ...value, marks: [...marks] }),
          decided: (marks: ReadonlySet<unknown>) => {
            decided.push([...marks]);
          },
        }
      : {}),
  });
}

function run(src: string, scope: unknown = {}) {
  const decided: unknown[][] = [];
  const out = engine({ decided }).parse(src).evaluate(scope);
  return { out, decided };
}

const STEP = 'stepped 1 "#ff0000" 1 "#0000ff"';
const TWEEN_CALL = 'tween 2 "linear" 0 0 1';

describe("provenance: a mark bound and never read is reported nowhere", () => {
  it.each([
    `{{ $c := ${STEP} }}{{ if false }}{{ fg $c "x" }}{{ end }}still`,
    `{{ $t := ${TWEEN_CALL} }}still`,
    "{{ $l := loop 2 0 }}still",
    `{{ $d := dict }}{{ $_ := set $d "k" (${TWEEN_CALL}) }}still`,
  ])("%s", (src) => {
    const { out, decided } = run(src);
    expect(out.map((f) => f.text).join("")).toBe("still");
    for (const f of out) expect(f.marks).toEqual([]);
    for (const d of decided) expect(d).toEqual([]);
  });
});

describe("provenance: every emission that depends on a marked value carries the mark", () => {
  it.each([
    [`{{ fg (${STEP}) "x" }}`, "x", STEPPED],
    [`{{ $c := ${STEP} }}{{ fg $c "x" }}`, "x", STEPPED],
    [`{{ $c := ${STEP} }}{{ printf "%s" $c }}`, "#ff0000", STEPPED],
    [`{{ $c := ${STEP} }}{{ $c }}`, "#ff0000", STEPPED],
    [`{{ $c := ${STEP} }}{{ eq $c "#ff0000" }}`, "true", STEPPED],
    [`{{ printf "%.0f" (add 1 (${TWEEN_CALL})) }}`, undefined, TWEEN],
    [
      `{{ define "paint" }}{{ fg . "x" }}{{ end }}{{ $c := ${STEP} }}{{ template "paint" $c }}`,
      "x",
      STEPPED,
    ],
    [`{{ block "paint" (${STEP}) }}{{ fg . "x" }}{{ end }}`, "x", STEPPED],
    [`{{ $c := ${STEP} }}{{ $c | default "none" }}`, "#ff0000", STEPPED],
    [`{{ and true (${STEP}) }}`, "#ff0000", STEPPED],
  ])("%s", (src, text, mark) => {
    const { out } = run(src);
    const last = out.at(-1);
    if (text !== undefined) expect(last?.text).toBe(text);
    expect(last?.marks).toEqual([mark]);
  });

  it("the marks of an arm reach every emission inside it, Text included", () => {
    const { out } = run("{{ if gt (loop 2 0) 0.0 }}x{{ else }}y{{ end }}still");
    expect(out.map((f) => [f.text, f.marks])).toEqual([
      ["x", [LOOP]],
      ["still", []],
    ]);
  });

  it("a `with` dot carries the pipe's marks", () => {
    const { out } = run(`{{ with ${STEP} }}{{ fg . "x" }}{{ end }}`);
    expect(out[0]?.marks).toEqual([STEPPED]);
  });

  it("a variable assigned inside an arm depends on the branch", () => {
    const { out } = run("{{ $x := 0 }}{{ if gt (loop 2 0) 0.0 }}{{ $x = 1 }}{{ end }}{{ $x }}");
    expect(out.at(-1)).toEqual({ text: "1", marks: [LOOP] });
  });

  it("a range item carries the range pipe's marks", () => {
    const { out } = run(`{{ range $i, $c := list (${STEP}) }}{{ fg $c "x" }}{{ end }}`);
    expect(out[0]?.marks).toEqual([STEPPED]);
  });

  it("an unevaluated call reports nothing", () => {
    const { out } = run(`{{ or "x" (${STEP}) }}`);
    expect(out[0]).toEqual({ text: "x", marks: [] });
  });
});

describe("provenance: a mark written into an object follows the object", () => {
  it.each([
    [`{{ $d := dict }}{{ $_ := set $d "k" (${STEP}) }}{{ fg $d.k "x" }}`, {}],
    [`{{ $_ := set . "k" (${TWEEN_CALL}) }}{{ .k }}`, {}],
    // An alias bound before the write still sees it.
    [`{{ $d := dict "a" (dict) }}{{ $a := $d.a }}{{ $_ := set $d.a "k" (${STEP}) }}{{ $a.k }}`, {}],
    // A write into nested structure of the argument, read through an alias.
    [`{{ $d := dict "a" (dict) }}{{ $a := $d.a }}{{ $_ := poke $d (${STEP}) }}{{ $a.k }}`, {}],
    // The write lands on an intermediate object of the chain read later.
    [`{{ $a := .a }}{{ $_ := set $a "k" (${STEP}) }}{{ .a.k }}`, { a: {} }],
  ])("%s", (src, scope) => {
    const { out } = run(src, scope);
    expect(out.at(-1)?.marks?.length).toBe(1);
  });
});

describe("provenance: a control pipe reports its marks through `decided`", () => {
  it("whichever arm is taken — here the empty one", () => {
    const { out, decided } = run("{{ if gt (loop 2 0) 0.5 }}x{{ end }}still");
    expect(decided).toEqual([[LOOP]]);
    expect(out).toEqual([{ text: "still", marks: [] }]);
  });

  it("a range that runs no iteration", () => {
    const { out, decided } = run(`{{ range $i := until (int (${TWEEN_CALL})) }}x{{ end }}`);
    expect(decided).toEqual([[TWEEN]]);
    expect(out).toEqual([]);
  });

  it("a `with` whose value is empty", () => {
    const { decided } = run("{{ with eq (loop 2 0) 9.0 }}x{{ end }}");
    expect(decided).toEqual([[LOOP]]);
  });
});

describe("provenance changes nothing it does not report", () => {
  const sources = [
    `{{ $c := ${STEP} }}{{ fg $c "x" }} {{ printf "%d" (add 1 (${TWEEN_CALL})) }}`,
    `{{ range $i := until 3 }}{{ $i }}{{ end }}{{ if gt (loop 2 0) 0.5 }}x{{ end }}still`,
    `{{ define "paint" }}{{ fg . "x" }}{{ end }}{{ template "paint" (${STEP}) }}`,
  ];

  it.each(sources)("marking without hooks renders what not marking renders: %s", (src) => {
    const marking = engine({ hooks: false }).parse(src).evaluate({});
    const plain = engine({ mark: false, hooks: false }).parse(src).evaluate({});
    expect(marking).toEqual(plain);
    expect(marking.every((f) => !("marks" in f))).toBe(true);
  });

  it.each(sources)("static facts do not see marks: %s", (src) => {
    const a = engine().parse(src);
    const b = engine({ mark: false, hooks: false }).parse(src);
    expect(a.referencedCalls()).toEqual(b.referencedCalls());
    expect(a.referencedFunctions()).toEqual(b.referencedFunctions());
  });

  it("nested carriers flatten into one call's marks", () => {
    const e = createEngine<string>({
      fromString: (s) => s,
      emitted: (v, marks) => `${v}:${[...marks].join(",")}`,
      funcs: {
        twice: { fn: () => marked(marked("v", "a"), "b"), argTypes: [], arity: { kind: "exact" } },
      },
    });
    expect(e.parse("{{ twice }}").evaluate({})).toEqual(["v:a,b"]);
  });
});
