import { planBudget, type BudgetPlan } from "@/lib/engine/budget";
import type { Opportunity } from "@/lib/engine/types";

export interface Filters {
  kind: string;
  showConditional: boolean;
  minMarginPct: number;
  /** Profit par run minimum, en chaos (colonne « Profit »). */
  minProfit: number;
  /** undefined = pas de budget. */
  budgetChaos?: number;
}

/** Parse un champ numérique saisi (virgule acceptée) ; vide ou invalide → 0. */
export function num(s: string): number {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Plan d'une opportunité : runs = min(budget / coût, plafond de liquidité), ou le seul plafond de
 * liquidité sans budget. Sert au masquage « trop cher » et aux quantités de la liste de courses.
 */
export function planFor(o: Opportunity, budgetChaos: number | undefined): BudgetPlan {
  return planBudget(o, budgetChaos ?? Infinity);
}

/** Groupe d'affichage propre à l'UI : essences et huiles sorties des recettes vendeur. */
export const ESSENCE_OIL = "essence_oil";
const ESSENCE_OIL_CATEGORIES = new Set(["Essence", "Oil"]);

/**
 * Type utilisé par le filtre : `essence_oil` si toutes les entrées et sorties sont des essences ou
 * des huiles (catégories poe.ninja), sinon le type de l'opportunité.
 */
export function filterKind(o: Opportunity, categories: Record<string, string> = {}): string {
  const items = [...(o.inputs ?? []), ...(o.outputs ?? [])];
  if (items.length > 0 && items.every((i) => ESSENCE_OIL_CATEGORIES.has(categories[i.item] ?? ""))) return ESSENCE_OIL;
  return o.kind;
}

/** Filtres indépendants des prix (type, conditionnelles) : ne changent pas après vérification. */
export function passesStatic(o: Opportunity, f: Filters, categories?: Record<string, string>): boolean {
  if (!f.showConditional && o.conditional) return false;
  if (f.kind !== "all" && filterKind(o, categories) !== f.kind) return false;
  return true;
}

/** Filtres de prix, appliqués à l'opportunité effective (prix trade vérifiés si disponibles). */
export function passesPrice(eff: Opportunity, plan: BudgetPlan, f: Filters): boolean {
  if (!plan.affordable) return false;
  if (eff.marginPct < f.minMarginPct) return false;
  return eff.profitChaos >= f.minProfit;
}
