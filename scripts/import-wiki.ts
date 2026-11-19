/**
 * Import des recettes du wiki PoE (tables Cargo) -> data/generated/wiki-recipes.json
 * Usage : npm run import:wiki [-- --raw-dir <dossier>]   (--raw-dir : cache des réponses brutes)
 */
import fs from "node:fs";
import path from "node:path";
import { buildWikiRecipes, type WikiPartRow, type WikiRecipeRow } from "../src/lib/recipes/wiki";

const API = "https://www.poewiki.net/w/api.php";
const UA = "poe-price-checker/0.1 (+https://github.com/BertheAdrien/PoEPriceChecker)";
const DELAY_MS = 300;
const PAGE = 500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url: string): Promise<unknown> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 9; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.status === 429 || res.status >= 500 || res.status === 403) {
        throw new Error(`HTTP ${res.status}`);
      }
      const text = await res.text();
      // Cloudflare peut renvoyer une page de challenge HTML avec un 200.
      return JSON.parse(text);
    } catch (e) {
      lastErr = e;
      const code = (e as { cause?: { code?: string } }).cause?.code;
      if (code === "ECONNRESET") {
        throw new Error(
          "ECONNRESET : le filtre de la box bloque les sites PoE -> repasser en 4G.",
        );
      }
      await sleep(Math.min(5000 * 2 ** attempt, 120_000));
    }
  }
  throw new Error(`Échec après retries : ${String(lastErr)}`);
}

async function cargoAll(
  tables: string,
  fields: string,
  where?: string,
): Promise<Record<string, string | null>[]> {
  const out: Record<string, string | null>[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const url =
      `${API}?action=cargoquery&format=json&tables=${tables}` +
      `&fields=${encodeURIComponent(fields)}&limit=${PAGE}&offset=${offset}` +
      (where ? `&where=${encodeURIComponent(where)}` : "");
    const json = (await fetchJson(url)) as {
      cargoquery?: { title: Record<string, string | null> }[];
    };
    if (!json.cargoquery) throw new Error(`Réponse inattendue : ${JSON.stringify(json).slice(0, 200)}`);
    out.push(...json.cargoquery.map((r) => r.title));
    process.stderr.write(`\r${tables} ${out.length}`);
    if (json.cargoquery.length < PAGE) break;
    await sleep(DELAY_MS);
  }
  process.stderr.write("\n");
  return out;
}

async function cached<T>(rawDir: string | undefined, name: string, load: () => Promise<T>): Promise<T> {
  const file = rawDir ? path.join(rawDir, `${name}.json`) : undefined;
  if (file && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  const data = await load();
  if (file) fs.writeFileSync(file, JSON.stringify(data));
  return data;
}

async function main() {
  const i = process.argv.indexOf("--raw-dir");
  const rawDir = i >= 0 ? process.argv[i + 1] : undefined;
  if (rawDir) fs.mkdirSync(rawDir, { recursive: true });

  const recipes = await cached(rawDir, "recipes", () =>
    cargoAll("acquisition_recipes", "_pageName=page,recipe_id,description,result_amount,automatic"),
  );
  await sleep(DELAY_MS);
  const parts = await cached(rawDir, "parts", () =>
    cargoAll(
      "acquisition_recipe_parts",
      "_pageName=page,recipe_id,part_id,item_name,item_id,item_page,amount,notes",
    ),
  );
  await sleep(DELAY_MS);
  const cards = await cached(rawDir, "cards", () =>
    cargoAll("items", "_pageName=page,name", 'class_id="DivinationCard"'),
  );

  const date = new Date().toISOString().slice(0, 10);
  const result = buildWikiRecipes({
    recipes: recipes as unknown as WikiRecipeRow[],
    parts: parts as unknown as WikiPartRow[],
    divCards: cards.map((c) => c.name ?? c.page ?? "").filter(Boolean),
    date,
  });

  const outDir = path.join(process.cwd(), "data", "generated");
  fs.mkdirSync(outDir, { recursive: true });
  const body = result.recipes.map((r) => "  " + JSON.stringify(r)).join(",\n");
  const outFile = path.join(outDir, "wiki-recipes.json");
  fs.writeFileSync(outFile, `[\n${body}\n]\n`);

  const counts: Record<string, number> = {};
  let conditional = 0;
  for (const r of result.recipes) {
    counts[r.kind] = (counts[r.kind] ?? 0) + 1;
    if (r.conditional) conditional++;
  }
  console.log(`écrit ${result.recipes.length} recettes -> ${outFile}`);
  console.log("par kind :", counts, "| conditionnelles :", conditional);
  console.log("lignes écartées :", result.dropped);
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
