import { describe, expect, it } from "vitest";
import { marked, unmarked } from "../index.js";
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
  const memory: { v?: unknown } = {};
  const tweenAt = () => carry(0.125, TWEEN);
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
    // Keeps what it is handed in a closure: a store, so it declares a write.
    remember: {
      fn: (v: unknown) => {
        memory.v = v;
        return "";
      },
      argTypes: ["value"],
      arity: { kind: "exact" },
      writes: true,
    },
    recall: { fn: () => memory.v, argTypes: [], arity: { kind: "exact" } },
    // Runs a function it was handed, so it declares a write as `call` does.
    apply: {
      fn: (f: (...a: unknown[]) => unknown, ...a: unknown[]) => f(...a),
      argTypes: ["callable", "value"],
      arity: { kind: "variadic" },
      writes: true,
    },
    // Hides a carrier inside its return, which the engine refuses.
    box: {
      fn: () => ({ c: carry("#ff0000", STEPPED) }),
      argTypes: [],
      arity: { kind: "exact" },
    },
    // Fails only at frames whose keyframe is bad, and says so.
    strictStep: {
      fn: (_h: number, a: string, _h2: number, b: string) => {
        const c = T < 1 ? a : b;
        if (!c.startsWith("#")) throw carry(new Error(`bad colour ${c}`), STEPPED);
        return carry(c, STEPPED);
      },
      argTypes: ["float", "string", "float", "string"],
      arity: { kind: "exact" },
    },
    // Builds on another marking func outside the template.
    clamp: {
      fn: () => {
        const { value, marks } = unmarked(tweenAt());
        return marked(Math.min(0.1, value as number), ...marks);
      },
      argTypes: [],
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
      writes: true,
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

describe("provenance: a declared write reports what it stored through `decided`", () => {
  it.each([
    [`{{ $d := dict }}{{ $_ := set $d "k" (${STEP}) }}{{ fg $d.k "x" }}`, {}, STEPPED],
    [`{{ $_ := set . "k" (${TWEEN_CALL}) }}{{ .k }}`, {}, TWEEN],
    [`{{ $_ := set .a "k" (${STEP}) }}{{ . }}`, { a: {} }, STEPPED],
    [
      `{{ $d := dict "a" (dict) }}{{ $a := $d.a }}{{ $_ := poke $d (${STEP}) }}{{ $a.k }}`,
      {},
      STEPPED,
    ],
    // Nothing reads the write in this evaluation; a later one may.
    [`{{ $d := dict }}{{ $_ := set $d "k" (${TWEEN_CALL}) }}still`, {}, TWEEN],
    // A function from the data, run by `call`, has no registration of its own.
    [
      `{{ $d := dict }}{{ $_ := call .put $d "k" (${STEP}) }}{{ $d.k }}`,
      {
        put: (d: Record<string, unknown>, k: string, v: unknown) => {
          d[k] = v;
          return "";
        },
      },
      STEPPED,
    ],
    // A marked target counts too: it chose which object was written.
    [`{{ $d := dict "t" (${STEP}) }}{{ $_ := set $d "n" 1 }}still`, {}, STEPPED],
    // The write changes a fragment already in the output.
    [`{{ $x := dict "text" "a" }}{{ $x }}{{ $_ := set $x "text" (${STEP}) }}`, {}, STEPPED],
  ])("%s", (src, scope, mark) => {
    expect(run(src, scope).decided).toEqual([[mark]]);
  });

  it("a write inside an arm carries the branch's marks", () => {
    const { decided } = run(
      `{{ $d := dict }}{{ if eq (${STEP}) "#ff0000" }}{{ $_ := set $d "k" "red" }}{{ end }}{{ $d.k }}`,
    );
    expect(decided).toEqual([[STEPPED], [STEPPED]]);
  });

  it("a write into the host's data reports on every evaluation that makes it", () => {
    const data = {};
    const src = `{{ .k }}{{ $_ := set . "k" (${STEP}) }}`;
    for (let i = 0; i < 2; i++) {
      const decided: unknown[][] = [];
      engine({ decided }).parse(src).evaluate(data);
      expect(decided).toEqual([[STEPPED]]);
    }
  });

  it("a write marks no emission: emissions carry only what they read", () => {
    const { out } = run(`{{ $d := dict }}{{ $_ := set $d "k" (${STEP}) }}{{ .name }}`, {
      name: "still",
    });
    expect(out).toEqual([{ text: "still", marks: [] }]);
  });
});

describe("provenance: a call's writes depend only on what that call consumed", () => {
  it("handing the data to an unmarked call in a marked action marks nothing in it", () => {
    const { out } = run(`{{ $c := ${STEP} }}{{ fg $c (get . "label") }}{{ .other }}`, {
      label: "x",
      other: "y",
    });
    expect(out.map((f) => [f.text, f.marks])).toEqual([
      ["x", [STEPPED]],
      ["y", []],
    ]);
  });

  it.each([
    `{{ $p := dict "c" (${STEP}) "row" . }}{{ .name }}`,
    `{{ $l := list (${TWEEN_CALL}) . }}{{ .name }}`,
    `{{ $c := ${STEP} }}{{ $s := printf "%v %v" $c . }}{{ .name }}`,
    `{{ define "row" }}{{ .row.name }}{{ end }}{{ $c := ${STEP} }}{{ template "row" (dict "c" $c "row" .) }}{{ .name }}`,
  ])("a call that declares no writes changes nothing a later read sees: %s", (src) => {
    const { out } = run(src, { name: "still" });
    expect(out.at(-1)).toEqual({ text: "still", marks: [] });
  });
});

describe("provenance: the obligations a func author can meet", () => {
  it("a func that stores what it is handed declares the write, and the store is reported", () => {
    const { out, decided } = run(`{{ $_ := remember (${STEP}) }}{{ recall }}`);
    expect(decided).toEqual([[STEPPED]]);
    expect(out.at(-1)?.text).toBe("#ff0000");
  });

  it("a carrier hidden inside a func's return is named where an operand reaches it", () => {
    expect(() => run("{{ (box).c }}")).toThrow(/marked\(\) value reached the template/);
  });

  it.each([
    "{{ box }}",
    "{{ $b := box }}{{ $b }}",
    '{{ printf "%v" (box) }}',
  ])("a nested carrier stays opaque: its value never reaches output: %s", (src) => {
    const text = run(src)
      .out.map((f) => f.text)
      .join("");
    expect(text).not.toContain("#ff0000");
    expect(
      run(src)
        .out.map((f) => f.text)
        .join(""),
    ).toBe(text);
  });

  it("a func that returns a nested carrier on its own reads it with its marks", () => {
    expect(run('{{ get (box) "c" }}').out).toEqual([{ text: "#ff0000", marks: [STEPPED] }]);
  });

  it("unmarked lets a func build on another marking func's result", () => {
    expect(run("{{ clamp }}").out).toEqual([{ text: "0.1", marks: [TWEEN] }]);
  });
});

describe("provenance: a pipe that throws reports what it read through `decided`", () => {
  it("a func whose failure depends on a mark throws it marked", () => {
    const decided: unknown[][] = [];
    const tpl = engine({ decided }).parse('{{ strictStep 1 "nope" 1 "#0000ff" }}');
    expect(() => tpl.evaluate({})).toThrow(/bad colour nope/);
    expect(decided).toEqual([[STEPPED]]);
  });

  it("a throw while lifting the value reports too", () => {
    const decided: unknown[][] = [];
    const strict = createEngine<Frag>({
      fromString: (text) => {
        if (text === "BAD") throw new Error("bad markup");
        return { text };
      },
      funcs: animated(true),
      decided: (marks) => {
        decided.push([...marks]);
      },
    });
    expect(() => strict.parse(`{{ ${STEP.replace('"#ff0000"', '"BAD"')} }}`).evaluate({})).toThrow(
      /bad markup/,
    );
    expect(decided).toEqual([[STEPPED]]);
  });

  it("a func that runs code it was handed declares the write", () => {
    const { decided } = run(`{{ $d := dict }}{{ $_ := apply .put $d "k" (${STEP}) }}{{ $d.k }}`, {
      put: (d: Record<string, unknown>, k: string, v: unknown) => {
        d[k] = v;
        return "";
      },
    });
    expect(decided).toEqual([[STEPPED]]);
  });

  it("the error may clear when the mark changes", () => {
    const decided: unknown[][] = [];
    const tpl = engine({ decided }).parse(`{{ index (list 1 2) (int (stepped 1 "5" 1 "0")) }}`);
    expect(() => tpl.evaluate({})).toThrow(/index out of range/);
    expect(decided).toEqual([[STEPPED]]);
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
