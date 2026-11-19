import {
  getCurrentLeague,
  getExchangeOverview,
  getItemOverview,
  type NinjaOptions,
} from "../ninja";
import type { PriceEntry, PriceIndex } from "./types";

export const EXCHANGE_TYPES = [
  "Currency", "Fragment", "Runegraft", "AllflameEmber", "Tattoo", "Omen", "DjinnCoin", "Ducat",
  "EnshroudingCrystal", "DivinationCard", "Artifact", "Oil", "DeliriumOrb", "Scarab", "Astrolabe",
  "Thread", "Fossil", "Resonator", "Essence",
];

// BaseType volontairement exclu pour l'instant.
export const STASH_TYPES = [
  "UniqueWeapon", "UniqueArmour", "UniqueAccessory", "UniqueFlask", "UniqueJewel", "UniqueRelic",
  "UniqueTincture", "UniqueMap", "Invitation", "Incubator", "Map", "SkillGem",
];

export interface BuildOptions extends NinjaOptions {
  exchangeTypes?: string[];
  stashTypes?: string[];
  /** Requêtes simultanées max (défaut 2, ≤ 3 recommandé). */
  concurrency?: number;
  /** Ignorer le cache mémoire. */
  noCache?: boolean;
  now?: () => Date;
}

const TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; index: PriceIndex }>();

export function clearPriceCache(): void {
  cache.clear();
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const POECDN = "https://web.poecdn.com";
const absIcon = (s?: string | null) => (s ? (s.startsWith("/") ? POECDN + s : s) : undefined);
const opt = <T>(v: T | null | undefined) => v ?? undefined;

export async function buildPriceIndex(
  league?: string,
  opts: BuildOptions = {},
): Promise<PriceIndex> {
  const lg = league ?? (await getCurrentLeague(opts));
  const exTypes = opts.exchangeTypes ?? EXCHANGE_TYPES;
  const stTypes = opts.stashTypes ?? STASH_TYPES;
  const key = `${lg}|${exTypes.join(",")}|${stTypes.join(",")}`;
  const now = opts.now ?? (() => new Date());
  const hit = cache.get(key);
  if (!opts.noCache && hit && now().getTime() - hit.at < TTL_MS) return hit.index;

  const conc = Math.max(1, opts.concurrency ?? 2);
  const exchange = await mapLimit(exTypes, conc, async (t) => ({
    t,
    o: await getExchangeOverview(lg, t, opts),
  }));
  const stash = await mapLimit(stTypes, conc, async (t) => ({
    t,
    o: await getItemOverview(lg, t, opts),
  }));

  const entries = new Map<string, PriceEntry>();
  let divineChaos = 0;

  for (const { t, o } of exchange) {
    const names = new Map([...(o.core.items ?? []), ...o.items].map((i) => [i.id, i]));
    for (const l of o.lines) {
      const item = names.get(l.id);
      if (!item) continue;
      if (l.id === "divine" && t === "Currency") divineChaos = l.primaryValue;
      if (entries.has(item.name)) continue;
      entries.set(item.name, {
        name: item.name,
        chaos: l.primaryValue,
        liquidity: l.volumePrimaryValue ?? 0,
        liquidityKind: "volumeChaos",
        trendPct: opt(l.sparkline?.totalChange),
        source: "exchange",
        category: t,
        detailsId: opt(item.detailsId),
        icon: absIcon(item.image),
      });
    }
  }
  if (!(divineChaos > 0)) throw new Error("Prix du Divine Orb introuvable dans l'exchange Currency");

  // Stash : par nom, ligne sans liens la moins chère (sinon la moins chère tout court) ; l'exchange prime.
  for (const { t, o } of stash) {
    type Line = (typeof o.lines)[number];
    const best = new Map<string, Line>();
    for (const l of o.lines) {
      const cur = best.get(l.name);
      if (!cur) {
        best.set(l.name, l);
        continue;
      }
      const unlinked = (x: Line) => !x.links;
      const better = unlinked(l) !== unlinked(cur) ? unlinked(l) : l.chaosValue < cur.chaosValue;
      if (better) best.set(l.name, l);
    }
    for (const l of best.values()) {
      if (entries.has(l.name)) continue;
      entries.set(l.name, {
        name: l.name,
        chaos: l.chaosValue,
        liquidity: l.listingCount ?? l.count ?? 0,
        liquidityKind: "listings",
        trendPct: opt(l.sparkLine?.totalChange),
        source: "stash",
        category: t,
        detailsId: opt(l.detailsId),
        icon: absIcon(l.icon),
        baseType: opt(l.baseType),
      });
    }
  }

  const lower = new Map([...entries].map(([n, e]) => [n.toLowerCase(), e]));
  const index: PriceIndex = {
    league: lg,
    fetchedAt: now(),
    divineChaos,
    entries,
    get: (name) => entries.get(name) ?? lower.get(name.toLowerCase()),
  };
  cache.set(key, { at: now().getTime(), index });
  return index;
}
