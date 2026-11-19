import type { RecipeKind } from "../recipes/types";

export type OpportunityKind = RecipeKind | "vendor_chain";
export type SkipReason = "missing_price" | "illiquid";

export interface PricedItem {
  item: string;
  qty: number;
  unitChaos: number;
  liquidity: number;
  liquidityKind: "volumeChaos" | "listings";
  /** Entrée : prix unitaire d'achat max pour que le profit reste >= 0 (autres prix fixes). */
  maxBuyChaos?: number;
  /** Sortie : prix unitaire de vente min pour que le profit reste >= 0 (autres prix fixes). */
  minSellChaos?: number;
}

export interface ChainStep {
  recipeId: string;
  from: string;
  to: string;
  /** Quantité donnée / reçue à cette étape pour le lot évalué. */
  qtyIn: number;
  qtyOut: number;
  vendor?: string;
}

export interface Opportunity {
  id: string;
  kind: OpportunityKind;
  label: string;
  inputs: PricedItem[];
  outputs: PricedItem[];
  costChaos: number;
  /** Revenu après marge de sécurité. */
  revenueChaos: number;
  profitChaos: number;
  profitDivine: number;
  marginPct: number;
  liquidity: { minVolumeChaos?: number; minListings?: number };
  /** Variation 7 j du premier item vendu, si connue. */
  trendPct?: number;
  steps?: ChainStep[];
  conditional: boolean;
  /** Au moins une recette source non vérifiée (verified: false). */
  unverified: boolean;
  sources: string[];
}

export type EvalResult =
  | { ok: true; opportunity: Opportunity }
  | { ok: false; reason: SkipReason; item: string };

export interface FindResult {
  opportunities: Opportunity[];
  skipped: Record<SkipReason, number>;
  /** Paires départ→arrivée de chaînes sans chemin évaluable. */
  chainSkipped: Record<SkipReason, number>;
  evaluated: number;
}
