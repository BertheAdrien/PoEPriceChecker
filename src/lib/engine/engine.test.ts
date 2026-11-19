import { describe, expect, it } from "vitest";
import type { PriceEntry, PriceIndex } from "../prices/types";
import type { Recipe } from "../recipes/types";
import { DEFAULT_ENGINE_CONFIG, evaluateRecipe, findOpportunities, findVendorChains } from ".";

function idx(
  rows: Array<[string, number] | [string, number, number] | [string, number, number, "volumeChaos" | "listings"]>,
  divineChaos = 200,
): PriceIndex {
  const entries = new Map<string, PriceEntry>();
  for (const row of rows) {
    const [name, chaos] = row;
    const liq = row[2] ?? 10_000;
    const kind = row[3] ?? "volumeChaos";
    entries.set(name, {
      name,
      chaos,
      liquidity: liq,
      liquidityKind: kind,
      source: kind === "volumeChaos" ? "exchange" : "stash",
      category: "x",
    });
  }
  const lower = new Map([...entries].map(([n, e]) => [n.toLowerCase(), e]));
  return {
    league: "Test",
    fetchedAt: new Date(0),
    divineChaos,
    failedCategories: [],
    entries,
    get: (n) => entries.get(n) ?? lower.get(n.toLowerCase()),
  };
}

const recipe = (over: Partial<Recipe> & Pick<Recipe, "id" | "inputs" | "outputs">): Recipe => ({
  kind: "other",
  source: "test",
  verified: "ok",
  ...over,
});

const shop = (id: string, from: string, qIn: number, to: string, qOut = 1): Recipe =>
  recipe({
    id,
    kind: "vendor_shop",
    inputs: [{ item: from, qty: qIn }],
    outputs: [{ item: to, qty: qOut }],
  });

describe("evaluateRecipe", () => {
  const prices = idx([
    ["Card", 10],
    ["Big", 200],
  ]);
  const r = recipe({
    id: "r",
    kind: "div_card",
    inputs: [{ item: "Card", qty: 9 }],
    outputs: [{ item: "Big", qty: 1 }],
  });

  it("calcule coût, revenu avec marge de sécurité, profit et marge", () => {
    const res = evaluateRecipe(r, prices, { ...DEFAULT_ENGINE_CONFIG, safetyMargin: 0 });
    if (!res.ok) throw new Error("skip");
    expect(res.opportunity.costChaos).toBe(90);
    expect(res.opportunity.revenueChaos).toBe(200);
    expect(res.opportunity.profitChaos).toBe(110);
    expect(res.opportunity.marginPct).toBeCloseTo(122.22, 1);
    expect(res.opportunity.profitDivine).toBeCloseTo(0.55);
    expect(res.opportunity.inputs[0].unitChaos).toBe(10);
  });

  it("applique safetyMargin au revenu uniquement", () => {
    const res = evaluateRecipe(r, prices, { ...DEFAULT_ENGINE_CONFIG, safetyMargin: 0.1 });
    if (!res.ok) throw new Error("skip");
    expect(res.opportunity.costChaos).toBe(90);
    expect(res.opportunity.revenueChaos).toBeCloseTo(180);
    expect(res.opportunity.marginPct).toBeCloseTo(100);
  });

  it("ignore une recette dont un prix manque (jamais 0)", () => {
    const res = evaluateRecipe(r, idx([["Card", 10]]), DEFAULT_ENGINE_CONFIG);
    expect(res).toEqual({ ok: false, reason: "missing_price", item: "Big" });
  });

  it("ignore un item illiquide (volume ou annonces)", () => {
    const lowVol = idx([["Card", 10, 100], ["Big", 200]]);
    expect(evaluateRecipe(r, lowVol).ok).toBe(false);
    const lowList = idx([["Card", 10], ["Big", 200, 2, "listings"]]);
    const res = evaluateRecipe(r, lowList);
    expect(res).toEqual({ ok: false, reason: "illiquid", item: "Big" });
  });

  it("expose les deux liquidités minimales séparément", () => {
    const mixed = idx([["Card", 10, 500], ["Big", 200, 7, "listings"]]);
    const res = evaluateRecipe(r, mixed);
    if (!res.ok) throw new Error("skip");
    expect(res.opportunity.liquidity).toEqual({ minVolumeChaos: 500, minListings: 7 });
  });

  it("expose les prix de break-even (maxBuy / minSell)", () => {
    const two = recipe({
      id: "two",
      inputs: [
        { item: "Card", qty: 9 },
        { item: "Big", qty: 1 },
      ],
      outputs: [{ item: "Card", qty: 40 }],
    });
    const cfg = { ...DEFAULT_ENGINE_CONFIG, safetyMargin: 0.1 };
    const res = evaluateRecipe(two, prices, cfg);
    if (!res.ok) throw new Error("skip");
    // revenu = 40*10*0.9 = 360 ; coût = 90 + 200 = 290
    const [card, big] = res.opportunity.inputs;
    expect(card.maxBuyChaos).toBeCloseTo((360 - 200) / 9);
    expect(big.maxBuyChaos).toBeCloseTo(360 - 90);
    expect(res.opportunity.outputs[0].minSellChaos).toBeCloseTo(290 / (40 * 0.9));
    // à ce prix le profit est nul
    const flat = idx([["Card", 290 / 36], ["Big", 200]]);
    const r2 = evaluateRecipe(two, flat, cfg);
    if (!r2.ok) throw new Error("skip");
    expect(r2.opportunity.profitChaos).toBeCloseTo(40 * (290 / 36) * 0.9 - (9 * (290 / 36) + 200));
  });

  it("break-even d'une chaîne : premier input et output final", () => {
    const rs = [shop("fus", "Jeweller", 4, "Fusing"), shop("sco", "Fusing", 4, "Scouring")];
    const { opportunities } = findVendorChains(rs, idx([["Jeweller", 1], ["Scouring", 24]]), {
      ...DEFAULT_ENGINE_CONFIG,
      safetyMargin: 0,
    });
    const o = opportunities[0];
    expect(o.inputs[0].maxBuyChaos).toBeCloseTo(24 / 16);
    expect(o.outputs[0].minSellChaos).toBeCloseTo(16);
  });

  it("signale les recettes conditionnelles et non vérifiées", () => {
    const res = evaluateRecipe({ ...r, conditional: true, verified: false }, prices);
    if (!res.ok) throw new Error("skip");
    expect(res.opportunity.conditional).toBe(true);
    expect(res.opportunity.unverified).toBe(true);
  });
});

describe("findVendorChains", () => {
  const recipes = [
    shop("jew", "Alt", 2, "Jeweller"),
    shop("fus", "Jeweller", 4, "Fusing"),
    shop("sco", "Fusing", 4, "Scouring"),
  ];

  it("trouve 16 Jeweller → 4 Fusing → 1 Scouring avec les intermédiaires sans prix", () => {
    const prices = idx([
      ["Jeweller", 1],
      ["Scouring", 24],
    ]);
    const { opportunities } = findVendorChains(recipes.slice(1), prices);
    expect(opportunities).toHaveLength(1);
    const o = opportunities[0];
    expect(o.kind).toBe("vendor_chain");
    expect(o.inputs[0].qty).toBe(16);
    expect(o.outputs[0].qty).toBe(1);
    expect(o.steps?.map((s) => [s.qtyIn, s.qtyOut])).toEqual([
      [16, 4],
      [4, 1],
    ]);
    // 24 * 0.95 = 22.8 vs 16
    expect(o.marginPct).toBeCloseTo(42.5);
  });

  it("choisit le meilleur chemin et évite les cycles", () => {
    const rs = [
      shop("a-b", "A", 1, "B"),
      shop("b-d", "B", 1, "D"),
      shop("a-c", "A", 1, "C"),
      shop("c-d", "C", 1, "D"),
      shop("d-a", "D", 1, "A"), // cycle
      shop("a-d", "A", 1, "D"), // direct : 1 étape, ignoré
    ];
    const prices = idx([["A", 10], ["D", 20], ["B", 1], ["C", 1]]);
    const { opportunities } = findVendorChains(rs, prices);
    const ad = opportunities.filter((o) => o.steps![0].from === "A" && o.outputs[0].item === "D");
    expect(ad).toHaveLength(1); // une seule par paire
    expect(opportunities.every((o) => new Set(o.steps!.map((s) => s.from)).size === o.steps!.length)).toBe(true);
    // aucun chemin ne revient sur le départ
    expect(opportunities.some((o) => o.inputs[0].item === o.outputs[0].item)).toBe(false);
  });

  it("prefere le chemin à la meilleure marge entre deux chemins parallèles", () => {
    const rs = [
      shop("a-b", "A", 1, "B"),
      shop("b-d", "B", 1, "D"),
      shop("a-c", "A", 2, "C"),
      shop("c-d", "C", 1, "D"),
    ];
    // via B : 1 A -> 1 D ; via C : 2 A -> 1 D. Meilleur = via B.
    const { opportunities } = findVendorChains(rs, idx([["A", 10], ["D", 30]]));
    const o = opportunities.find((x) => x.outputs[0].item === "D")!;
    expect(o.id).toBe("chain:a-b>b-d");
  });

  it("compte les paires sans prix", () => {
    const { opportunities, skipped } = findVendorChains(recipes.slice(1), idx([["Jeweller", 1]]));
    expect(opportunities).toHaveLength(0);
    expect(skipped.missing_price).toBe(1);
  });
});

describe("findOpportunities", () => {
  it("trie par marge décroissante et compte les skips", () => {
    const prices = idx([
      ["A", 10],
      ["B", 30],
      ["C", 15],
    ]);
    const rs = [
      recipe({ id: "low", inputs: [{ item: "A", qty: 1 }], outputs: [{ item: "C", qty: 1 }] }),
      recipe({ id: "high", inputs: [{ item: "A", qty: 1 }], outputs: [{ item: "B", qty: 1 }] }),
      recipe({ id: "none", inputs: [{ item: "A", qty: 1 }], outputs: [{ item: "Z", qty: 1 }] }),
    ];
    const res = findOpportunities(prices, rs);
    expect(res.opportunities.map((o) => o.id)).toEqual(["high", "low"]);
    expect(res.skipped).toEqual({ missing_price: 1, illiquid: 0 });
  });
});
