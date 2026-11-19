import type { OpportunityKind } from "@/lib/engine/types";

/** Types d'opportunité, en anglais (vocabulaire des joueurs de PoE). */
export const KIND_LABELS: Record<OpportunityKind, string> = {
  vendor_shop: "Vendor Trade",
  vendor_recipe: "Vendor Recipe",
  div_card: "Divination Cards",
  fragment_set: "Fragments",
  vendor_chain: "Vendor Chain",
  other: "Other",
};

/** Libellés des filtres de type : types du moteur + groupes propres à l'UI (cf. `filterKind`). */
export const FILTER_KIND_LABELS: Record<string, string> = {
  ...KIND_LABELS,
  essence_oil: "Essences & Oils",
};

/** Page d'une opportunité ; `runs` = quantités du mode budget (absent → 1 run). */
export function opportunityHref(id: string, runs?: number): string {
  const q = new URLSearchParams({ id });
  if (runs !== undefined) q.set("runs", String(runs));
  return `/opportunite?${q}`;
}
