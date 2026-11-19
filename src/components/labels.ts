import type { OpportunityKind } from "@/lib/engine/types";

export const KIND_LABELS: Record<OpportunityKind, string> = {
  vendor_shop: "Boutique PNJ",
  vendor_recipe: "Recette vendeur",
  div_card: "Carte de divination",
  fragment_set: "Fragments",
  vendor_chain: "Chaîne PNJ",
  other: "Autre",
};

/** Page d'une opportunité ; `runs` = quantités du mode budget (absent → 1 run). */
export function opportunityHref(id: string, runs?: number): string {
  const q = new URLSearchParams({ id });
  if (runs !== undefined) q.set("runs", String(runs));
  return `/opportunite?${q}`;
}
