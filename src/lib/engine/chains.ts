import type { PriceIndex } from "../prices/types";
import type { Recipe } from "../recipes/types";
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from "./config";
import { evaluateTrade } from "./evaluate";
import type { ChainStep, Opportunity, SkipReason } from "./types";

interface Edge {
  recipe: Recipe;
  from: string;
  to: string;
  qtyIn: number;
  qtyOut: number;
}

/** Arêtes = conversions PNJ 1 entrée → 1 sortie. */
export function buildVendorGraph(recipes: Recipe[]): Map<string, Edge[]> {
  const g = new Map<string, Edge[]>();
  for (const r of recipes) {
    if (r.kind !== "vendor_shop" || r.inputs.length !== 1 || r.outputs.length !== 1) continue;
    const [i] = r.inputs;
    const [o] = r.outputs;
    if (i.item === o.item) continue;
    const list = g.get(i.item) ?? [];
    list.push({ recipe: r, from: i.item, to: o.item, qtyIn: i.qty, qtyOut: o.qty });
    g.set(i.item, list);
  }
  return g;
}

/**
 * Plus petit lot de départ (≥ 1) qui traverse toutes les étapes en quantités entières
 * (chaque étape consomme un multiple exact de son entrée).
 */
function smallestBatch(path: Edge[]): { start: number; end: number; steps: ChainStep[] } | undefined {
  for (let start = 1; start <= 100_000; start++) {
    let amt = start;
    const steps: ChainStep[] = [];
    let ok = true;
    for (const e of path) {
      if (amt % e.qtyIn !== 0) {
        ok = false;
        break;
      }
      const out = (amt / e.qtyIn) * e.qtyOut;
      steps.push({
        recipeId: e.recipe.id,
        from: e.from,
        to: e.to,
        qtyIn: amt,
        qtyOut: out,
        vendor: e.recipe.vendor,
      });
      amt = out;
    }
    if (ok && amt > 0) return { start, end: amt, steps };
  }
  return undefined;
}

function chainLabel(steps: ChainStep[]): string {
  const first = steps[0];
  const last = steps[steps.length - 1];
  const mid = steps.slice(0, -1).map((s) => s.to);
  return `${first.qtyIn}× ${first.from} → ${[...mid, `${last.qtyOut}× ${last.to}`].join(" → ")}`;
}

/** Tous les chemins simples (sans nœud répété, donc sans cycle) de 1 à maxSteps étapes depuis `start`. */
function* paths(g: Map<string, Edge[]>, start: string, maxSteps: number): Generator<Edge[]> {
  const stack: Edge[] = [];
  const visited = new Set([start]);
  function* dfs(node: string): Generator<Edge[]> {
    if (stack.length >= maxSteps) return;
    for (const e of g.get(node) ?? []) {
      if (visited.has(e.to)) continue;
      visited.add(e.to);
      stack.push(e);
      yield [...stack];
      yield* dfs(e.to);
      stack.pop();
      visited.delete(e.to);
    }
  }
  yield* dfs(start);
}

export interface ChainResult {
  opportunities: Opportunity[];
  skipped: Record<SkipReason, number>;
}

/**
 * Pour chaque paire départ→arrivée, le meilleur chemin (minChainSteps..maxChainSteps étapes) par marge.
 * Seuls l'item de départ et l'item final sont achetés/vendus : les intermédiaires n'ont pas besoin de prix.
 */
export function findVendorChains(
  recipes: Recipe[],
  prices: PriceIndex,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): ChainResult {
  const g = buildVendorGraph(recipes);
  const opportunities: Opportunity[] = [];
  const skipped: Record<SkipReason, number> = { missing_price: 0, illiquid: 0 };

  for (const start of g.keys()) {
    const best = new Map<string, Opportunity>();
    const failed = new Map<string, SkipReason>();
    for (const path of paths(g, start, config.maxChainSteps)) {
      if (path.length < config.minChainSteps) continue;
      const end = path[path.length - 1].to;
      const batch = smallestBatch(path);
      if (!batch) continue;
      const r = evaluateTrade(
        {
          id: `chain:${path.map((e) => e.recipe.id).join(">")}`,
          kind: "vendor_chain",
          inputs: [{ item: start, qty: batch.start }],
          outputs: [{ item: end, qty: batch.end }],
          conditional: path.some((e) => e.recipe.conditional),
          unverified: path.some((e) => e.recipe.verified === false),
          sources: path.map((e) => e.recipe.source),
          steps: batch.steps,
          label: chainLabel(batch.steps),
        },
        prices,
        config,
      );
      if (!r.ok) {
        if (failed.get(end) !== "illiquid") failed.set(end, r.reason);
        continue;
      }
      const cur = best.get(end);
      if (!cur || r.opportunity.marginPct > cur.marginPct) best.set(end, r.opportunity);
    }
    opportunities.push(...best.values());
    for (const [end, reason] of failed) if (!best.has(end)) skipped[reason]++;
  }
  return { opportunities, skipped };
}
