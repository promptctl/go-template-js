# Conformance corpus

Tests that the TypeScript engine matches Go's `text/template` (with
Masterminds/sprig) output byte-for-byte on a curated corpus of templates.

## Layout

```
conformance/
├── README.md                    (this file)
├── gen/                         Go reference generator
│   ├── go.mod
│   └── main.go
└── fixtures/
    └── <name>/
        ├── template.tmpl        Source template
        ├── scope.json           JSON-encoded scope value (optional; defaults to null)
        └── expected.txt         Reference output (regenerated, do not edit by hand)
```

## Adding a fixture

1. Create `fixtures/<descriptive-name>/template.tmpl` with the template source.
2. If the template needs a scope, add `fixtures/<name>/scope.json` containing
   the scope value as JSON.
3. Run `pnpm conformance:regen` to populate `expected.txt` from Go's reference
   implementation.
4. Add a TS test under `test/conformance/` that asserts the engine's output
   matches `expected.txt`.

## Regenerating reference outputs

```bash
pnpm conformance:regen
```

This shells to `cd conformance/gen && go run .`. Requires Go ≥ 1.21
installed. The generator is idempotent — regenerating with no fixture
changes produces no diffs.

## Notes on divergences

A few categories of templates *will not* match Go's reference output
even when correct:

- **Regex patterns** that use lookbehind or Unicode property escapes
  differently between RE2 and ECMAScript regex. Use only patterns
  that work the same in both.
- **Floating-point formatting** at extreme precision may differ
  between Go's `strconv.FormatFloat` and JavaScript's `toString`.
  Stick to common cases.
- **Map iteration order** — Go's map iteration is randomized; JS
  object key iteration is insertion-ordered. Avoid bare `range`
  over a map in conformance fixtures, or sort the keys explicitly.
