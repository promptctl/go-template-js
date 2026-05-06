export function trimSuffix(suffix: unknown, s: unknown): string {
  const sf = String(suffix);
  const str = String(s);
  return str.endsWith(sf) ? str.slice(0, str.length - sf.length) : str;
}
