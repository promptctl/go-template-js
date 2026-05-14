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

  // [LAW:one-source-of-truth] eq/ne route structural comparison through
  // `deepEqual` (closes audit G1). Reference equality on objects gave
  // surprising NEQ for two structurally-identical typed-T fragments.
  it("eq deep-compares arrays, plain objects, Maps, and Sets", () => {
    const eng = createEngine<string>({ fromString: (s) => s });
    expect(
      eng
        .parse("{{ eq .a .b }}")
        .evaluate({ a: [1, 2, 3], b: [1, 2, 3] })
        .join(""),
    ).toBe("true");
    expect(
      eng
        .parse("{{ eq .a .b }}")
        .evaluate({ a: { x: 1, y: 2 }, b: { x: 1, y: 2 } })
        .join(""),
    ).toBe("true");
    expect(
      eng
        .parse("{{ eq .a .b }}")
        .evaluate({ a: { x: 1 }, b: { x: 2 } })
        .join(""),
    ).toBe("false");
    expect(
      eng
        .parse("{{ ne .a .b }}")
        .evaluate({ a: [1, 2], b: [1, 3] })
        .join(""),
    ).toBe("true");
  });

  it("eq rejects cross-kind comparisons (string vs number)", () => {
    expect(() => render('{{ eq "foo" 1 }}')).toThrow(TypeMismatchError);
  });

  it("eq rejects cross-kind structural comparisons (array vs object)", () => {
    const eng = createEngine<string>({ fromString: (s) => s });
    expect(() => eng.parse("{{ eq .a .b }}").evaluate({ a: [1], b: { x: 1 } })).toThrow(
      TypeMismatchError,
    );
  });

  it("eq treats nil as a wildcard kind (eq .field nil)", () => {
    const eng = createEngine<string>({ fromString: (s) => s });
    expect(eng.parse("{{ eq .a nil }}").evaluate({ a: null }).join("")).toBe("true");
    expect(eng.parse("{{ eq .a nil }}").evaluate({ a: 1 }).join("")).toBe("false");
    expect(eng.parse('{{ eq nil "x" }}').evaluate(null).join("")).toBe("false");
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

  // [LAW:single-enforcer] Closes audit B5: the gate rejects typed-T
  // keys before the body's `String(key)` could silently flatten them.
  it("index rejects a typed-T key against an object collection (B5)", () => {
    let err: unknown;
    try {
      render("{{ index . .key }}", { a: 1, key: { tag: "color", text: "x" } });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(TypeMismatchError);
    if (err instanceof TypeMismatchError) {
      expect(err.funcName).toBe("index");
      expect(err.argIndex).toBe(2);
    }
  });

  // [LAW:single-enforcer] index's collection slot rejects nil — the
  // body no longer needs an "indexing into nil" branch on the initial
  // receiver. Mid-walk nil still surfaces via the catch-all.
  it("index rejects a nil receiver at the gate", () => {
    expect(() => render("{{ index . 0 }}", null)).toThrow(TypeMismatchError);
  });

  it("index on object requires a string key (number-on-object body error)", () => {
    expect(() => render("{{ index . 0 }}", { a: 1 })).toThrow(/object index must be string/);
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

  // [LAW:single-enforcer] Closes audit findings B1–B4. typed-T no
  // longer silently `String(v)`-flattens to "[object Object]"; the
  // gate routes through `engine.toString` (consumer-supplied or the
  // default that throws for non-primitive non-string values).
  describe("typed-T flattening via engine.toString", () => {
    interface Frag {
      readonly tag: string;
      readonly text: string;
    }
    const color = (text: string): Frag => ({ tag: "color", text });

    it("print throws TypeMismatchError when no engine.toString is configured for typed-T", () => {
      const eng = createEngine<string>({ fromString: (s) => s });
      expect(() => eng.parse("{{ print .frag }}").evaluate({ frag: color("x") })).toThrow(
        TypeMismatchError,
      );
    });

    it("print routes typed-T through consumer-supplied engine.toString", () => {
      const eng = createEngine<string>({
        fromString: (s) => s,
        toString: ((v: unknown) => (v as Frag).text) as (v: string) => string,
      });
      expect(
        eng
          .parse("{{ print .frag }}")
          .evaluate({ frag: color("x") })
          .join(""),
      ).toBe("x");
    });

    it('printf "%s" routes typed-T through consumer-supplied engine.toString', () => {
      const eng = createEngine<string>({
        fromString: (s) => s,
        toString: ((v: unknown) => (v as Frag).text) as (v: string) => string,
      });
      expect(
        eng
          .parse('{{ printf "%s" .frag }}')
          .evaluate({ frag: color("x") })
          .join(""),
      ).toBe("x");
    });

    it('printf "%q" wraps the consumer-flattened text in JSON escape', () => {
      const eng = createEngine<string>({
        fromString: (s) => s,
        toString: ((v: unknown) => (v as Frag).text) as (v: string) => string,
      });
      expect(
        eng
          .parse('{{ printf "%q" .frag }}')
          .evaluate({ frag: color("x") })
          .join(""),
      ).toBe('"x"');
    });

    it("println throws when no engine.toString is configured for typed-T", () => {
      const eng = createEngine<string>({ fromString: (s) => s });
      expect(() => eng.parse("{{ println .frag }}").evaluate({ frag: color("x") })).toThrow(
        TypeMismatchError,
      );
    });
  });
});

describe("builtins — html escape", () => {
  it("escapes the six HTML-significant characters and concatenates per fmt.Sprint", () => {
    // All-strings: no spaces between adjacents (matches print/fmt.Sprint).
    expect(render('{{ html "<b>" "&" "</b>" }}')).toBe("&lt;b&gt;&amp;&lt;/b&gt;");
  });

  it("escapes single and double quotes to shortest numeric entities", () => {
    expect(render(`{{ html "'hi'" }}`)).toBe("&#39;hi&#39;");
    expect(render('{{ html "\\"hi\\"" }}')).toBe("&#34;hi&#34;");
  });

  it("replaces NUL with the Unicode replacement character", () => {
    expect(render('{{ html "a\\x00b" }}')).toBe("a�b");
  });

  it("passes ASCII text through unchanged", () => {
    expect(render('{{ html "hello world" }}')).toBe("hello world");
  });

  it("flattens numeric / boolean / nil args via fmt.Sprint rules", () => {
    // Space between adjacent non-strings (1, true); nil renders as `<nil>`
    // and the `<` / `>` then get escaped — matches Go's text/template.
    expect(render("{{ html 1 true }}")).toBe("1 true");
    expect(render("{{ html . }}", null)).toBe("&lt;nil&gt;");
  });

  it("works in a pipeline: piped value flows into the trailing slot", () => {
    expect(render('{{ "<x>" | html }}')).toBe("&lt;x&gt;");
  });

  it("returns empty string with zero args", () => {
    expect(render("{{ html }}")).toBe("");
  });

  // [LAW:single-enforcer] `html` declares `"stringifiable"` — the same
  // gate print/printf use — so typed-T values without a configured
  // `toString` are rejected at the boundary, not silently flattened.
  it("throws TypeMismatchError when no engine.toString is configured for typed-T", () => {
    interface Frag {
      readonly text: string;
    }
    const eng = createEngine<string>({ fromString: (s) => s });
    expect(() => eng.parse("{{ html .frag }}").evaluate({ frag: { text: "x" } as Frag })).toThrow(
      TypeMismatchError,
    );
  });

  it("routes typed-T through consumer-supplied engine.toString and then escapes", () => {
    interface Frag {
      readonly text: string;
    }
    const eng = createEngine<string>({
      fromString: (s) => s,
      toString: ((v: unknown) => (v as Frag).text) as (v: string) => string,
    });
    expect(
      eng
        .parse("{{ html .frag }}")
        .evaluate({ frag: { text: "<a>" } as Frag })
        .join(""),
    ).toBe("&lt;a&gt;");
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
