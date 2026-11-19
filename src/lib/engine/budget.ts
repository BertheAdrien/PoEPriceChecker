import { MAX_VOLUME_SHARE } from "./config";
import type { Opportunity } from "./types";

/**
 * Nombre max de runs réalisables compte tenu de la liquidité des ENTRÉES.
 *
 * Pour chaque entrée (qty par run) :
 *  - exchange (liquidityKind "volumeChaos") : on n'achète pas plus de MAX_VOLUME_SHARE (10 %) du
 *    volume échangé en chaos → unités max = share × volume / prix unitaire ;
 *  - stash (liquidityKind "listings") : unités max = nombre d'annonces.
 * Runs pour l'entrée = floor(unités max / qty) ; le plafond global est le minimum sur les entrées.
 * Les sorties ne sont pas plafonnées (hypothèse : revente étalée).
 */
export function liquidityRunCap(o: Pick<Opportunity, "inputs">, share = MAX_VOLUME_SHARE): number {
  let cap = Infinity;
  for (const i of o.inputs) {
    if (i.qty <= 0) continue;
    const units =
      i.liquidityKind === "volumeChaos"
        ? i.unitChaos > 0
          ? (share * i.liquidity) / i.unitChaos
          : Infinity
        : i.liquidity;
    cap = Math.min(cap, Math.floor(units / i.qty));
  }
  return Number.isFinite(cap) ? Math.max(0, cap) : 0;
}

export interface BudgetPlan {
  affordable: boolean;
  runs: number;
  totalProfitChaos: number;
}

/** runs = min(floor(budget / coût), plafond de liquidité) ; profit total = runs × profit. */
export function planBudget(
  o: Pick<Opportunity, "inputs" | "costChaos" | "profitChaos">,
  budgetChaos: number,
  share = MAX_VOLUME_SHARE,
): BudgetPlan {
  if (!(o.costChaos > 0) || o.costChaos > budgetChaos) {
    return { affordable: false, runs: 0, totalProfitChaos: 0 };
  }
  const runs = Math.min(Math.floor(budgetChaos / o.costChaos), liquidityRunCap(o, share));
  return { affordable: true, runs, totalProfitChaos: runs * o.profitChaos };
}
