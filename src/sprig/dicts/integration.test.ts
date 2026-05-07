import { describe, expect, it } from "vitest";
import { TypeMismatchError } from "../../errors.js";
import { createEngine } from "../../evaluator/evaluator.js";
import { sprigDicts } from "./index.js";

const render = (src: string, scope: unknown = null): string =>
  createEngine<string>({ fromString: (s) => s, funcs: sprigDicts() })
    .parse(src)
    .evaluate(scope)
    .join("");

const eng = () => createEngine<string>({ fromString: (s) => s, funcs: sprigDicts() });

describe("sprig dicts — integration", () => {
  it("dict builds + get reads (direct-call form)", () => {
    expect(render('{{ get (dict "a" 1 "b" 2) "a" }}')).toBe("1");
  });

  it("get composes with pipe form when the key is piped: `key | get d`", () => {
    // Last-arg piping puts the pipe value in the trailing slot, which
    // is `key` for `get(d, key)`. Matches Go sprig's behavior.
    expect(render('{{ "a" | get (dict "a" 1 "b" 2) }}')).toBe("1");
  });

  it("set mutates the dict and returns it (Go sprig parity)", () => {
    // Two-step: set, then read back. The read sees the mutation.
    expect(render('{{- $d := dict "a" 1 -}}{{- $_ := set $d "b" 2 -}}{{ $d.a }},{{ $d.b }}')).toBe(
      "1,2",
    );
  });

  it("unset mutates the dict in place", () => {
    expect(
      render('{{- $d := dict "a" 1 "b" 2 -}}{{- $_ := unset $d "a" -}}{{ hasKey $d "a" }}'),
    ).toBe("false");
  });

  it("hasKey predicate", () => {
    expect(render('{{ if hasKey . "a" }}YES{{ else }}NO{{ end }}', { a: 1 })).toBe("YES");
  });

  // [LAW:single-enforcer] These tests assert engine-level behavior:
  // non-dict receivers are rejected at the typed gate. They replace
  // body-level unit tests that previously pinned the body's defensive
  // throw, which became dead code after the slot declared "dict".
  describe("non-dict receiver rejected at the gate", () => {
    it("set", () => {
      expect(() => eng().parse('{{ set . "k" "v" }}').evaluate(null)).toThrow(TypeMismatchError);
      expect(() => eng().parse('{{ set . "k" "v" }}').evaluate(new Map())).toThrow(
        TypeMismatchError,
      );
      expect(() => eng().parse('{{ set . "k" "v" }}').evaluate([])).toThrow(TypeMismatchError);
      expect(() => eng().parse('{{ set . "k" "v" }}').evaluate("string")).toThrow(
        TypeMismatchError,
      );
    });

    it("unset", () => {
      expect(() => eng().parse('{{ unset . "k" }}').evaluate(null)).toThrow(TypeMismatchError);
      expect(() => eng().parse('{{ unset . "k" }}').evaluate(new Map())).toThrow(TypeMismatchError);
      expect(() => eng().parse('{{ unset . "k" }}').evaluate(42)).toThrow(TypeMismatchError);
    });
  });

  // [LAW:single-enforcer] dict's variadic kv pairing is enforced by the
  // gate via argTypePattern: "alternating" (template-laws-3gt.3). A
  // non-string in any even-index slot throws TypeMismatchError naming
  // that slot — the body never validates per-key.
  describe("dict alternating kv pattern (template-laws-3gt.3)", () => {
    it("rejects a non-string key beyond the first kv pair", () => {
      let caught: unknown;
      try {
        render('{{ dict "a" 1 2 3 }}');
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(TypeMismatchError);
      const err = caught as TypeMismatchError;
      expect(err.funcName).toBe("dict");
      // Slot 3 = the third arg = the 2nd key position (must be string).
      expect(err.argIndex).toBe(3);
    });

    it("accepts heterogeneous values at every odd slot", () => {
      // values at odd positions are "value" — anything goes. A number,
      // a string, and a bool all flow through to the constructed dict.
      expect(render('{{ get (dict "a" 1 "b" "two" "c" true) "b" }}')).toBe("two");
      expect(render('{{ get (dict "a" 1 "b" "two" "c" true) "c" }}')).toBe("true");
    });
  });
});
