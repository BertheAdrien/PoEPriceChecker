import type { PriceEntry, PriceIndex } from "../prices/types";
import { tradeFetchPrices, tradeSearch, type SearchResponse } from "./client";
import { buildSearchUrl, buildTradeQuery, type CorruptedFilter } from "./query";
import type { ListingPrice, TradePrice, TradeQuery } from "./types";

const TTL_MS = 15 * 60 * 1000;
/** Nombre d'annonces (les moins chères) retenues pour la médiane. */
export const SAMPLE_SIZE = 5;

/** Id de devise du trade -> nom poe.ninja, pour les devises courantes autres que chaos / divine. */
const CURRENCY_NAMES: Record<string, string> = {
  exalted: "Exalted Orb",
  mirror: "Mirror of Kalandra",
  alch: "Orb of Alchemy",
  vaal: "Vaal Orb",
  chance: "Orb of Chance",
  fusing: "Orb of Fusing",
  jewellers: "Jeweller's Orb",
  chromatic: "Chromatic Orb",
  scour: "Orb of Scouring",
  regret: "Orb of Regret",
  annul: "Orb of Annulment",
  aug: "Orb of Augmentation",
  transmute: "Orb of Transmutation",
  alt: "Orb of Alteration",
  regal: "Regal Orb",
  chisel: "Cartographer's Chisel",
  gcp: "Gemcutter's Prism",
  blessed: "Blessed Orb",
  ancient: "Ancient Orb",
};

/** Prix d'une annonce en chaos ; undefined si la devise n'est pas résolvable via l'index. */
export function listingToChaos(p: ListingPrice, index: PriceIndex): number | undefined {
  if (!(p.amount > 0) || !Number.isFinite(p.amount)) return undefined;
  const id = p.currency.toLowerCase();
  if (id === "chaos") return p.amount;
  if (id === "divine") return p.amount * index.divineChaos;
  const unit = index.get(CURRENCY_NAMES[id] ?? p.currency)?.chaos;
  return unit && unit > 0 ? p.amount * unit : undefined;
}

/** Médiane (chaos) des `SAMPLE_SIZE` annonces les moins chères convertibles. */
export function medianChaos(
  prices: ListingPrice[],
  index: PriceIndex,
): { medianChaos?: number; sampled: number } {
  const chaos = prices
    .map((p) => listingToChaos(p, index))
    .filter((c): c is number => c !== undefined)
    .sort((a, b) => a - b)
    .slice(0, SAMPLE_SIZE);
  if (chaos.length === 0) return { sampled: 0 };
  const mid = Math.floor(chaos.length / 2);
  const med = chaos.length % 2 ? chaos[mid] : (chaos[mid - 1] + chaos[mid]) / 2;
  return { medianChaos: med, sampled: chaos.length };
}

export interface TradeDeps {
  search: (league: string, query: TradeQuery) => Promise<SearchResponse>;
  fetchPrices: (ids: string[], queryId: string) => Promise<ListingPrice[]>;
  now: () => number;
}

const defaultDeps: TradeDeps = { search: tradeSearch, fetchPrices: tradeFetchPrices, now: Date.now };

const cache = new Map<string, { at: number; value: Promise<TradePrice> }>();

export function clearTradeCache(): void {
  cache.clear();
}

/**
 * Prix trade d'un item du stash (annonces securable, non corrompues, non mutées), cache 15 min par requête.
 * undefined si l'item n'est pas vérifiable (exchange, Foulborn). 1 recherche + 1 fetch au plus.
 */
export function searchPrice(
  entry: PriceEntry,
  index: PriceIndex,
  league: string = index.league,
  deps: Partial<TradeDeps> = {},
  corrupted: CorruptedFilter = "false",
): Promise<TradePrice> | undefined {
  const query = buildTradeQuery(entry, corrupted);
  if (!query) return undefined;
  const d = { ...defaultDeps, ...deps };
  const key = `${league}|${JSON.stringify(query)}`;
  const hit = cache.get(key);
  if (hit && d.now() - hit.at < TTL_MS) return hit.value;

  const value = (async (): Promise<TradePrice> => {
    const tradeUrl = buildSearchUrl(league, query);
    const found = await d.search(league, query);
    if (found.total === 0 || found.result.length === 0) return { listings: found.total, sampled: 0, tradeUrl };
    const prices = await d.fetchPrices(found.result.slice(0, SAMPLE_SIZE), found.id);
    const m = medianChaos(prices, index);
    return { ...m, listings: found.total, tradeUrl };
  })();
  cache.set(key, { at: d.now(), value });
  value.catch(() => {
    if (cache.get(key)?.value === value) cache.delete(key);
  });
  return value;
}
