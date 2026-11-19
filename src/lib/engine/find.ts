import type { PriceIndex } from "../prices/types";
import type { Recipe } from "../recipes/types";
import { findVendorChains } from "./chains";
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from "./config";
import { evaluateRecipe } from "./evaluate";
import type { FindResult, Opportunity } from "./types";

export function findOpportunities(
  prices: PriceIndex,
  recipes: Recipe[],
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): FindResult {
  const opportunities: Opportunity[] = [];
  const skipped = { missing_price: 0, illiquid: 0 };
  for (const r of recipes) {
    const res = evaluateRecipe(r, prices, config);
    if (res.ok) opportunities.push(res.opportunity);
    else skipped[res.reason]++;
  }
  const chains = findVendorChains(recipes, prices, config);
  opportunities.push(...chains.opportunities);
  opportunities.sort((a, b) => b.marginPct - a.marginPct);
  return { opportunities, skipped, chainSkipped: chains.skipped, evaluated: recipes.length };
}
