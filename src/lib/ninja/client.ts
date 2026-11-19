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
) => Promise<{
  ok: boolean;
  status: number;
  headers?: { get(name: string): string | null };
  json(): Promise<unknown>;
}>;

export interface NinjaOptions {
  fetch?: FetchLike;
  baseUrl?: string;
  /** Attente entre deux tentatives (injectable pour les tests). */
  sleep?: (ms: number) => Promise<void>;
}

/** Délais par défaut avant les retries sur 429/5xx. */
export const RETRY_DELAYS_MS = [5_000, 15_000];
const MAX_RETRY_AFTER_MS = 60_000;
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function retryDelay(res: { headers?: { get(n: string): string | null } }, attempt: number): number {
  const fallback = RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  const ra = res.headers?.get("Retry-After");
  const secs = ra === null || ra === undefined || ra.trim() === "" ? NaN : Number(ra);
  return Number.isFinite(secs) && secs >= 0 ? Math.min(secs * 1000, MAX_RETRY_AFTER_MS) : fallback;
}

async function getJson<S extends z.ZodType>(
  path: string,
  schema: S,
  opts: NinjaOptions,
): Promise<z.infer<S>> {
  const url = (opts.baseUrl ?? NINJA_BASE) + path;
  const doFetch = opts.fetch ?? (globalThis.fetch as FetchLike);
  const sleep = opts.sleep ?? defaultSleep;
  let res = await doFetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
    if (res.ok || !(res.status === 429 || res.status >= 500)) break;
    await sleep(retryDelay(res, attempt));
    res = await doFetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
  }
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
