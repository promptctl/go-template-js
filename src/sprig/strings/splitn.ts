/**
 * `splitn sep n s` — split `s` on `sep` into at most `n` parts and
 * return a `{_0, _1, …}` map. Mirrors Go sprig:
 *
 *     parts := strings.SplitN(orig, sep, n)
 *     for i, v := range parts {
 *         res["_" + strconv.Itoa(i)] = v
 *     }
 *
 * The `{_0, _1}` shape (rather than a list) is idiosyncratic to Go
 * sprig. Preserve it byte-for-byte — consumers index into the result
 * by name, e.g. `(splitn ":" 2 "a:b:c")._1` → `"b:c"`.
 *
 * `strings.SplitN` semantics that JS `String.split(sep, n)` does *not*
 * match: when there are more parts than `n`, the last slot holds the
 * **unsplit remainder**, not a truncated prefix. JS `split` would
 * drop "b:c" entirely; Go keeps it. The body re-joins the tail
 * explicitly to recover the Go behavior.
 */

// [LAW:single-enforcer] Slot kinds (`["string", "int", "string"]`)
// validate and normalize the inputs at the dispatch gate — `n` arrives
// as an integer-valued `number`. Safe-integer bigints (|n| ≤ 2^53)
// are accepted and normalized via `Math.trunc(Number(v))`; bigints
// outside that range, NaN, and ±Infinity are rejected at the gate.
// The body owns the SplitN→map shape transform.
export function splitn(sep: string, n: number, s: string): Record<string, string> {
  const parts = goSplitN(s, sep, n);
  const res: Record<string, string> = {};
  for (let i = 0; i < parts.length; i++) {
    res[`_${i}`] = parts[i] ?? "";
  }
  return res;
}

// Go's strings.SplitN(s, sep, n):
//   n > 0  → at most n substrings; last is unsplit remainder
//   n == 0 → empty list
//   n < 0  → all substrings (== Split)
// Empty `sep` splits after each rune; for ASCII inputs the JS code-
// unit split matches.
function goSplitN(s: string, sep: string, n: number): string[] {
  if (n === 0) return [];
  const all = sep === "" ? Array.from(s) : s.split(sep);
  if (n < 0 || all.length <= n) return all;
  const head = all.slice(0, n - 1);
  const tail = all.slice(n - 1).join(sep);
  return [...head, tail];
}
