import type { z } from "zod";
import {
  exchangeOverviewSchema,
  itemOverviewSchema,
  leaguesSchema,
  type ExchangeOverview,
  type ItemOverview,
} from "./schemas";

export const NINJA_BASE = "https://poe.ninja/poe1/api/economy";
export const USER_AGENT =
  "poe-price-checker/0.1 (+https://github.com/BertheAdrien/PoEPriceChecker)";

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface NinjaOptions {
  fetch?: FetchLike;
  baseUrl?: string;
}

async function getJson<S extends z.ZodType>(
  path: string,
  schema: S,
  opts: NinjaOptions,
): Promise<z.infer<S>> {
  const url = (opts.baseUrl ?? NINJA_BASE) + path;
  const doFetch = opts.fetch ?? (globalThis.fetch as FetchLike);
  const res = await doFetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`poe.ninja ${path} : HTTP ${res.status}`);
  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) {
    throw new Error(
      `poe.ninja ${path} : réponse inattendue (${parsed.error.message.slice(0, 500)})`,
    );
  }
  return parsed.data;
}

export async function getLeagues(opts: NinjaOptions = {}) {
  return getJson("/leagues", leaguesSchema, opts);
}

/** Ligue challenge courante = 1re entrée de /leagues. */
export async function getCurrentLeague(opts: NinjaOptions = {}): Promise<string> {
  const leagues = await getLeagues(opts);
  if (leagues.length === 0) throw new Error("poe.ninja /leagues : liste vide");
  return leagues[0].id;
}

export async function getExchangeOverview(
  league: string,
  type: string,
  opts: NinjaOptions = {},
): Promise<ExchangeOverview> {
  const q = `?league=${encodeURIComponent(league)}&type=${encodeURIComponent(type)}`;
  return getJson(`/exchange/current/overview${q}`, exchangeOverviewSchema, opts);
}

export async function getItemOverview(
  league: string,
  type: string,
  opts: NinjaOptions = {},
): Promise<ItemOverview> {
  const q = `?league=${encodeURIComponent(league)}&type=${encodeURIComponent(type)}`;
  return getJson(`/stash/current/item/overview${q}`, itemOverviewSchema, opts);
}
