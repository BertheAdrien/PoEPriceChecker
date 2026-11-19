export function fmt(n: number): string {
  const a = Math.abs(n);
  if (a >= 100) return String(Math.round(n));
  if (a >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

/** Montant signé pour l'affichage en deux lignes : en div à partir de 1 div (chaos en sous-texte). */
export function fmtSigned(chaos: number, divineChaos: number): { main: string; sub?: string } {
  const sign = chaos > 0 ? "+" : "";
  if (Math.abs(chaos) >= divineChaos) return { main: `${sign}${fmt(chaos / divineChaos)} div`, sub: `${sign}${fmt(chaos)}c` };
  return { main: `${sign}${fmt(chaos)}c` };
}

/** "+12.3c" puis "(+1.2d)" à partir de 1 div. */
export function fmtProfit(chaos: number, divineChaos: number): string {
  const sign = chaos >= 0 ? "+" : "";
  const div = Math.abs(chaos) >= divineChaos ? ` (${sign}${fmt(chaos / divineChaos)}d)` : "";
  return `${sign}${fmt(chaos)}c${div}`;
}
