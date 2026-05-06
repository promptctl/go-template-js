/**
 * `kindOf v` — JS-flavoured equivalent of Go's `reflect.Kind`.
 *
 * Go: int / float64 / string / bool / slice / map / struct / ptr / …
 * JS: number / string / boolean / array / map / object / null / undefined / function / bigint / symbol
 *
 * We return the JS-native kind. Consumers porting templates from Go
 * sprig should test against the JS-native names.
 */
export function kindOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value instanceof Map) return "map";
  if (value instanceof Set) return "set";
  return typeof value;
}
