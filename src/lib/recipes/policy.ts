import type { CorruptedInputs, Recipe } from "./types";

/**
 * Les entrées corrompues sont-elles utilisables dans cette recette ?
 * - `vendor_recipe` : les objets sont vendus tels quels au PNJ -> "allowed" ;
 * - `other` (objet appliqué sur un autre, ex. Flesh of Xesht sur The Red Dream) : la currency ne
 *   s'utilise pas sur un objet corrompu -> "forbidden" ;
 * - div_card / fragment_set / vendor_shop : entrées de l'exchange, sans objet -> "forbidden" (prudent).
 * Un champ `corruptedInputs` explicite (YAML) l'emporte.
 */
export function corruptedInputPolicy(recipe: Pick<Recipe, "kind" | "corruptedInputs">): CorruptedInputs {
  if (recipe.corruptedInputs) return recipe.corruptedInputs;
  return recipe.kind === "vendor_recipe" ? "allowed" : "forbidden";
}
