export type RecipeKind = "vendor_shop" | "vendor_recipe" | "div_card" | "fragment_set" | "other";

export interface RecipeItem {
  item: string;
  qty: number;
}

export interface Recipe {
  id: string;
  kind: RecipeKind;
  inputs: RecipeItem[];
  outputs: RecipeItem[];
  vendor?: string;
  source: string;
  /** "<date> (source)" si vérifié, false sinon. */
  verified: string | false;
  /** Sortie dépendant d'un variant / corruption / liens / niveau / qualité / aléatoire. */
  conditional?: boolean;
  notes?: string;
}
