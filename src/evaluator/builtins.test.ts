import { describe, expect, it } from "vitest";
import { TypeMismatchError } from "./errors.js";
import { createEngine } from "./evaluator.js";

const render = (src: string, scope: unknown = null): string =>
  createEngine<string>({ fromString: (s) => s })
    .parse(src)
    .evaluate(scope)
    .join("");

describe("builtins — comparison", () => {
  it("eq with two args", () => {
    expect(render("{{ eq 1 1 }}")).toBe("true");
    expect(render("{{ eq 1 2 }}")).toBe("false");
  });

  it("eq with multiple right-hand args returns true if any match", () => {
    expect(render("{{ eq 1 2 3 1 }}")).toBe("true");
    expect(render("{{ eq 1 2 3 4 }}")).toBe("false");
  });

  it("ne / lt / le / gt / ge", () => {
    expect(render("{{ ne 1 2 }}")).toBe("true");
    expect(render("{{ lt 1 2 }}")).toBe("true");
    expect(render("{{ le 2 2 }}")).toBe("true");
    expect(render("{{ gt 3 2 }}")).toBe("true");
    expect(render("{{ ge 2 2 }}")).toBe("true");
    expect(render("{{ ge 1 2 }}")).toBe("false");
  });

  it("compares strings", () => {
    expect(render('{{ eq "a" "a" }}')).toBe("true");
    expect(render('{{ lt "a" "b" }}')).toBe("true");
  });

  // [LAW:one-source-of-truth + LAW:single-enforcer] Match Go's
  // `text/template` rule: ordering operands must share a type. The
  // earlier behavior silently returned `false` for both `lt "foo" 1`
  // and `gt "foo" 1`, hiding cross-type comparisons in pipelines.
  it("lt rejects cross-type pairs (string vs number)", () => {
    let err: unknown;
    try {
      render('{{ lt "foo" 1 }}');
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(TypeMismatchError);
    if (err instanceof TypeMismatchError) {
      expect(err.funcName).toBe("lt");
      expect(err.argIndex).toBe(2);
    }
  });

  it("gt rejects cross-type pairs (string vs number)", () => {
    expect(() => render('{{ gt "foo" 1 }}')).toThrow(TypeMismatchError);
  });

  it("le rejects bool vs number", () => {
    expect(() => render("{{ le true 1 }}")).toThrow(TypeMismatchError);
  });

  it("ge rejects string vs bool", () => {
    expect(() => render('{{ ge "yes" true }}')).toThrow(TypeMismatchError);
  });

  it("number↔bigint pair is bridged (no error)", () => {
    // Negative literals with a `0n`-like value require a hand-built
    // bigint scope; `1` literals here both parse as Number, but both
    // sides being numeric (one number, one bigint) must work too.
    const eng = createEngine<string>({ fromString: (s) => s });
    const out = eng.parse("{{ lt . 5 }}").evaluate(3n).join("");
    expect(out).toBe("true");
  });

  it("ordered slot rejects null/undefined/object (per-slot kind check)", () => {
    expect(() => render("{{ lt . 1 }}", null)).toThrow(TypeMismatchError);
  });
});

describe("builtins — boolean (and/or/not)", () => {
  it("and returns the first falsy or last truthy value", () => {
    expect(render("{{ and true true 5 }}")).toBe("5");
    expect(render("{{ and 1 0 .x }}")).toBe("0");
  });

  it("or returns the first truthy or the last value", () => {
    expect(render('{{ or "" 0 "win" }}')).toBe("win");
    expect(render('{{ or "" 0 false }}')).toBe("false");
  });

  it("and short-circuits — does NOT evaluate later args after a falsy one", () => {
    // If `or` were eager, the field access on the second arg of `and`
    // would throw `field "boom" not found`. It must short-circuit.
    expect(render("{{ if and false .boom }}YES{{ else }}NO{{ end }}", { x: 1 })).toBe("NO");
  });

  it("or short-circuits — does NOT evaluate later args after a truthy one", () => {
    // The .boom field is missing on the scope; if `or` were eager it
    // would throw. The truthy first arg short-circuits.
    expect(render('{{ if or "ok" .boom }}YES{{ else }}NO{{ end }}', { x: 1 })).toBe("YES");
  });

  it("not negates truthiness", () => {
    expect(render('{{ not "" }}')).toBe("true");
    expect(render('{{ not "x" }}')).toBe("false");
  });
});

describe("builtins — len / index / slice", () => {
  it("len of strings, arrays, Maps, plain objects", () => {
    expect(render("{{ len . }}", "abc")).toBe("3");
    expect(render("{{ len . }}", [1, 2, 3, 4])).toBe("4");
    expect(render("{{ len . }}", new Map([["a", 1]]))).toBe("1");
    expect(render("{{ len . }}", { a: 1, b: 2 })).toBe("2");
  });

  it("index into arrays and strings", () => {
    expect(render("{{ index . 1 }}", ["a", "b", "c"])).toBe("b");
    expect(render("{{ index . 0 }}", "abc")).toBe("a");
  });

  it("index walks multiple keys", () => {
    expect(
      render("{{ index . 1 0 }}", [
        ["a", "b"],
        ["c", "d"],
      ]),
    ).toBe("c");
  });

  it("slice arrays and strings", () => {
    expect(render("{{ slice . 1 4 }}", "abcdef")).toBe("bcd");
    expect(render("{{ index (slice . 1 3) 0 }}", [10, 20, 30, 40])).toBe("20");
  });
});

describe("builtins — print / println / printf", () => {
  it("print joins per Go's fmt.Sprint: spaces only between non-string adjacents", () => {
    // All-strings: no spaces.
    expect(render('{{ print "a" "b" "c" }}')).toBe("abc");
    // Mixed: space between adjacent non-strings (1 + true), none around strings.
    expect(render('{{ print "x" 1 true }}')).toBe("x1 true");
  });

  it("println adds a trailing newline", () => {
    expect(render('{{ println "hi" }}')).toBe("hi\n");
  });

  it("printf %s / %d / %v / %q / %f / %t / %x", () => {
    expect(render('{{ printf "%s" "yo" }}')).toBe("yo");
    expect(render('{{ printf "%d" 42 }}')).toBe("42");
    expect(render('{{ printf "%v" 42 }}')).toBe("42");
    expect(render('{{ printf "%q" "yo" }}')).toBe('"yo"');
    expect(render('{{ printf "%.2f" 1.5 }}')).toBe("1.50");
    expect(render('{{ printf "%t" true }}')).toBe("true");
    expect(render('{{ printf "%x" 255 }}')).toBe("ff");
  });

  it("printf width and left-align flags", () => {
    expect(render('{{ printf "[%5s]" "x" }}')).toBe("[    x]");
    expect(render('{{ printf "[%-5s]" "x" }}')).toBe("[x    ]");
  });

  it("printf with multiple verbs", () => {
    expect(render('{{ printf "%s=%d" "n" 7 }}')).toBe("n=7");
  });

  it("printf via pipe — format string is FIRST arg, piped value is LAST", () => {
    // `42 | printf "%d"` → printf("%d", 42)
    expect(render('{{ 42 | printf "%d" }}')).toBe("42");
  });
});

describe("builtins — call", () => {
  it("invokes a function value drawn from the scope", () => {
    const scope = {
      double: (n: number) => n * 2,
    };
    expect(render("{{ call .double 21 }}", scope)).toBe("42");
  });
});
