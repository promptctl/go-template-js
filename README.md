# @promptctl/go-template-js

Go template syntax + Sprig subset, generic over output type, in TypeScript.

[![npm](https://img.shields.io/npm/v/@promptctl/go-template-js.svg)](https://www.npmjs.com/package/@promptctl/go-template-js)
[![CI](https://github.com/promptctl/go-template-js/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/promptctl/go-template-js/actions/workflows/ci.yml)
[![Node](https://img.shields.io/node/v/@promptctl/go-template-js.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/npm/l/@promptctl/go-template-js.svg)](./LICENSE)

## Highlights

- **Same syntax as Go's `text/template`.** Templates that parse there parse here.
- **Generic over the output type `T`.** Render to strings, structured fragments, or anything else; the engine emits `T[]`.
- **No silent flattening.** Typed values never become strings without an explicit conversion — slots that should accept text declare so, and mismatches throw `TypeMismatchError`.
- **Pure ESM, side-effect-free, single runtime dep.** Tree-shakes cleanly; only [`@noble/hashes`](https://github.com/paulmillr/noble-hashes) at runtime (for `sprigHash()`).

## Table of contents

- [Highlights](#highlights)
- [Install](#install)
- [Quick start](#quick-start)
- [Custom output types](#custom-output-types)
- [`ArgType` reference](#argtype-reference)
- [Syntax and built-ins](#syntax-and-built-ins)
- [Sprig subset](#sprig-subset)
- [Composing funcs from multiple sources](#composing-funcs-from-multiple-sources)
- [Divergences from Go](#divergences-from-go)
- [Errors](#errors)
- [Versioning policy](#versioning-policy)
- [Development](#development)
- [License](#license)

## Install

```bash
pnpm add @promptctl/go-template-js
# or: npm install @promptctl/go-template-js
# or: yarn add @promptctl/go-template-js
```

Requires Node **≥ 20.19.0** (per `engines.node`). The package is ESM-only.

## Quick start

```ts
import { createEngine } from "@promptctl/go-template-js";

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

## Custom output types

The engine is parameterised over its output fragment type `T`. Consumers pick a fragment shape (e.g. styled text, AST nodes, layout primitives) and the engine emits a `T[]` that integrates into their downstream pipeline:

```ts
import { createEngine, type TemplateFunc } from "@promptctl/go-template-js";

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

### Lifting and stringification: the boundary bridges

`fromString` and `toString` are the engine's two boundary bridges between text and `T`. Each one has an `ArgType` that uses it:

| Direction | Bridge | ArgType | Where it runs |
| --- | --- | --- | --- |
| `string` → `T` | `fromString` (required) | `"liftable"` | a string at a `"liftable"` slot is replaced with `fromString(s)` before the body sees it |
| `T` → `string` | `toString` (optional) | `"stringifiable"` | a non-string at a `"stringifiable"` slot is flattened via `toString` (e.g. `print`, `printf "%s"`) |

```ts
const engine = createEngine<Frag>({
  fromString: (s) => ({ color: "default", text: s }),
  toString: (frag) => frag.text,
});
```

`fromString` is mandatory in `EngineConfig`: every engine knows how to lift, so `"liftable"` is always servable. `toString` is optional: without it, typed-`T` values reaching a `"stringifiable"` slot throw `TypeMismatchError` directing you to configure it. The default `toString` passes strings through unchanged and flattens numeric/boolean/nil primitives, so `T = string` engines work out of the box.

Use `"liftable"` for any consumer-defined function whose slot should accept either a `T` value or a string literal. The body, by contract, only ever receives `T` — the gate owns the lift, so the body has no string-vs-`T` discrimination to do.

## `ArgType` reference

Every entry in `argTypes` is one of:

| Kind | Accepts at runtime | Used by (examples) |
| --- | --- | --- |
| `"string"` | JS `string` | `upper`, `lower`, `trim`, `printf` format string |
| `"int"` | finite `number` or safe-integer-range `bigint`; gate normalizes to `number` via `Math.trunc(Number(v))` so the body sees `number` | `add`, `sub`, `mul`, `mod`, `max`, `min`, `slice` indices, `chunk`, `splitn`, `repeat` |
| `"float"` | any `number` (including `NaN`/`±Infinity` — legitimate IEEE-754 floats) or `bigint` whose `Number()` is finite; gate normalizes to `number` via `Number(v)` | `addf`, `subf`, `mulf`, `divf`, `maxf`, `minf` |
| `"bool"` | `typeof === "boolean"` | (rare; most boolean slots use `"truthy"`) |
| `"T"` | Any non-primitive (consumer-defined fragment) | consumer-defined typed funcs returning `T` |
| `"ordered"` | `string`, `number`, `bigint`, or `boolean` | `lt`, `le`, `gt`, `ge` — additionally requires both slots share a kind |
| `"comparable"` | `"ordered"` ∪ nil ∪ arrays / Maps / Sets / plain objects (deep-equal) | `eq`, `ne` |
| `"list"` | `Array.isArray` | `first`, `last`, `rest`, `uniq`, `concat`, `chunk` |
| `"dict"` | plain object only (not `Map`, not class instance) | `get`, `keys`, `values`, `pluck`, `merge` |
| `"sized"` | `string` ∪ array ∪ `Map` ∪ `Set` ∪ plain object | `len` |
| `"stringifiable"` | `string`, or any value the engine's `toString` can flatten | `print`, `println`, `printf "%s"`, `printf "%q"` |
| `"liftable"` | `T`, or `string` (lifted to `T` via the engine's `fromString` before the body runs) | consumer-defined funcs that accept either a `T` fragment or a bare text literal at a slot |
| `"callable"` | `typeof === "function"` | `call` (first slot) |
| `"collection"` | `string` ∪ array ∪ `Map` ∪ plain object | `index` (receiver slot) |
| `"index-key"` | `string`, `number`, or `bigint` | `index` (key slots) |
| `"sliceable"` | `string` or array | `slice` (receiver slot) |
| `"truthy"` | anything (truthiness context) | `not`, `and`, `or`, `default`, `empty`, `coalesce`, `ternary` |
| `"reflective"` | anything (type-inspection context) | `kindOf`, `typeOf`, `kindIs`, `typeIs`, `typeIsLike` |
| `"serializable"` | anything `JSON.stringify`-encodable (rejects functions, symbols, `bigint`) | `toJson`, `toPrettyJson` |
| `"value"` | anything (genuinely heterogeneous, by intent) | `list` constructor, `deepEqual`, `deepCopy`, `prepend` / `append` items |

The legacy `"any"` kind was removed in epic `template-laws-3gt`. Slots that genuinely accept anything now declare their *intent* (`"truthy"` / `"reflective"` / `"value"` / `"serializable"`); slots that did not are pinned to their precise kind so the gate enforces the constraint instead of leaking it into func bodies.

### Variadic patterns

For variadic funcs, declare the trailing slot's type once — every excess argument is validated against it.

For funcs whose variadic tail *cycles* (e.g. `dict "k1" v1 "k2" v2 …`), set `argTypePattern: "alternating"` on the registration. The slot for arg index `i` becomes `argTypes[i % argTypes.length]`, so `dict` declares `argTypes: ["string", "value"]` and the gate enforces "string at even index, anything at odd index" without per-key revalidation in the body.

## Syntax and built-ins

Template syntax is Go template syntax. Read the canonical spec:
https://pkg.go.dev/text/template

Supported:

- All actions: `{{ pipeline }}`, `{{- ... -}}` trim markers, `{{/* comments */}}`.
- All control flow: `if/else if/else/end`, `range/else/end` (with index/value forms `range $i, $v := …`), `with/else/end`.
- Range-body control: `{{break}}` exits the innermost `{{range}}`; `{{continue}}` skips to its next iteration. Both are parse errors outside a lexically-enclosing `{{range}}` (including inside a `{{define}}` or `{{block}}` body, even if those are nested in a range — sub-template bodies are independent parse contexts, matching Go's `text/template`).
- All sub-template forms: `define`, `template`, `block`.
- Variable assignment: `$x := pipe` and `$x = pipe`.
- All literals: strings (interpreted + raw backtick), runes, integers (decimal/hex/octal/binary), floats (with exponents and hex-float `p` exponents), booleans, `nil`.
- Field access on JS objects (own + prototype properties), `Map` (via `.get`), arrays (numeric `index` builtin).
- Pipelines with last-arg piping: `x | f a b` ≡ `f a b x`.

### Built-in functions

All of Go template's runtime built-ins:

`and` `or` `not` · `eq` `ne` `lt` `le` `gt` `ge` · `len` `index` `slice` · `print` `println` `printf` · `call` · `html` · `js` · `urlquery`

`and`/`or` short-circuit (the engine passes thunks for those). `printf` supports `%s`, `%d`, `%v`, `%q`, `%f` (precision-aware), `%t`, `%x`, plus width and `-` left-align flags. `html` flattens its arguments like `print` (via the engine's `toString`) and then escapes the six HTML-significant characters (`\0` → `�`, `"` → `&#34;`, `'` → `&#39;`, `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`) — matching Go's `text/template.HTMLEscaper` byte-for-byte. `js` shares the same flatten pipeline and emits JavaScript-literal-safe output: `\` → `\\`, `'` → `\'`, `"` → `\"`, `<` → `\u003C`, `>` → `\u003E`, `&` → `\u0026`, `=` → `\u003D`, ASCII control chars (< 0x20) and non-printable runes (incl. U+2028/U+2029) → `\u%04X` uppercase — matching Go's `text/template.JSEscaper`. `urlquery` shares the same flatten pipeline and percent-encodes the UTF-8 byte stream per Go's `net/url.QueryEscape`: the unreserved set `[A-Za-z0-9-._~]` passes through, space becomes `+`, every other byte becomes `%XX` uppercase hex (so a literal `+` round-trips as `%2B`, and `α` encodes to `%CE%B1`).

## Sprig subset

Imported from `@promptctl/go-template-js` as category-scoped `FuncMap` factories:

| Category | Helper | Functions |
| --- | --- | --- |
| Defaults | `sprigDefaults()` | default, empty, coalesce, ternary, fromJson, toJson, toPrettyJson |
| Strings | `sprigStrings()` | trim, trimAll, trimPrefix, trimSuffix, upper, lower, title, untitle, repeat, substr, trunc, contains, hasPrefix, hasSuffix, replace, split, splitList, splitn, join, quote, squote, cat, indent, nindent, wrap, wrapWith, abbrev, abbrevboth, initials, nospace, snakecase, camelcase, kebabcase, swapcase, plural, regexQuoteMeta |
| Math | `sprigMath()` | add, sub, mul, div, mod, min, max, floor, ceil, round, addf, subf, mulf, divf, add1, add1f, maxf, minf, biggest, seq, until, untilStep |
| Lists | `sprigLists()` | list, first, last, rest, initial, len, reverse, uniq, without, has, compact, slice, concat, chunk, prepend, append, sortAlpha, push, tuple, dig, all, any |
| Dicts | `sprigDicts()` | dict, get, set, unset, keys, values, pluck, pick, omit, hasKey, merge, mergeOverwrite |
| Regex | `sprigRegex()` | regexMatch, regexFind, regexFindAll, regexReplaceAll, regexReplaceAllLiteral, regexSplit |
| Types | `sprigTypes()` | kindOf, kindIs, typeOf, typeIs, typeIsLike, deepEqual, deepCopy |
| Conversions | `sprigConversions()` | atoi, int, int64, float64, toString, toStrings, toDecimal, toRawJson |
| Semver | `sprigSemver()` | semver, semverCompare |
| Flow | `sprigFlow()` | fail |
| Random | `sprigRandom(random?)` | randInt, randAlpha, randAlphaNum, randNumeric, randAscii, shuffle |
| Hash / Encoding | `sprigHash()` | b64enc, b64dec, b32enc, b32dec, sha1sum, sha256sum, sha512sum, adler32sum, uuidv4 |
| Date / Time | `sprigDatetime(clock?)` | now, date, dateInZone, dateModify, htmlDate, htmlDateInZone, duration, durationRound, toDate, ago, unixEpoch |

**Runtime floor for `sprigHash()`:** This package requires Node ≥ 20.19.0 (per `engines.node`). `uuidv4` requires `globalThis.crypto.randomUUID`, guaranteed in that environment. SHA-* use [`@noble/hashes`](https://github.com/paulmillr/noble-hashes) — audited, zero-dep, sync, pure JS.

**`sprigDatetime(clock?)`:** All date/time functions accept Go's reference-time format strings (`Mon Jan 2 15:04:05 MST 2006`). Pass `clock: () => Date` to freeze "now" for deterministic templates. The `date` and `dateInZone` functions accept `Date`, number (Unix seconds), or string as the time value. Go template integer literals hit sprig's type-switch default branch (returning `"0s"` from `duration`) — prefer string literals or scope-injected values for portable templates.

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

- **Numeric typing.** Go has `int`, `float64`, and friends as distinct runtime types; JavaScript has one `number`. The numeric-verb type label reflects JS's view: integer JS numbers report as `int`, fractional as `float64`, `bigint` as `int64`. Non-numeric values into `%d`/`%f`/`%x` produce a Go-style `%!<verb>(<type>=<value>)` diagnostic — e.g. `printf "%d" "foo"` → `%!d(string=foo)`.
- **Regex semantics.** `sprigRegex()` uses ECMAScript regex, not Go's RE2. Lookbehind syntax, Unicode property escapes, and certain catastrophic-backtracking patterns differ.
- **String length.** Go strings are UTF-8 byte sequences; `len("é")` is `2` in Go. JS strings are UTF-16 code units; `len("é")` is `1` here. Choose grapheme libraries on the JS side if you need byte/grapheme counts.
- **Field access.** Walks JS objects, Maps, and arrays using JS property semantics, not Go reflection. Named-field access on an array is a missing field — silently `<no value>` under the default `missingKey: "default"` policy, or a `MissingFieldError` under `missingKey: "error"`. There is no `length` / `[N]` magic; use the `index` and `len` built-ins.
- **`missingkey=zero`.** Accepted as a config value (`missingKey: "zero"`) for API parity with Go's `Option("missingkey=zero")`, but JavaScript erases value-types at runtime — there is no `reflect.New(elemType).Elem()` analogue, so `"zero"` produces the same observable behavior as `"default"` (silent `<no value>`). To force a typed-zero substitute at the use site, use sprig: `{{ .missing | default "" }}`.
- **Type mismatches at function boundaries are runtime errors, not compile errors.** By design: the engine does not know your `T` shape statically, so it surfaces the architectural commitment when the bad flow happens. See `TypeMismatchError`.
- **printf verbs** beyond `%s %d %v %q %f %t %x` are rendered as `%!<verb>(<type>=<value>)`. If you need more, register your own formatter via the `funcs` registry.

### Notable parity statements

Places where users sometimes expect divergence and there isn't one:

- A nil/undefined pipeline emits the literal `<no value>` string, matching Go's `text/template`.
- **Missing field/map-key access** follows Go's `Option("missingkey=...")`. Defaults to `"default"` (silent `<no value>`); set `missingKey: "error"` in `EngineConfig` to throw `MissingFieldError` instead. The `"zero"` value is accepted; see the divergence note above.
- **Custom delimiters** are supported via `EngineConfig.delims`, mirroring Go's `Template.Delims(left, right)`. Pass `{ left: "<%", right: "%>" }` to make the engine recognise `<% ... %>` actions instead of `{{ ... }}`. Trim markers follow Go: with `<%`/`%>` they become `<%-` and `-%>`. Both sides are required if you set the field — neither may be empty. Default `{{` / `}}` are used when the field is omitted.
- Range over a Map / plain object iterates in **sorted-by-key order** in both engines (Go's `internal/fmtsort`; ours mirrors it).
- Sprig `set` and `unset` mutate the receiver and return it — same as Go sprig.
- `{{ "key" | get .dict }}` composes correctly: last-arg piping puts the key in the trailing slot, which is `get(d, key)`'s second parameter. The form `{{ .dict | get "key" }}` does *not* work in either engine — the dict ends up in the key slot.
- `eq` / `ne` compare arrays, Maps, Sets, and plain objects by **structural deep-equal**, matching Go's `text/template` semantics. Reference-identity comparison is not a divergence — it was a bug fixed in epic `template-laws-3gt`.
- Sprig dict ops (`get`, `keys`, `values`, `pluck`, `hasKey`, …) accept **plain objects only**, not `Map`. Pass `Object.fromEntries(map)` if you have a `Map` to feed in. Maps remain valid for field-access (`.get(key)`) and for `range`.
- `empty` on a non-empty object returns **false**, even when every value is the zero value of its type (e.g. `{tag: "", text: ""}`). Matches Go sprig: `text/template.isTrue` treats structs as always truthy, and sprig's `empty` follows by returning `false` for any non-empty map or struct. `reflect.IsZero` is *not* what Go sprig consults here. The conformance fixture `sprig-empty-object-parity` pins this behavior byte-for-byte.

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

The package exports exactly the following from `"@promptctl/go-template-js"` — anything else is internal and may change at any time:

- Engine: `createEngine`, `Engine`, `Template`, `EngineConfig`, `FuncMap`, `TemplateFunc`, `ArgType`, `MissingKeyOption`, `Delims`.
- Errors: `TemplateError`, `ParseError`, `EvalError`, `FuncNotFoundError`, `TypeMismatchError`, `MissingFieldError`, `FailError`, `ErrorKind`.
- Sprig categories: `sprigDefaults`, `sprigStrings`, `sprigMath`, `sprigLists`, `sprigDicts`, `sprigRegex`, `sprigTypes`, `sprigConversions`, `sprigSemver`, `sprigFlow`, `sprigRandom`, `sprigHash`, `sprigDatetime`.

Reaching into `dist/` subpaths or `src/` deep imports is unsupported.

## Development

```bash
pnpm install
pnpm build       # tsdown → dist/
pnpm test        # vitest
pnpm lint        # biome check
pnpm typecheck   # tsc --noEmit
```

Bug reports and feature requests go to [GitHub Issues](https://github.com/promptctl/go-template-js/issues). The roadmap and active work live in the project's `lit` issue tracker (run `lit ready` to see the queue).

## License

[MIT](./LICENSE) © Brandon Fryslie
