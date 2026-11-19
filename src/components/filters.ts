import { planBudget, type BudgetPlan } from "@/lib/engine/budget";
import type { Opportunity } from "@/lib/engine/types";

export interface Filters {
  kind: string;
  showConditional: boolean;
  minMarginPct: number;
  /** Profit total réalisable (runs × profit/run) minimum, en chaos. */
  minTotalProfit: number;
  /** Volume échangé min (chaos) des entrées/sorties de l'exchange. */
  minVolumeChaos: number;
  /** Nombre d'annonces min des items du stash. */
  minListings: number;
  /** undefined = pas de budget : runs plafonnés par la seule liquidité. */
  budgetChaos?: number;
}

/** Parse un champ numérique saisi (virgule acceptée) ; vide ou invalide → 0. */
export function num(s: string): number {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Plan d'une opportunité : runs = min(budget / coût, plafond de liquidité), ou le seul plafond de
 * liquidité sans budget. Profit total = runs × profit/run.
 */
export function planFor(o: Opportunity, budgetChaos: number | undefined): BudgetPlan {
  return planBudget(o, budgetChaos ?? Infinity);
}

/** Filtres indépendants des prix (type, conditionnelles, liquidité) : ne changent pas après vérification. */
export function passesStatic(o: Opportunity, f: Filters): boolean {
  if (!f.showConditional && o.conditional) return false;
  if (f.kind !== "all" && o.kind !== f.kind) return false;
  const l = o.liquidity;
  if (l.minVolumeChaos !== undefined && l.minVolumeChaos < f.minVolumeChaos) return false;
  if (l.minListings !== undefined && l.minListings < f.minListings) return false;
  return true;
}

/** Filtres de prix, appliqués à l'opportunité effective (prix trade vérifiés si disponibles). */
export function passesPrice(eff: Opportunity, plan: BudgetPlan, f: Filters): boolean {
  if (!plan.affordable) return false;
  if (eff.marginPct < f.minMarginPct) return false;
  return plan.totalProfitChaos >= f.minTotalProfit;
}
