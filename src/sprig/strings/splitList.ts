import { goSplit } from "./runes.js";

export function splitList(sep: string, s: string): string[] {
  return goSplit(sep, s);
}
