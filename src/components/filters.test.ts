import { describe, expect, it } from "vitest";
import type { Opportunity } from "@/lib/engine/types";
import { ESSENCE_OIL, filterKind, num, passesPrice, passesStatic, planFor, type Filters } from "./filters";

const base: Filters = { kind: "all", showConditional: false, minMarginPct: 0, minProfit: 0 };

// 4 Fusing (0,1c) → 1 Scouring : 0,17c/run.
const cheap = {
  id: "cheap",
  kind: "vendor_shop",
  conditional: false,
  marginPct: 40,
  profitChaos: 0.17,
  costChaos: 0.4,
  inputs: [{ item: "Orb of Fusing", qty: 4, unitChaos: 0.1, liquidity: 80_000, liquidityKind: "volumeChaos" }],
  liquidity: { minVolumeChaos: 80_000 },
} as unknown as Opportunity;

// Carte : 50c/run, coût 250c.
const stash = {
  id: "stash",
  kind: "div_card",
  conditional: false,
  marginPct: 20,
  profitChaos: 50,
  costChaos: 250,
  inputs: [{ item: "Card", qty: 1, unitChaos: 250, liquidity: 3, liquidityKind: "listings" }],
  liquidity: { minListings: 3 },
} as unknown as Opportunity;

const passes = (o: Opportunity, f: Partial<Filters>) => {
  const ff = { ...base, ...f };
  return passesStatic(o, ff) && passesPrice(o, planFor(o, ff.budgetChaos), ff);
};

describe("profit min (par run, colonne Profit)", () => {
  it("compare le profit par run", () => {
    expect(passes(cheap, { minProfit: 0.1 })).toBe(true);
    expect(passes(cheap, { minProfit: 1 })).toBe(false);
    expect(passes(stash, { minProfit: 50 })).toBe(true);
    expect(passes(stash, { minProfit: 51 })).toBe(false);
  });
  it("s'applique aux valeurs vérifiées (faux positif masqué)", () => {
    const verified = { ...stash, marginPct: -10, profitChaos: -25 } as Opportunity;
    expect(passesPrice(verified, planFor(verified, undefined), base)).toBe(false);
  });
});

describe("budget", () => {
  it("trop cher pour le budget → masqué", () => {
    expect(passes(stash, { budgetChaos: 200 })).toBe(false);
    expect(passes(stash, { budgetChaos: 250 })).toBe(true);
  });
  it("runs = budget / coût (quantités de la liste de courses)", () => {
    expect(planFor(cheap, 10).runs).toBe(25);
  });
});

describe("marge, type, conditionnelles", () => {
  it("marge min", () => {
    expect(passes(stash, { minMarginPct: 20 })).toBe(true);
    expect(passes(stash, { minMarginPct: 21 })).toBe(false);
  });
  it("type et conditionnelles", () => {
    expect(passes(stash, { kind: "vendor_shop" })).toBe(false);
    const cond = { ...cheap, conditional: true } as Opportunity;
    expect(passes(cond, {})).toBe(false);
    expect(passes(cond, { showConditional: true })).toBe(true);
  });
});

describe("essences et huiles (groupe dédié)", () => {
  const essence = {
    ...cheap,
    id: "ess",
    kind: "vendor_recipe",
    inputs: [{ item: "Shrieking Essence of Doubt", qty: 3 }],
    outputs: [{ item: "Deafening Essence of Doubt", qty: 1 }],
  } as unknown as Opportunity;
  const mixed = {
    ...essence,
    id: "mixed",
    inputs: [{ item: "Shrieking Essence of Doubt", qty: 3 }, { item: "Orb of Fusing", qty: 1 }],
  } as unknown as Opportunity;
  const categories = {
    "Shrieking Essence of Doubt": "Essence",
    "Deafening Essence of Doubt": "Essence",
    "Orb of Fusing": "Currency",
  };
  const kinds = (o: Opportunity, kind: string) => passesStatic(o, { ...base, kind }, categories);

  it("que des essences/huiles → filtre dédié, plus dans « Recette vendeur »", () => {
    expect(filterKind(essence, categories)).toBe(ESSENCE_OIL);
    expect(kinds(essence, ESSENCE_OIL)).toBe(true);
    expect(kinds(essence, "vendor_recipe")).toBe(false);
  });
  it("un autre item dans la recette → type d'origine", () => {
    expect(filterKind(mixed, categories)).toBe("vendor_recipe");
    expect(kinds(mixed, "vendor_recipe")).toBe(true);
  });
  it("catégories inconnues → type d'origine", () => {
    expect(filterKind(essence)).toBe("vendor_recipe");
  });
});

describe("num", () => {
  it("virgule, vide, invalide", () => {
    expect(num("1,5")).toBe(1.5);
    expect(num("")).toBe(0);
    expect(num("abc")).toBe(0);
  });
});
