import { planBudget, type BudgetPlan } from "@/lib/engine/budget";
import type { Opportunity } from "@/lib/engine/types";
import { FILTER_KIND_LABELS } from "./labels";

export interface Filters {
  kind: string;
  showConditional: boolean;
  minMarginPct: number;
  /** Profit par run minimum, en chaos (colonne « Profit »). */
  minProfit: number;
  /** undefined = pas de budget. */
  budgetChaos?: number;
  /** Mots-clés (tous requis), cherchés dans les noms d'items et le type ; vide = pas de filtre. */
  search?: string;
}

const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Recherche par mots-clés : chaque mot (insensible à la casse et aux accents) doit apparaître dans
 * le libellé, un nom d'item (entrées, étapes, sorties) ou le type affiché de l'opportunité.
 */
export function matchesSearch(o: Opportunity, search: string | undefined, categories?: Record<string, string>): boolean {
  const words = normalize(search ?? "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalize(
    [
      o.label,
      ...(o.inputs ?? []).map((i) => i.item),
      ...(o.outputs ?? []).map((i) => i.item),
      ...(o.steps ?? []).map((s) => s.to),
      FILTER_KIND_LABELS[filterKind(o, categories)] ?? "",
      FILTER_KIND_LABELS[o.kind] ?? "",
    ].join(" "),
  );
  return words.every((w) => haystack.includes(w));
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
  return matchesSearch(o, f.search, categories);
}

/** Filtres de prix, appliqués à l'opportunité effective (prix trade vérifiés si disponibles). */
export function passesPrice(eff: Opportunity, plan: BudgetPlan, f: Filters): boolean {
  if (!plan.affordable) return false;
  if (eff.marginPct < f.minMarginPct) return false;
  return eff.profitChaos >= f.minProfit;
}
