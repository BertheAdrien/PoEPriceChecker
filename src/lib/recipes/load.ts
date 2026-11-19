import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
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

export function loadRecipes(opts: { yamlFile?: string; wikiFile?: string } = {}): Recipe[] {
  return mergeRecipes(loadYamlRecipes(opts.yamlFile), loadWikiRecipes(opts.wikiFile));
}
