/**
 * Combining sprig categories with project-specific funcs.
 *
 * Mirrors the rich-js + claude-powerline pattern: sprig provides the
 * generic helpers, the project layers domain-specific T-aware funcs
 * on top.
 */

import { createEngine, sprigDefaults, sprigStrings, type TemplateFunc } from "go-template-js";

const projectFuncs: Record<string, TemplateFunc> = {
  shout: {
    fn: (s: unknown) => `${String(s).toUpperCase()}!`,
    argTypes: ["string"],
  },
};

const engine = createEngine<string>({
  fromString: (s) => s,
  funcs: { ...sprigDefaults(), ...sprigStrings(), ...projectFuncs },
});

const tpl = engine.compile('{{ .name | default "anon" | upper | shout }}');

console.log(tpl({ name: "" }).join("")); // "ANON!"
console.log(tpl({ name: "go" }).join("")); // "GO!"
