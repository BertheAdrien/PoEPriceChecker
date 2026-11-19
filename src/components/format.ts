export function fmt(n: number): string {
  const a = Math.abs(n);
  if (a >= 100) return String(Math.round(n));
  if (a >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

/** Montant en div : 1 décimale, sans « .0 » (3.04 → « 3 », 2.16 → « 2.2 »). */
export function fmtDiv(div: number): string {
  const r = Math.round(div * 10) / 10;
  return Number.isInteger(r) ? String(r + 0) : r.toFixed(1);
}

/** Montant signé pour l'affichage en deux lignes : en div à partir de 1 div (chaos en sous-texte). */
export function fmtSigned(chaos: number, divineChaos: number): { main: string; sub?: string } {
  const sign = chaos > 0 ? "+" : "";
  if (Math.abs(chaos) >= divineChaos) return { main: `${sign}${fmtDiv(chaos / divineChaos)} div`, sub: `${sign}${fmt(chaos)}c` };
  return { main: `${sign}${fmt(chaos)}c` };
}

/** Montant non signé (coûts, prix) : en div à partir de 1 div, chaos en sous-texte. */
export function fmtAmount(chaos: number, divineChaos: number): { main: string; sub?: string } {
  if (chaos >= divineChaos) return { main: `${fmtDiv(chaos / divineChaos)} div`, sub: `${fmt(chaos)}c` };
  return { main: `${fmt(chaos)}c` };
}

/** "+12.3c" puis "(+1.2d)" à partir de 1 div. */
export function fmtProfit(chaos: number, divineChaos: number): string {
  const sign = chaos >= 0 ? "+" : "";
  const div = Math.abs(chaos) >= divineChaos ? ` (${sign}${fmtDiv(chaos / divineChaos)}d)` : "";
  return `${sign}${fmt(chaos)}c${div}`;
}
