import { describe, expect, it } from "vitest";
import type { Opportunity } from "@/lib/engine/types";
import { num, passesPrice, passesStatic, planFor, type Filters } from "./filters";

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

describe("num", () => {
  it("virgule, vide, invalide", () => {
    expect(num("1,5")).toBe(1.5);
    expect(num("")).toBe(0);
    expect(num("abc")).toBe(0);
  });
});
