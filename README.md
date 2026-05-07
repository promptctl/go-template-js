# go-template-js

Go template syntax + Sprig subset, generic over output type, in TypeScript.

- **Same syntax as Go's `text/template`** — templates that parse there parse here.
- **Generic over the output type** — render to strings, structured fragments, or anything else.
- **No silent flattening** — typed values never become strings without an explicit conversion.

## Install

```bash
pnpm add go-template-js
```

## Quickstart (string output)

```ts
import { createEngine } from "go-template-js";

const engine = createEngine<string>({ fromString: (s) => s });
const tpl = engine.parse("Hello, {{ .name }}!");
console.log(tpl.evaluate({ name: "world" }).join("")); // "Hello, world!"
```

`fromString` is the engine's bridge from text literals to its output type `T`. With `T = string` it's the identity function — that recovers Go template's default behaviour.

`engine.compile(src)` is the parse-and-evaluate sugar:

```ts
const greet = engine.compile("hi {{ .name }}");
greet({ name: "ada" }).join(""); // "hi ada"
```

## Generic-T tutorial

The engine is parameterised over its output fragment type `T`. Consumers pick a fragment shape (e.g. styled text, AST nodes, layout primitives) and the engine emits a `T[]` that integrates into their downstream pipeline:

```ts
import { createEngine, type TemplateFunc } from "go-template-js";

interface Frag { color: string; text: string }

const engine = createEngine<Frag>({
  fromString: (s) => ({ color: "default", text: s }),
  funcs: {
    red: {
      fn: (s: unknown) => ({ color: "red", text: String(s) }),
      argTypes: ["string"],
      returnType: "T",
    },
  },
});

const tpl = engine.parse('{{ .label }}: {{ red .value }}');
tpl.evaluate({ label: "warn", value: "ALERT" });
// → [
//   { color: "default", text: "warn" },
//   { color: "default", text: ": " },
//   { color: "red", text: "ALERT" },
// ]
```

Functions have optional `argTypes`. The engine uses them to enforce one architectural commitment: **a non-string `T` value will never silently flatten into a `string` parameter**. If you try to pipe a styled fragment into a function declared with `argTypes: ["string"]`, you get a `TypeMismatchError` naming the function, the argument index, and a suggestion to call your `unstyled` (or equivalent) flatten helper.

### Stringification: the `toString` mirror of `fromString`

If your `T` is not `string`, the engine needs a way to flatten typed-T values back to plain text when they reach a `"stringifiable"` slot (`print`, `println`, `printf "%s"` and `"%q"`). Supply it via `toString`:

```ts
const engine = createEngine<Frag>({
  fromString: (s) => ({ color: "default", text: s }),
  toString: (frag) => frag.text,
});
```

Without it, typed-T values reaching a `"stringifiable"` slot throw `TypeMismatchError` directing you to configure `toString`. The default `toString` passes strings through unchanged and flattens numeric/boolean/nil primitives, so `T = string` engines work out of the box.

### `ArgType` reference

Every entry in `argTypes` is one of:

| Kind | Accepts at runtime | Used by (examples) |
| --- | --- | --- |
| `"string"` | JS `string` | `upper`, `lower`, `trim`, `printf` format string |
| `"number"` | `typeof === "number"` or `bigint` (interchangeable) | `add`, `sub`, `mul`, `mod` |
| `"bool"` | `typeof === "boolean"` | (rare; most boolean slots use `"truthy"`) |
| `"T"` | Any non-primitive (consumer-defined fragment) | consumer-defined typed funcs returning `T` |
| `"ordered"` | `string`, `number`, `bigint`, or `boolean` | `lt`, `le`, `gt`, `ge` — additionally requires both slots share a kind |
| `"comparable"` | `"ordered"` ∪ nil ∪ arrays / Maps / Sets / plain objects (deep-equal) | `eq`, `ne` |
| `"list"` | `Array.isArray` | `first`, `last`, `rest`, `uniq`, `concat`, `chunk` |
| `"dict"` | plain object only (not `Map`, not class instance) | `get`, `keys`, `values`, `pluck`, `merge` |
| `"sized"` | `string` ∪ array ∪ `Map` ∪ `Set` ∪ plain object | `len` |
| `"stringifiable"` | `string`, or any value the engine's `toString` can flatten | `print`, `println`, `printf "%s"`, `printf "%q"` |
| `"callable"` | `typeof === "function"` | `call` (first slot) |
| `"collection"` | `string` ∪ array ∪ `Map` ∪ plain object | `index` (receiver slot) |
| `"index-key"` | `string`, `number`, or `bigint` | `index` (key slots) |
| `"sliceable"` | `string` or array | `slice` (receiver slot) |
| `"truthy"` | anything (truthiness context) | `not`, `and`, `or`, `default`, `empty`, `coalesce`, `ternary` |
| `"reflective"` | anything (type-inspection context) | `kindOf`, `typeOf`, `kindIs`, `typeIs`, `typeIsLike` |
| `"serializable"` | anything `JSON.stringify`-encodable (rejects functions, symbols, `bigint`) | `toJson`, `toPrettyJson` |
| `"value"` | anything (genuinely heterogeneous, by intent) | `list` constructor, `deepEqual`, `deepCopy`, `prepend` / `append` items |

The legacy `"any"` kind was removed in epic `template-laws-3gt`. Slots that genuinely accept anything now declare their *intent* (`"truthy"` / `"reflective"` / `"value"` / `"serializable"`); slots that did not are pinned to their precise kind so the gate enforces the constraint instead of leaking it into func bodies.

#### Variadic patterns

For variadic funcs, declare the trailing slot's type once — every excess argument is validated against it.

For funcs whose variadic tail *cycles* (e.g. `dict "k1" v1 "k2" v2 …`), set `argTypePattern: "alternating"` on the registration. The slot for arg index `i` becomes `argTypes[i % argTypes.length]`, so `dict` declares `argTypes: ["string", "value"]` and the gate enforces "string at even index, anything at odd index" without per-key revalidation in the body.

## Syntax reference

Template syntax is Go template syntax. Read the canonical spec:
https://pkg.go.dev/text/template

Supported:

- All actions: `{{ pipeline }}`, `{{- ... -}}` trim markers, `{{/* comments */}}`.
- All control flow: `if/else if/else/end`, `range/else/end` (with index/value forms `range $i, $v := …`), `with/else/end`.
- All sub-template forms: `define`, `template`, `block`.
- Variable assignment: `$x := pipe` and `$x = pipe`.
- All literals: strings (interpreted + raw backtick), runes, integers (decimal/hex/octal/binary), floats (with exponents and hex-float `p` exponents), booleans, `nil`.
- Field access on JS objects (own + prototype properties), `Map` (via `.get`), arrays (numeric `index` builtin).
- Pipelines with last-arg piping: `x | f a b` ≡ `f a b x`.

### Built-in functions

All of Go template's runtime built-ins:

`and` `or` `not` · `eq` `ne` `lt` `le` `gt` `ge` · `len` `index` `slice` · `print` `println` `printf` · `call`

`and`/`or` short-circuit (the engine passes thunks for those). `printf` supports `%s`, `%d`, `%v`, `%q`, `%f` (precision-aware), `%t`, `%x`, plus width and `-` left-align flags.

### Sprig subset

Imported from `go-template-js` as category-scoped `FuncMap` factories:

| Category | Helper | Functions |
| --- | --- | --- |
| Defaults | `sprigDefaults()` | default, empty, coalesce, ternary, fromJson, toJson, toPrettyJson |
| Strings | `sprigStrings()` | trim, trimAll, trimPrefix, trimSuffix, upper, lower, title, untitle, repeat, substr, trunc, contains, hasPrefix, hasSuffix, replace, split, splitList, join, quote, squote, cat, indent, nindent, wrap, wrapWith, abbrev, abbrevboth, initials |
| Math | `sprigMath()` | add, sub, mul, div, mod, min, max, floor, ceil, round, addf, subf, mulf, divf |
| Lists | `sprigLists()` | list, first, last, rest, initial, len, reverse, uniq, without, has, compact, slice, concat, chunk, prepend, append |
| Dicts | `sprigDicts()` | dict, get, set, unset, keys, values, pluck, pick, omit, hasKey, merge, mergeOverwrite |
| Regex | `sprigRegex()` | regexMatch, regexFind, regexFindAll, regexReplaceAll, regexReplaceAllLiteral, regexSplit |
| Types | `sprigTypes()` | kindOf, kindIs, typeOf, typeIs, typeIsLike, deepEqual, deepCopy |

## Composing funcs from multiple sources

The `funcs` registry merges from any number of sources, with later entries overriding earlier on name collision:

```ts
const engine = createEngine<string>({
  fromString: (s) => s,
  funcs: {
    ...sprigDefaults(),
    ...sprigStrings(),
    ...projectFuncs,    // your own, can override sprig if needed
  },
});
```

Go template's runtime built-ins (the names listed under "Built-in functions" above) are always merged in by `createEngine` itself; you do not register them. A consumer-supplied entry with the same name overrides the built-in.

## Divergences from Go

The engine matches Go's `text/template` semantics aggressively. The remaining divergences are host-imposed — JavaScript cannot represent the relevant Go type, or the standard libraries differ:

- **Numeric typing.** Go has `int`, `float64`, and friends as distinct runtime types; JavaScript has one `number`. `printf` verbs that diagnose type mismatches (`%!d(float64=42)`) cannot be replicated without a separate type-tracking scheme on the JS side, so JS renders the value plainly per the verb.
- **Regex semantics.** `sprigRegex()` uses ECMAScript regex, not Go's RE2. Lookbehind syntax, Unicode property escapes, and certain catastrophic-backtracking patterns differ.
- **String length.** Go strings are UTF-8 byte sequences; `len("é")` is `2` in Go. JS strings are UTF-16 code units; `len("é")` is `1` here. Choose grapheme libraries on the JS side if you need byte/grapheme counts.
- **Field access.** Walks JS objects, Maps, and arrays using JS property semantics, not Go reflection. Named-field access on an array is a `MissingFieldError` (no `length` / `[N]` magic — use the `index` and `len` built-ins).
- **Type mismatches at function boundaries are runtime errors, not compile errors.** By design: the engine does not know your `T` shape statically, so it surfaces the architectural commitment when the bad flow happens. See `TypeMismatchError`.
- **printf verbs** beyond `%s %d %v %q %f %t %x` are rendered as `%!<verb>(<type>=<value>)`. If you need more, register your own formatter via the `funcs` registry.

Notable parity statements (places where users sometimes expect divergence and there isn't one):

- A nil/undefined pipeline emits the literal `<no value>` string, matching Go's `text/template`.
- Range over a Map / plain object iterates in **sorted-by-key order** in both engines (Go's `internal/fmtsort`; ours mirrors it).
- Sprig `set` and `unset` mutate the receiver and return it — same as Go sprig.
- `{{ "key" | get .dict }}` composes correctly: last-arg piping puts the key in the trailing slot, which is `get(d, key)`'s second parameter. The form `{{ .dict | get "key" }}` does *not* work in either engine — the dict ends up in the key slot.
- `eq` / `ne` compare arrays, Maps, Sets, and plain objects by **structural deep-equal**, matching Go's `text/template` semantics. Reference-identity comparison is not a divergence — it was a bug fixed in epic `template-laws-3gt`.
- Sprig dict ops (`get`, `keys`, `values`, `pluck`, `hasKey`, …) accept **plain objects only**, not `Map`. Pass `Object.fromEntries(map)` if you have a `Map` to feed in. Maps remain valid for field-access (`.get(key)`) and for `range`.

## Errors

All errors extend `TemplateError`:

```
TemplateError
├── ParseError
└── EvalError
    ├── FuncNotFoundError    (with did-you-mean suggestions)
    ├── TypeMismatchError    (no-silent-flatten violation)
    └── MissingFieldError    (named field path failure)
```

Every error carries `pos`, `source`, and a `kind` discriminator. `.toString()` produces a multi-line message with a 3-line source snippet and a caret pointing at the failing column.

## Versioning policy

- Semver.
- **Syntax stability is a hard guarantee** — Go template syntax is the source of truth; deviations are bugs.
- **Output type guarantee** — `engine.evaluate(scope)` returning `T[]` for the engine's `T` parameter is part of the contract.
- **Sprig surface may grow but never shrinks** — once a sprig function is registered in a release, subsequent releases keep it.
- **Built-in semantics may be tightened** — the no-silent-flatten guard may catch additional edge cases over time. Tests against an Engine with strict argTypes are the safe bet.

### Stable public API surface

The package exports exactly the following from `"go-template-js"` — anything else is internal and may change at any time:

- Engine: `createEngine`, `Engine`, `Template`, `EngineConfig`, `FuncMap`, `TemplateFunc`, `ArgType`.
- Errors: `TemplateError`, `ParseError`, `EvalError`, `FuncNotFoundError`, `TypeMismatchError`, `MissingFieldError`, `ErrorKind`.
- Sprig categories: `sprigDefaults`, `sprigStrings`, `sprigMath`, `sprigLists`, `sprigDicts`, `sprigRegex`, `sprigTypes`.

Reaching into `dist/` subpaths or `src/` deep imports is unsupported.

## Development

```bash
pnpm install
pnpm build      # tsdown → dist/
pnpm test       # vitest
pnpm lint       # biome check
pnpm typecheck  # tsc --noEmit
```

The roadmap and active work live in the project's `lit` issue tracker (run `lit ready` to see the queue).
