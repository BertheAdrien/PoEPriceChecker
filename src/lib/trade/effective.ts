import type { Opportunity } from "../engine/types";

/** Opportunité effective : la version vérifiée sur le trade si disponible, sinon poe.ninja. */
export function effectiveOpportunity(o: Opportunity, verified?: Opportunity): Opportunity {
  return verified ?? o;
}

/** Vérifié et sensiblement inférieur à la marge poe.ninja (< 1/3). */
export function isOverestimated(o: Opportunity, verified?: Opportunity): boolean {
  return !!verified && verified.profitChaos > 0 && verified.marginPct < o.marginPct / 3;
}
