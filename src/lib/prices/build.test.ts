import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
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
    await expect(getCurrentLeague({ fetch: bad })).rejects.toThrow(/503/);
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
