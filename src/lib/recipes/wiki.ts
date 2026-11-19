import type { Recipe, RecipeKind } from "./types";

/** Ligne brute renvoyée par Cargo (les clés contiennent des espaces : "recipe id"). */
export type WikiRecipeRow = Record<string, string | null | undefined>;
export type WikiPartRow = Record<string, string | null | undefined>;

export interface WikiPart {
  name: string;
  qty: number;
  notes: string;
}

/** Recette wiki jointe (page + recipe_id) et nettoyée (HTML retiré, entités décodées). */
export interface WikiParsedRecipe {
  /** Page wiki = item PRODUIT. */
  page: string;
  recipeId: string;
  description: string;
  resultAmount: number;
  parts: WikiPart[];
}

export type DropReason =
  | "no_parts"
  | "bad_part"
  | "not_conversion"
  | "random_output"
  | "generic_output"
  | "output_pool";

export type Classification =
  | { dropped: DropReason }
  | { kind: RecipeKind; conditional: boolean; notes?: string };

// --- Nettoyage -------------------------------------------------------------

const ENTITIES: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&amp;": "&",
  "&nbsp;": " ",
};

/** Décode les entités HTML (nommées + numériques). */
export function decodeEntities(s: string): string {
  return s
    .replace(/&(?:lt|gt|quot|amp|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)));
}

/** HTML échappé de Cargo -> texte brut (balises et liens wiki retirés). */
export function cleanText(s: string | null | undefined): string {
  if (!s) return "";
  return decodeEntities(decodeEntities(s).replace(/<[^>]*>/g, ""))
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function field(row: Record<string, string | null | undefined>, key: string): string {
  return row[key] ?? row[key.replace(/ /g, "_")] ?? "";
}

function intOr(s: string, fallback: number): number {
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function wikiUrl(page: string): string {
  return "https://www.poewiki.net/wiki/" + encodeURI(page.replace(/ /g, "_")).replace(/\?/g, "%3F");
}

// --- Jointure --------------------------------------------------------------

/** Joint acquisition_recipes et acquisition_recipe_parts sur (page, recipe_id). */
export function parseWikiRows(recipes: WikiRecipeRow[], parts: WikiPartRow[]): WikiParsedRecipe[] {
  const byKey = new Map<string, WikiPartRow[]>();
  for (const p of parts) {
    const key = `${field(p, "page")}\u0000${field(p, "recipe id")}`;
    const list = byKey.get(key);
    if (list) list.push(p);
    else byKey.set(key, [p]);
  }
  const out: WikiParsedRecipe[] = [];
  for (const r of recipes) {
    const page = cleanText(field(r, "page"));
    const recipeId = field(r, "recipe id");
    const rawParts = [...(byKey.get(`${field(r, "page")}\u0000${recipeId}`) ?? [])];
    rawParts.sort((a, b) => intOr(field(a, "part id"), 0) - intOr(field(b, "part id"), 0));
    out.push({
      page,
      recipeId,
      description: cleanText(field(r, "description")),
      resultAmount: intOr(field(r, "result amount"), 1),
      parts: rawParts.map((p) => ({
        name: cleanText(field(p, "item name")),
        qty: intOr(field(p, "amount"), 1),
        notes: cleanText(field(p, "notes")),
      })),
    });
  }
  return out;
}

// --- Classification --------------------------------------------------------

/** Descriptions qui ne sont pas une conversion item -> item. */
const NOT_CONVERSION =
  /sell price|permanent leagues|prophecy|corruption transformation|incarnation|refresh|modifier:|\{\{/i;
/** Sortie aléatoire : la page n'est qu'un résultat possible parmi d'autres. */
const RANDOM_OUTPUT =
  /random|set exchange|\band (?:\d+ )?others?\b|\bother (?:gems|currenc)|downgrade|transfigured gem/i;
/** Mots-clés : la sortie dépend d'un variant / corruption / liens / niveau / qualité… */
const CONDITIONAL =
  /corrupt|link|level|ilvl|quality|variant|influenc|synthes|implicit|unidentified|\brare\b|rarity|\bany\b|socket|fractured|veiled|tier|enchant|must have|cannot be used|can not be used/i;

export function classify(recipe: WikiParsedRecipe, divCards: ReadonlySet<string>): Classification {
  const { page, description, parts } = recipe;
  if (parts.length === 0) return { dropped: "no_parts" };
  if (
    parts.some(
      (p) =>
        !p.name ||
        p.qty < 1 ||
        /[<>[\]{}]|\bgold\b/i.test(p.name) ||
        /modifier:|\{\{/i.test(p.notes),
    )
  )
    return { dropped: "bad_part" };
  if (NOT_CONVERSION.test(description)) return { dropped: "not_conversion" };
  if (RANDOM_OUTPUT.test(description)) return { dropped: "random_output" };
  if (!page || /^Map \(/.test(page)) return { dropped: "generic_output" };

  const partNotes = parts.filter((p) => p.notes).map((p) => `${p.name}: ${p.notes}`);
  const conditional = CONDITIONAL.test([description, ...partNotes].join(" "));

  let kind: RecipeKind;
  if (/vendor recipe/i.test(description)) kind = "vendor_recipe";
  else if (parts.length === 1 && divCards.has(parts[0].name)) kind = "div_card";
  else if (
    parts.length === 1 &&
    parts[0].qty > 1 &&
    /(splinter|shard|fragment)$/i.test(parts[0].name)
  )
    kind = "fragment_set";
  else kind = "other";

  // La description répète souvent le nom produit ("Kaom's Heart") ou "Vendor recipe" : sans intérêt.
  const trivial =
    !description ||
    /^vendor recipe$/i.test(description) ||
    description.replace(/^\d+x /, "") === page;
  const noteParts = [trivial ? "" : description, ...partNotes].filter(Boolean);
  const notes = noteParts.length ? noteParts.join(" | ").slice(0, 240) : undefined;
  return { kind, conditional, notes };
}

// --- Assemblage ------------------------------------------------------------

function signature(r: WikiParsedRecipe): string {
  const inputs = r.parts
    .map((p) => `${p.qty}x${p.name}`)
    .sort()
    .join("+");
  return `${inputs}#${r.description}`;
}

function mergeInputs(parts: WikiPart[]): { item: string; qty: number }[] {
  const m = new Map<string, number>();
  for (const p of parts) m.set(p.name, (m.get(p.name) ?? 0) + p.qty);
  return [...m].map(([item, qty]) => ({ item, qty }));
}

export interface BuildResult {
  recipes: Recipe[];
  dropped: Record<string, number>;
}

export function buildWikiRecipes(args: {
  recipes: WikiRecipeRow[];
  parts: WikiPartRow[];
  divCards: string[];
  date: string;
}): BuildResult {
  const cards = new Set(args.divCards.map(cleanText));
  const parsed = parseWikiRows(args.recipes, args.parts);
  const dropped: Record<string, number> = {};
  const drop = (reason: string) => (dropped[reason] = (dropped[reason] ?? 0) + 1);

  const kept: { r: WikiParsedRecipe; c: { kind: RecipeKind; conditional: boolean; notes?: string } }[] =
    [];
  for (const r of parsed) {
    const c = classify(r, cards);
    if ("dropped" in c) drop(c.dropped);
    else kept.push({ r, c });
  }

  // Mêmes entrées + même description menant à plusieurs sorties : tirage aléatoire, pas une conversion.
  const outputsBySig = new Map<string, Set<string>>();
  for (const { r } of kept) {
    const sig = signature(r);
    const set = outputsBySig.get(sig) ?? new Set<string>();
    set.add(r.page);
    outputsBySig.set(sig, set);
  }

  const recipes: Recipe[] = [];
  const usedIds = new Set<string>();
  for (const { r, c } of kept) {
    if ((outputsBySig.get(signature(r))?.size ?? 0) > 1) {
      drop("output_pool");
      continue;
    }
    let id = `${slugify(r.page)}-${r.recipeId}`;
    for (let n = 2; usedIds.has(id); n++) id = `${slugify(r.page)}-${r.recipeId}-${n}`;
    usedIds.add(id);
    const rec: Recipe = {
      id,
      kind: c.kind,
      inputs: mergeInputs(r.parts),
      outputs: [{ item: r.page, qty: Math.max(1, r.resultAmount) }],
      source: wikiUrl(r.page),
      verified: `${args.date} (wiki)`,
    };
    if (c.conditional) rec.conditional = true;
    if (c.notes) rec.notes = c.notes;
    recipes.push(rec);
  }
  recipes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { recipes, dropped };
}
