export function fmt(n: number): string {
  const a = Math.abs(n);
  if (a >= 100) return String(Math.round(n));
  if (a >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

/** "+12.3c" puis "(+1.2d)" à partir de 1 div. */
export function fmtProfit(chaos: number, divineChaos: number): string {
  const sign = chaos >= 0 ? "+" : "";
  const div = Math.abs(chaos) >= divineChaos ? ` (${sign}${fmt(chaos / divineChaos)}d)` : "";
  return `${sign}${fmt(chaos)}c${div}`;
}
