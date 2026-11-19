import { DEFAULT_ENGINE_CONFIG, findOpportunities, type Opportunity, type SkipReason } from "./engine";
import { buildPriceIndex, buildTradeUrl } from "./prices";
import { loadRecipes } from "./recipes";

/** Données sérialisables passées aux composants client. */
export interface DashboardPayload {
  league: string;
  fetchedAt: string;
  divineChaos: number;
  failedCategories: string[];
  safetyMarginPct: number;
  opportunities: Opportunity[];
  skipped: Record<SkipReason, number>;
  chainSkipped: Record<SkipReason, number>;
  /** id de recette -> nom du vendeur. */
  vendors: Record<string, string>;
  /** nom d'item -> lien trade (items du trade classique uniquement). */
  trade: Record<string, string>;
}

export async function buildPayload(): Promise<DashboardPayload> {
  const prices = await buildPriceIndex();
  const recipes = loadRecipes();
  const res = findOpportunities(prices, recipes, DEFAULT_ENGINE_CONFIG);
  const vendors: Record<string, string> = {};
  for (const r of recipes) if (r.vendor) vendors[r.id] = r.vendor;
  const trade: Record<string, string> = {};
  for (const o of res.opportunities) {
    for (const i of [...o.inputs, ...o.outputs]) {
      const e = prices.get(i.item);
      const url = e && buildTradeUrl(prices.league, e);
      if (url) trade[i.item] = url;
    }
  }
  return {
    league: prices.league,
    fetchedAt: prices.fetchedAt.toISOString(),
    divineChaos: prices.divineChaos,
    failedCategories: prices.failedCategories,
    safetyMarginPct: DEFAULT_ENGINE_CONFIG.safetyMargin * 100,
    opportunities: res.opportunities,
    skipped: res.skipped,
    chainSkipped: res.chainSkipped,
    vendors,
    trade,
  };
}
