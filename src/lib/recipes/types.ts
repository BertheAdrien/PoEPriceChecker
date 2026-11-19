export type RecipeKind = "vendor_shop" | "vendor_recipe" | "div_card" | "fragment_set" | "other";

/** Les entrées corrompues sont-elles acceptables ? (cf. `corruptedInputPolicy`) */
export type CorruptedInputs = "allowed" | "forbidden";

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
  /** Surcharge de la politique par défaut (dérivée du kind) sur les entrées corrompues. */
  corruptedInputs?: CorruptedInputs;
  notes?: string;
}
