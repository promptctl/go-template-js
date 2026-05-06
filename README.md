# go-template-js

Go template syntax + sprig subset, generic over output type, in TypeScript.

## What this is

A pure-TypeScript implementation of Go's [`text/template`](https://pkg.go.dev/text/template) syntax with a curated [sprig](https://masterminds.github.io/sprig/) function subset. Templates parse exactly as Go's parser accepts them, and the AST mirrors `text/template/parse` so a Go reimplementation can share the shape.

The engine is generic over its output type — render to strings, structured objects, or anything else a consumer needs.

## Status

Pre-alpha. Public API is not yet stable.

## Install

```bash
pnpm add go-template-js
```

## Usage

```ts
import { createEngine } from "go-template-js";

const engine = createEngine();
// Real rendering API arrives in subsequent releases.
```

## Development

```bash
pnpm install
pnpm build      # compile via tsdown to dist/
pnpm test       # vitest
pnpm lint       # biome check
pnpm typecheck  # tsc --noEmit
```
