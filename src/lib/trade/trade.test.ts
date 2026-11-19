import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateRecipe } from "../engine";
import type { PriceEntry, PriceIndex } from "../prices/types";
import type { Recipe } from "../recipes/types";
import { clearTradeCache, listingToChaos, medianChaos, searchPrice } from "./price";
import { buildSearchUrl, buildTradeQuery } from "./query";
import type { TradeQuery } from "./types";
import { verifyOpportunity } from "./verify";

const e = (over: Partial<PriceEntry> & { name: string }): PriceEntry => ({
  chaos: 100, liquidity: 20, liquidityKind: "listings", source: "stash", category: "UniqueJewel", ...over,
});

function idx(entries: PriceEntry[], divineChaos = 200): PriceIndex {
  const m = new Map(entries.map((x) => [x.name, x]));
  return { league: "Covens", fetchedAt: new Date(0), divineChaos, entries: m, get: (n) => m.get(n) };
}

describe("buildTradeQuery", () => {
  it("unique : nom + type de base, securable, non corrompu, non muté", () => {
    const q = buildTradeQuery(e({ name: "The Red Dream", baseType: "Crimson Jewel" }))!;
    expect(q).toEqual({
      query: {
        status: { option: "securable" },
        name: "The Red Dream",
        type: "Crimson Jewel",
        filters: { misc_filters: { filters: { corrupted: { option: "false" }, mutated: { option: "false" } } } },
      },
      sort: { price: "asc" },
    });
  });
  it("corrompus acceptés : pas de filtre corrupted, mutated toujours exclu", () => {
    const q = buildTradeQuery(e({ name: "A", baseType: "B" }), "any")!;
    expect(q.query.filters.misc_filters.filters).toEqual({ mutated: { option: "false" } });
  });
  it("non-unique du stash : type seul", () => {
    const q = buildTradeQuery(e({ name: "Awakened Added Cold Damage Support", category: "SkillGem" }))!;
    expect(q.query.type).toBe("Awakened Added Cold Damage Support");
    expect(q.query.name).toBeUndefined();
  });
  it("unique sans type de base : nom seul", () => {
    const q = buildTradeQuery(e({ name: "Mystery" }))!;
    expect(q.query.name).toBe("Mystery");
    expect(q.query.type).toBeUndefined();
  });
  it("Foulborn et exchange : pas de vérification", () => {
    expect(buildTradeQuery(e({ name: "Foulborn Headhunter", baseType: "Leather Belt" }))).toBeUndefined();
    expect(buildTradeQuery(e({ name: "Divine Orb", source: "exchange", category: "Currency" }))).toBeUndefined();
  });
  it("lien trade encodé", () => {
    const q = buildTradeQuery(e({ name: "A", baseType: "B" }))!;
    const u = buildSearchUrl("Covens", q);
    expect(u.startsWith("https://www.pathofexile.com/trade/search/Covens?q=")).toBe(true);
    expect(JSON.parse(decodeURIComponent(u.split("?q=")[1]))).toEqual(q);
  });
});

describe("conversion et médiane", () => {
  const index = idx([e({ name: "Exalted Orb", chaos: 10, source: "exchange", category: "Currency" })]);
  it("chaos, divine, devise résolvable, devise inconnue", () => {
    expect(listingToChaos({ amount: 5, currency: "chaos" }, index)).toBe(5);
    expect(listingToChaos({ amount: 2, currency: "divine" }, index)).toBe(400);
    expect(listingToChaos({ amount: 3, currency: "exalted" }, index)).toBe(30);
    expect(listingToChaos({ amount: 3, currency: "weird" }, index)).toBeUndefined();
    expect(listingToChaos({ amount: 0, currency: "chaos" }, index)).toBeUndefined();
  });
  it("médiane des 5 moins chères (impair)", () => {
    const prices = [9, 1, 2, 3, 4, 100, 200].map((amount) => ({ amount, currency: "chaos" }));
    expect(medianChaos(prices, index)).toEqual({ medianChaos: 3, sampled: 5 });
  });
  it("médiane paire, annonces non convertibles ignorées", () => {
    const prices = [
      { amount: 1, currency: "weird" },
      { amount: 10, currency: "chaos" },
      { amount: 1, currency: "divine" },
    ];
    expect(medianChaos(prices, index)).toEqual({ medianChaos: 105, sampled: 2 });
  });
  it("aucune annonce convertible", () => {
    expect(medianChaos([], index)).toEqual({ sampled: 0 });
  });
});

describe("searchPrice / verifyOpportunity (sans réseau)", () => {
  beforeEach(() => clearTradeCache());

  const dream = e({ name: "The Red Dream", baseType: "Crimson Jewel", chaos: 432 });
  const nightmare = e({ name: "The Red Nightmare", baseType: "Crimson Jewel", chaos: 1727 });
  const flesh = e({
    name: "Flesh of Xesht", chaos: 10, source: "exchange", category: "Fragment",
    liquidityKind: "volumeChaos", liquidity: 5000,
  });
  const index = idx([dream, nightmare, flesh]);
  const recipe = (extra: Partial<Recipe> = {}) =>
    ({
      id: "the-red-nightmare-1", kind: "other", source: "test", verified: false,
      inputs: [{ item: "The Red Dream", qty: 1 }, { item: "Flesh of Xesht", qty: 1 }],
      outputs: [{ item: "The Red Nightmare", qty: 1 }],
      ...extra,
    }) as Recipe;

  const makeDeps = () => ({
    search: vi.fn(async (_l: string, q: TradeQuery) => ({
      id: `q-${q.query.name}`, total: 12, result: ["a", "b", "c", "d", "e", "f"],
    })),
    fetchPrices: vi.fn(async (_ids: string[], qid: string) =>
      qid === "q-The Red Dream"
        ? [6, 7, 7, 7, 8].map((amount) => ({ amount, currency: "divine" }))
        : [7, 8, 8, 9, 10].map((amount) => ({ amount, currency: "divine" })),
    ),
    now: () => 0,
  });

  it("cache par requête (une recherche + un fetch)", async () => {
    const deps = makeDeps();
    const a = await searchPrice(dream, index, "Covens", deps)!;
    await searchPrice(dream, index, "Covens", deps);
    expect(a).toMatchObject({ medianChaos: 1400, listings: 12, sampled: 5 });
    expect(deps.search).toHaveBeenCalledTimes(1);
    expect(deps.fetchPrices).toHaveBeenCalledTimes(1);
    expect(deps.fetchPrices.mock.calls[0][0]).toHaveLength(5);
  });

  it("filtres de corruption différents : requêtes (et caches) distincts", async () => {
    const deps = makeDeps();
    await searchPrice(dream, index, "Covens", deps, "false");
    await searchPrice(dream, index, "Covens", deps, "any");
    expect(deps.search).toHaveBeenCalledTimes(2);
  });

  it("recherche en échec : l'erreur n'est pas mise en cache", async () => {
    const deps = makeDeps();
    deps.search.mockRejectedValueOnce(new Error("boom"));
    await expect(searchPrice(dream, index, "Covens", deps)!).rejects.toThrow("boom");
    await expect(searchPrice(dream, index, "Covens", deps)!).resolves.toMatchObject({ sampled: 5 });
  });

  it("recette « other » : entrée non corrompue exigée, la marge s'effondre", async () => {
    const base = evaluateRecipe(recipe(), index);
    if (!base.ok) throw new Error("setup");
    expect(base.opportunity.corruptedInputs).toBe("forbidden");
    expect(base.opportunity.marginPct).toBeGreaterThan(200);
    const deps = makeDeps();
    const v = await verifyOpportunity(base.opportunity, index, undefined, deps);
    expect(v.verified).toBe(true);
    expect(deps.search).toHaveBeenCalledTimes(2); // la currency n'est pas vérifiée
    const filters = deps.search.mock.calls.map((c) => c[1].query.filters.misc_filters.filters.corrupted);
    expect(filters).toEqual([{ option: "false" }, { option: "false" }]);
    expect(v.items.map((i) => i.status)).toEqual(["verified", "unverifiable", "verified"]);
    expect(v.items[0]).toMatchObject({ role: "input", corrupted: "false", ninjaChaos: 432, tradeChaos: 1400 });
    expect(v.opportunity.inputs[0].unitChaos).toBe(1400);
    expect(v.opportunity.profitChaos).toBeCloseTo(110); // 1600 * 0.95 - 1410
    expect(v.opportunity.marginPct).toBeLessThan(10);
  });

  it("recette vendor_recipe : entrées sans filtre de corruption, sorties toujours non corrompues", async () => {
    const base = evaluateRecipe(recipe({ kind: "vendor_recipe" }), index);
    if (!base.ok) throw new Error("setup");
    expect(base.opportunity.corruptedInputs).toBe("allowed");
    const deps = makeDeps();
    const v = await verifyOpportunity(base.opportunity, index, undefined, deps);
    const [inputQ, outputQ] = deps.search.mock.calls.map((c) => c[1].query.filters.misc_filters.filters);
    expect(inputQ.corrupted).toBeUndefined();
    expect(inputQ.mutated).toEqual({ option: "false" });
    expect(outputQ.corrupted).toEqual({ option: "false" });
    expect(v.items[0].corrupted).toBe("any");
    expect(v.items[2]).toMatchObject({ role: "output", corrupted: "false" });
  });

  it("aucune annonce : prix poe.ninja conservé", async () => {
    const deps = makeDeps();
    deps.search.mockResolvedValue({ id: "x", total: 0, result: [] });
    const base = evaluateRecipe(recipe(), index);
    if (!base.ok) throw new Error("setup");
    const v = await verifyOpportunity(base.opportunity, index, undefined, deps);
    expect(v.verified).toBe(false);
    expect(v.items[0].status).toBe("no_listings");
    expect(v.opportunity.marginPct).toBeCloseTo(base.opportunity.marginPct);
  });
});
