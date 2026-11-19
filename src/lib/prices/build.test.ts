import { beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCurrentLeague, getExchangeOverview, getItemOverview, type FetchLike } from "../ninja";
import { buildPriceIndex, clearPriceCache } from "./build";

const fx = (n: string) =>
  JSON.parse(readFileSync(join(__dirname, "../ninja/__fixtures__", n), "utf8"));

let calls: string[] = [];
const empty = { core: { primary: "chaos" }, items: [], lines: [] };
const mockFetch: FetchLike = async (url) => {
  calls.push(url);
  let body: unknown;
  if (url.includes("/leagues")) body = fx("leagues.json");
  else if (url.includes("/exchange/"))
    body = url.includes("type=Currency") ? fx("exchange-currency.json") : empty;
  else body = url.includes("type=UniqueAccessory") ? fx("stash-unique.json") : { lines: [] };
  return { ok: true, status: 200, json: async () => body };
};
const opts = {
  fetch: mockFetch,
  exchangeTypes: ["Currency", "Fragment"],
  stashTypes: ["UniqueAccessory", "Map"],
};

beforeEach(() => {
  calls = [];
  clearPriceCache();
});

describe("ninja client", () => {
  it("picks the first league", async () => {
    expect(await getCurrentLeague({ fetch: mockFetch })).toBe("Covens");
  });
  it("parses overviews and tolerates extra fields", async () => {
    const ex = await getExchangeOverview("Covens", "Currency", { fetch: mockFetch });
    expect(ex.lines.length).toBeGreaterThan(2);
    const st = await getItemOverview("Covens", "UniqueAccessory", { fetch: mockFetch });
    expect(st.lines[0].name).toBe("Foulborn Headhunter");
  });
  it("throws an explicit error on schema failure", async () => {
    const bad: FetchLike = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ lines: [{ name: 1 }] }),
    });
    await expect(getItemOverview("Covens", "Map", { fetch: bad })).rejects.toThrow(
      /réponse inattendue/,
    );
  });
  it("throws on HTTP error", async () => {
    const bad: FetchLike = async () => ({ ok: false, status: 503, json: async () => ({}) });
    await expect(getCurrentLeague({ fetch: bad, sleep: async () => {} })).rejects.toThrow(/503/);
  });
});

describe("retry", () => {
  it("retries on 429 honouring Retry-After, then succeeds", async () => {
    let n = 0;
    const sleeps: number[] = [];
    const f: FetchLike = async () => {
      n++;
      if (n === 1)
        return { ok: false, status: 429, headers: { get: () => "7" }, json: async () => ({}) };
      if (n === 2) return { ok: false, status: 503, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => fx("leagues.json") };
    };
    const lg = await getCurrentLeague({ fetch: f, sleep: async (ms) => void sleeps.push(ms) });
    expect(lg).toBe("Covens");
    expect(n).toBe(3);
    expect(sleeps).toEqual([7000, 15000]);
  });
  it("gives up after 2 retries", async () => {
    let n = 0;
    const f: FetchLike = async () => {
      n++;
      return { ok: false, status: 429, json: async () => ({}) };
    };
    await expect(getCurrentLeague({ fetch: f, sleep: async () => {} })).rejects.toThrow(/429/);
    expect(n).toBe(3);
  });
  it("does not retry on 404", async () => {
    let n = 0;
    const f: FetchLike = async () => {
      n++;
      return { ok: false, status: 404, json: async () => ({}) };
    };
    await expect(getCurrentLeague({ fetch: f, sleep: async () => {} })).rejects.toThrow(/404/);
    expect(n).toBe(1);
  });
});

describe("failed categories", () => {
  const failing = (bad: string): FetchLike => async (url, init) =>
    url.includes(`type=${bad}`)
      ? { ok: false, status: 500, json: async () => ({}) }
      : mockFetch(url, init);
  const o = (bad: string) => ({ ...opts, fetch: failing(bad), sleep: async () => {} });
  it("skips a failed category and lists it", async () => {
    const idx = await buildPriceIndex("Covens", o("Map"));
    expect(idx.failedCategories).toEqual(["stash:Map"]);
    expect(idx.get("Divine Orb")).toBeDefined();
    const ok = await buildPriceIndex("Covens", { ...opts, noCache: true });
    expect(ok.failedCategories).toEqual([]);
  });
  it("throws when Currency fails", async () => {
    await expect(buildPriceIndex("Covens", o("Currency"))).rejects.toThrow(/500/);
  });
});

describe("disk cache", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ninja-cache-"));
  });
  const dopts = (t: number) => ({
    ...opts,
    diskCache: true,
    cacheDir: dir,
    noCache: true,
    now: () => new Date(t),
  });
  it("misses, then hits, then expires", async () => {
    try {
      await buildPriceIndex(undefined, dopts(0));
      const n = calls.length;
      expect(n).toBeGreaterThan(0);
      expect(existsSync(join(dir, "Covens", "exchange-Currency.json"))).toBe(true);
      expect(existsSync(join(dir, "Covens", "stash-Map.json"))).toBe(true);
      const idx = await buildPriceIndex(undefined, dopts(14 * 60_000));
      expect(calls.length).toBe(n);
      expect(idx.get("Original Sin")!.chaos).toBe(73440);
      await buildPriceIndex(undefined, dopts(16 * 60_000));
      expect(calls.length).toBe(n * 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("is off by default", async () => {
    try {
      await buildPriceIndex("Covens", { ...opts, cacheDir: dir });
      expect(existsSync(join(dir, "Covens"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("buildPriceIndex", () => {
  it("maps slugs to names and computes divine rate", async () => {
    const idx = await buildPriceIndex(undefined, opts);
    expect(idx.league).toBe("Covens");
    expect(idx.divineChaos).toBeGreaterThan(10);
    const fusing = idx.get("orb of fusing")!;
    expect(fusing.source).toBe("exchange");
    expect(fusing.liquidityKind).toBe("volumeChaos");
    expect(idx.get("Divine Orb")!.chaos).toBe(idx.divineChaos);
  });
  it("keeps cheapest unlinked line for duplicates", async () => {
    const idx = await buildPriceIndex("Covens", opts);
    const e = idx.get("Original Sin")!;
    // la ligne 6L à 1c est ignorée, on garde la moins chère sans liens
    expect(e.chaos).toBe(73440);
    expect(e.source).toBe("stash");
    expect(e.liquidityKind).toBe("listings");
  });
  it("caches for 15 minutes", async () => {
    let t = 0;
    const o = { ...opts, now: () => new Date(t) };
    await buildPriceIndex("Covens", o);
    const n = calls.length;
    t = 14 * 60_000;
    await buildPriceIndex("Covens", o);
    expect(calls.length).toBe(n);
    t = 16 * 60_000;
    await buildPriceIndex("Covens", o);
    expect(calls.length).toBe(n * 2);
  });
});
