/**
 * Minimal string-mode usage.
 *
 * Run with `tsx examples/string-output/example.ts` (or via your
 * preferred TS runner) once go-template-js is installed.
 */

import { createEngine } from "go-template-js";

const engine = createEngine<string>({ fromString: (s) => s });

const greet = engine.compile("Hello, {{ .name }}! You have {{ .count }} messages.");

console.log(greet({ name: "Ada", count: 7 }).join(""));
// → "Hello, Ada! You have 7 messages."
