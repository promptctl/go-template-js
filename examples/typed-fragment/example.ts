/**
 * Generic-T usage. The engine emits a stream of typed fragments
 * instead of a string. This is the shape rich-js / claude-powerline
 * use to integrate with their downstream rendering pipeline.
 */

import { createEngine, type TemplateFunc } from "go-template-js";

interface Frag {
  readonly color: string;
  readonly text: string;
}

const colorFunc = (color: string): TemplateFunc => ({
  fn: (s: unknown) => ({ color, text: String(s) }),
  argTypes: ["string"],
  returnType: "T",
});

const engine = createEngine<Frag>({
  fromString: (s) => ({ color: "default", text: s }),
  funcs: {
    red: colorFunc("red"),
    green: colorFunc("green"),
    yellow: colorFunc("yellow"),
  },
});

const tpl = engine.parse(
  '{{ if eq .level "error" }}{{ red .msg }}{{ else if eq .level "warn" }}{{ yellow .msg }}{{ else }}{{ green .msg }}{{ end }}',
);

console.log(tpl.evaluate({ level: "warn", msg: "low disk" }));
// → [{ color: "yellow", text: "low disk" }]
