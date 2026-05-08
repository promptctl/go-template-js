/**
 * Internal helper — Go's `strconv.ParseInt(s, 0, 64)` auto-detect rule.
 *
 * `0x`/`0X` → hex, `0b`/`0B` → binary, `0o`/`0O` → octal,
 * leading `0` → octal, otherwise decimal.
 *
 * Returns the parsed integer string-keyed (so callers can decide
 * `Number` vs `BigInt`), or `null` for unparseable input. Empty
 * string and lone `+`/`-` are unparseable.
 */
// [LAW:one-source-of-truth] The base-detect rule lives in one place.
// `int` and `int64` both route through here so their string-parse
// behavior cannot drift from each other or from Go.
export function parseBase0(
  s: string,
): { sign: 1 | -1; digits: string; base: 2 | 8 | 10 | 16 } | null {
  if (s === "") return null;
  let sign: 1 | -1 = 1;
  let body = s;
  if (body[0] === "+") body = body.slice(1);
  else if (body[0] === "-") {
    sign = -1;
    body = body.slice(1);
  }
  if (body === "") return null;

  if (/^0x[0-9a-fA-F]+$/i.test(body)) return { sign, digits: body.slice(2), base: 16 };
  if (/^0b[01]+$/i.test(body)) return { sign, digits: body.slice(2), base: 2 };
  if (/^0o[0-7]+$/i.test(body)) return { sign, digits: body.slice(2), base: 8 };
  if (body === "0") return { sign, digits: "0", base: 10 };
  if (body[0] === "0") {
    // Leading 0 + more chars → octal mode. Out-of-range digit fails;
    // we mirror Go (which errors) by returning null instead of
    // silently falling back to decimal.
    if (!/^0[0-7]+$/.test(body)) return null;
    return { sign, digits: body.slice(1), base: 8 };
  }
  if (!/^[0-9]+$/.test(body)) return null;
  return { sign, digits: body, base: 10 };
}
