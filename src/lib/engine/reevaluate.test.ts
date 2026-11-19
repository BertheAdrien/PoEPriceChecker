import { describe, expect, it } from "vitest";
import type { PriceEntry, PriceIndex } from "../prices/types";
import type { Recipe } from "../recipes/types";
import { DEFAULT_ENGINE_CONFIG, evaluateRecipe, reevaluateWithOverrides } from ".";

function idx(rows: Array<[string, number]>): PriceIndex {
  const entries = new Map<string, PriceEntry>();
  for (const [name, chaos] of rows) {
    entries.set(name, { name, chaos, liquidity: 50, liquidityKind: "listings", source: "stash", category: "UniqueJewel" });
  }
  return { league: "Test", fetchedAt: new Date(0), divineChaos: 200, entries, get: (n) => entries.get(n) };
}

const recipe: Recipe = {
  id: "red-nightmare-1",
  kind: "vendor_recipe",
  inputs: [{ item: "Red Dream", qty: 1 }, { item: "Flesh", qty: 1 }],
  outputs: [{ item: "Red Nightmare", qty: 1 }],
  source: "test",
} as Recipe;

describe("reevaluateWithOverrides", () => {
  const prices = idx([["Red Dream", 400], ["Flesh", 10], ["Red Nightmare", 1600]]);
  const base = evaluateRecipe(recipe, prices);
  if (!base.ok) throw new Error("setup");
  const o = base.opportunity;

  it("sans surcharge : même résultat", () => {
    const r = reevaluateWithOverrides(o, new Map(), prices.divineChaos);
    expect(r.profitChaos).toBeCloseTo(o.profitChaos);
    expect(r.marginPct).toBeCloseTo(o.marginPct);
    expect(r.inputs[0].maxBuyChaos).toBeCloseTo(o.inputs[0].maxBuyChaos!);
  });

  it("prix trade : marge recalculée avec la marge de sécurité", () => {
    const r = reevaluateWithOverrides(
      o,
      new Map([["Red Dream", 1400], ["Red Nightmare", 1600]]),
      prices.divineChaos,
    );
    const keep = 1 - DEFAULT_ENGINE_CONFIG.safetyMargin;
    expect(r.costChaos).toBe(1410);
    expect(r.revenueChaos).toBeCloseTo(1600 * keep);
    expect(r.profitChaos).toBeCloseTo(1600 * keep - 1410);
    expect(r.profitChaos).toBeGreaterThan(0);
    expect(r.marginPct).toBeCloseTo((r.profitChaos / 1410) * 100);
    // seuil de vente min : profit = 0 à ce prix
    expect(r.outputs[0].minSellChaos).toBeCloseTo(1410 / keep);
  });

  it("faux positif : profit <= 0 une fois vérifié", () => {
    const r = reevaluateWithOverrides(o, new Map([["Red Dream", 1700]]), prices.divineChaos);
    expect(r.profitChaos).toBeLessThan(0);
  });

  it("surcharge invalide ignorée, entrée non mutée", () => {
    const r = reevaluateWithOverrides(o, new Map([["Red Dream", 0], ["Flesh", NaN]]), prices.divineChaos);
    expect(r.costChaos).toBe(410);
    expect(o.inputs[0].unitChaos).toBe(400);
    expect(r.id).toBe(o.id);
  });
});
