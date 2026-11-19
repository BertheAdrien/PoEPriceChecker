import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { recipeListSchema } from "./schema";
import type { Recipe } from "./types";

const DEFAULT_YAML = path.join(process.cwd(), "data", "recipes.yaml");
const DEFAULT_WIKI = path.join(process.cwd(), "data", "generated", "wiki-recipes.json");

/** Parse + valide le contenu YAML des recettes manuelles. Lève une ZodError si invalide. */
export function parseRecipesYaml(text: string): Recipe[] {
  return recipeListSchema.parse(parseYaml(text) ?? []);
}

export function loadYamlRecipes(file = DEFAULT_YAML): Recipe[] {
  return parseRecipesYaml(fs.readFileSync(file, "utf8"));
}

/** Recettes importées du wiki ; liste vide si le fichier n'existe pas encore. */
export function loadWikiRecipes(file = DEFAULT_WIKI): Recipe[] {
  if (!fs.existsSync(file)) return [];
  return recipeListSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
}

function signature(r: Recipe): string {
  const side = (items: Recipe["inputs"]) =>
    items
      .map((i) => `${i.qty}x${i.item}`)
      .sort()
      .join("+");
  return `${side(r.inputs)}=>${side(r.outputs)}`;
}

/**
 * Fusionne YAML + wiki ; en cas de collision d'id, le YAML gagne.
 * Une recette wiki identique (mêmes entrées/sorties) à une recette YAML est aussi écartée.
 */
export function mergeRecipes(yaml: Recipe[], wiki: Recipe[]): Recipe[] {
  const yamlSigs = new Set(yaml.map(signature));
  const byId = new Map<string, Recipe>();
  for (const r of wiki) if (!yamlSigs.has(signature(r))) byId.set(r.id, r);
  for (const r of yaml) byId.set(r.id, r);
  return [...byId.values()];
}

const DEFAULT_OVERRIDES = path.join(process.cwd(), "data", "recipe-overrides.yaml");

const overrideSchema = z.array(
  z.object({
    id: z.string(),
    corruptedInputs: z.enum(["allowed", "forbidden"]).optional(),
    source: z.string(),
    verified: z.union([z.string(), z.literal(false)]),
  }),
);
export type RecipeOverride = z.infer<typeof overrideSchema>[number];

export function parseOverridesYaml(text: string): RecipeOverride[] {
  return overrideSchema.parse(parseYaml(text) ?? []);
}

/** Applique les corrections par id ; un id inconnu lève une erreur (faute de frappe, recette disparue). */
export function applyOverrides(recipes: Recipe[], overrides: RecipeOverride[]): Recipe[] {
  const byId = new Map(recipes.map((r) => [r.id, r]));
  for (const o of overrides) {
    const r = byId.get(o.id);
    if (!r) throw new Error(`recipe-overrides.yaml : recette inconnue « ${o.id} »`);
    if (o.corruptedInputs) byId.set(o.id, { ...r, corruptedInputs: o.corruptedInputs });
  }
  return [...byId.values()];
}

export function loadRecipes(
  opts: { yamlFile?: string; wikiFile?: string; overridesFile?: string } = {},
): Recipe[] {
  const merged = mergeRecipes(loadYamlRecipes(opts.yamlFile), loadWikiRecipes(opts.wikiFile));
  const file = opts.overridesFile ?? DEFAULT_OVERRIDES;
  if (!fs.existsSync(file)) return merged;
  return applyOverrides(merged, parseOverridesYaml(fs.readFileSync(file, "utf8")));
}
