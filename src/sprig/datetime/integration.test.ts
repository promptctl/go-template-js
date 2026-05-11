import { describe, expect, it } from "vitest";
import { createEngine } from "../../evaluator/evaluator.js";
import { sprigDatetime } from "./index.js";

// Frozen at 2006-01-02T15:04:05Z (UTC). This is the Go reference time
// expressed in UTC rather than MST — ensures tz-independent tests.
const FROZEN = new Date("2006-01-02T15:04:05Z");
const CLOCK = () => FROZEN;
// Unix seconds for FROZEN (UTC). Feeding this to dateInZone "UTC" should
// produce 2006-01-02T15:04:05Z, not the MST-offset version.
const FROZEN_UNIX = Math.floor(FROZEN.getTime() / 1000);

const render = (src: string, scope: unknown = null): string =>
  createEngine<string>({ fromString: (s) => s, funcs: sprigDatetime(CLOCK) })
    .parse(src)
    .evaluate(scope)
    .join("");

describe("sprig datetime — integration", () => {
  it("now returns frozen date formatted via dateInZone (subexpression form)", () => {
    // In Go templates, dateInZone(fmt, t, zone) — t is 2nd arg, not pipe-able
    // to the last slot without extra args. Use parenthesised call.
    expect(render('{{ dateInZone "2006-01-02" (now) "UTC" }}')).toBe("2006-01-02");
  });

  it("date formats in host tz (smoke test via toDate in UTC)", () => {
    // toDate produces a UTC-epoch Date; date then formats in local tz.
    // We only assert it's a 10-char YYYY-MM-DD string (tz-independent check).
    const result = render('{{ toDate "2006-01-02" "2024-03-15" | date "2006-01-02" }}');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("dateInZone with frozen unix number in UTC", () => {
    expect(render(`{{ dateInZone "2006-01-02T15:04:05Z07:00" ${FROZEN_UNIX} "UTC" }}`)).toBe(
      "2006-01-02T15:04:05Z",
    );
  });

  it("toDate | dateInZone round-trip via scope", () => {
    // Parse then format in UTC; use scope to inject the date.
    const scope = { ts: FROZEN_UNIX };
    expect(render('{{ dateInZone "2006-01-02" .ts "UTC" }}', scope)).toBe("2006-01-02");
  });

  it("toDate + dateInZone with subexpression", () => {
    expect(render('{{ dateInZone "2006-01-02" (toDate "2006-01-02" "2024-03-15") "UTC" }}')).toBe(
      "2024-03-15",
    );
  });

  it("htmlDateInZone via subexpression", () => {
    expect(render('{{ htmlDateInZone (toDate "2006-01-02" "2024-03-15") "UTC" }}')).toBe(
      "2024-03-15",
    );
  });

  it("dateModify adds 1h", () => {
    expect(render(`{{ dateInZone "15:04:05" (dateModify "1h" ${FROZEN_UNIX}) "UTC" }}`)).toBe(
      "16:04:05",
    );
  });

  it("unixEpoch round-trips frozen timestamp", () => {
    expect(render(`{{ unixEpoch ${FROZEN_UNIX} }}`)).toBe(String(FROZEN_UNIX));
  });

  it("duration '3600' → '1h0m0s'", () => {
    expect(render('{{ duration "3600" }}')).toBe("1h0m0s");
  });

  it("durationRound '1h30m' → '1h' (truncate to largest unit)", () => {
    expect(render('{{ durationRound "1h30m" }}')).toBe("1h");
  });

  it("ago with frozen clock (5s behind)", () => {
    const past = new Date(FROZEN.getTime() - 5000);
    const scope = { ts: past.getTime() / 1000 };
    expect(render("{{ ago .ts }}", scope)).toBe("5s");
  });

  it("ago zero → '0s'", () => {
    const scope = { ts: FROZEN.getTime() / 1000 };
    expect(render("{{ ago .ts }}", scope)).toBe("0s");
  });

  it("toDate parses RFC3339 and formats back", () => {
    expect(
      render(
        '{{ dateInZone "2006-01-02T15:04:05Z07:00" (toDate "2006-01-02T15:04:05Z07:00" "2024-06-01T10:00:00Z") "UTC" }}',
      ),
    ).toBe("2024-06-01T10:00:00Z");
  });
});
