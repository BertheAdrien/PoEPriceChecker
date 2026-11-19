import { z } from "zod";
import { parseRetryAfter } from "./headers";
import { TradeRateLimiter } from "./limiter";
import type { ListingPrice, TradeQuery } from "./types";

const BASE = "https://www.pathofexile.com/api/trade";
export const TRADE_USER_AGENT =
  "poe-price-checker/0.1 (+https://github.com/BertheAdrien/PoEPriceChecker)";

export class TradeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TradeApiError";
  }
}

export class TradeRateLimitedError extends TradeApiError {
  constructor(readonly retryAfterSec: number) {
    super(`Trade API : limite atteinte, réessayer dans ${Math.ceil(retryAfterSec)} s`, 429);
    this.name = "TradeRateLimitedError";
  }
}

// Un seul limiteur par processus (survit au rechargement à chaud en dev).
const g = globalThis as unknown as { __tradeLimiter?: TradeRateLimiter };
export const tradeLimiter = (g.__tradeLimiter ??= new TradeRateLimiter());

const searchSchema = z.object({ id: z.string(), total: z.number(), result: z.array(z.string()) });

const fetchSchema = z.object({
  result: z.array(
    z
      .object({
        listing: z
          .object({
            price: z.object({ amount: z.number(), currency: z.string() }).nullish(),
          })
          .nullish(),
        item: z.object({ corrupted: z.boolean().optional(), mutated: z.boolean().optional() }).nullish(),
      })
      .nullable(),
  ),
});

async function call(policy: "search" | "fetch", url: string, init?: RequestInit): Promise<unknown> {
  const res = await tradeLimiter.schedule(policy, () =>
    fetch(url, {
      ...init,
      headers: {
        "User-Agent": TRADE_USER_AGENT,
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      cache: "no-store",
    }),
  );
  if (res.status === 429) {
    throw new TradeRateLimitedError(parseRetryAfter(res.headers.get("retry-after")) ?? 60);
  }
  if (!res.ok) throw new TradeApiError(`Trade API ${res.status} sur ${url}`, res.status);
  return res.json();
}

export interface SearchResponse {
  id: string;
  total: number;
  result: string[];
}

export async function tradeSearch(league: string, query: TradeQuery): Promise<SearchResponse> {
  const json = await call("search", `${BASE}/search/${encodeURIComponent(league)}`, {
    method: "POST",
    body: JSON.stringify(query),
  });
  return searchSchema.parse(json);
}

/** Prix des annonces (jusqu'à 10 hashes), sans les annonces corrompues / mutées ni sans prix. */
export async function tradeFetchPrices(ids: string[], queryId: string): Promise<ListingPrice[]> {
  if (ids.length === 0) return [];
  if (ids.length > 10) throw new Error("fetch : 10 hashes max");
  const json = await call("fetch", `${BASE}/fetch/${ids.join(",")}?query=${encodeURIComponent(queryId)}`);
  const out: ListingPrice[] = [];
  for (const r of fetchSchema.parse(json).result) {
    const price = r?.listing?.price;
    if (!price || r?.item?.corrupted || r?.item?.mutated) continue;
    out.push(price);
  }
  return out;
}
