import type { CorruptedInputs, Recipe } from "./types";

/** Mention explicite du wiki dans les notes d'une recette (ex. The Retch : "Corrupted items cannot be used"). */
const FORBIDS_CORRUPTED = /corrupted items? (cannot|can't|can not) be used|must not be corrupted|non-corrupted|uncorrupted/i;

/**
 * Les entrées corrompues sont-elles utilisables dans cette recette ?
 * - champ `corruptedInputs` explicite (YAML) : il l'emporte ;
 * - notes du wiki interdisant les objets corrompus : "forbidden" ;
 * - `vendor_recipe` : les objets sont vendus tels quels au PNJ -> "allowed" ;
 * - `other` (objet appliqué sur un autre, ex. Flesh of Xesht sur The Red Dream) : la currency ne
 *   s'utilise pas sur un objet corrompu -> "forbidden" ;
 * - div_card / fragment_set / vendor_shop : entrées de l'exchange, sans objet -> "forbidden" (prudent).
 */
export function corruptedInputPolicy(
  recipe: Pick<Recipe, "kind" | "corruptedInputs"> & { notes?: string },
): CorruptedInputs {
  if (recipe.corruptedInputs) return recipe.corruptedInputs;
  if (recipe.notes && FORBIDS_CORRUPTED.test(recipe.notes)) return "forbidden";
  return recipe.kind === "vendor_recipe" ? "allowed" : "forbidden";
}
