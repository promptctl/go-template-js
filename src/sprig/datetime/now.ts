import type { Clock } from "./_clock.js";

/** `now` — current instant. Routed through the clock seam. */
export function now(clock: Clock): Date {
  return clock();
}
