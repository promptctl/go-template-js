# Conformance fixtures

Each subdirectory is one fixture: `template.tmpl` + optional `scope.json` +
generated `expected.txt`.

## Naming convention

`<category>-<short-description>/` where category is one of:

- `controlflow` — if / range / with / define / template / block constructs
- `builtin` — Go template runtime built-ins (eq/lt/and/len/index/slice/printf/call/...)
- `sprig` — Sprig-subset functions (one per category, plus highlights)
- `edge` — whitespace trim, comments, deeply nested, etc.

## Adding a fixture

1. Create the subdir with `template.tmpl`.
2. Add `scope.json` if the template needs scope (omit for nil-scope templates).
3. Run `pnpm conformance:regen` to generate `expected.txt`.
4. Add a corresponding TS test under `test/conformance/` that asserts the
   engine produces matching output.

## Avoid

Patterns that won't byte-match Go:

- Regex with lookbehind or Unicode property escapes.
- Float formatting at extreme precision.
- Bare `range` over a map (Go's map iteration is randomized; JS object
  iteration is insertion-ordered). Sort the keys first if you need it.
