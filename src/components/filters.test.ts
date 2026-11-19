import { describe, expect, it } from "vitest";
import type { Opportunity } from "@/lib/engine/types";
import { num, passesPrice, passesStatic, planFor, type Filters } from "./filters";

const base: Filters = {
  kind: "all",
  showConditional: false,
  minMarginPct: 0,
  minTotalProfit: 0,
  minVolumeChaos: 0,
  minListings: 0,
};

// 4 Fusing (0,1c, volume 80 000c) → 1 Scouring : 0,17c/run, plafond 10 % × 80 000 / 0,1 / 4 = 20 000 runs.
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

// Unique du stash : 50c/run, 3 annonces → 3 runs.
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

describe("profit total min", () => {
  it("sans budget : runs plafonnés par la liquidité", () => {
    expect(planFor(cheap, undefined)).toMatchObject({ affordable: true, runs: 20_000 });
    expect(passes(cheap, { minTotalProfit: 3000 })).toBe(true);
    expect(passes(cheap, { minTotalProfit: 4000 })).toBe(false);
    expect(passes(stash, { minTotalProfit: 150 })).toBe(true);
    expect(passes(stash, { minTotalProfit: 151 })).toBe(false);
  });
  it("avec budget : runs plafonnés par le budget", () => {
    // 10c → 25 runs × 0,17c = 4,25c
    expect(passes(cheap, { budgetChaos: 10, minTotalProfit: 4 })).toBe(true);
    expect(passes(cheap, { budgetChaos: 10, minTotalProfit: 5 })).toBe(false);
  });
  it("trop cher pour le budget → masqué", () => {
    expect(passes(stash, { budgetChaos: 200 })).toBe(false);
  });
  it("s'applique aux valeurs vérifiées (faux positif masqué)", () => {
    const verified = { ...stash, marginPct: -10, profitChaos: -25 } as Opportunity;
    expect(passesPrice(verified, planFor(verified, undefined), { ...base, minTotalProfit: 1 })).toBe(false);
  });
});

describe("liquidité", () => {
  it("volume et annonces filtrés séparément", () => {
    expect(passes(stash, { minVolumeChaos: 1_000_000 })).toBe(true);
    expect(passes(stash, { minListings: 4 })).toBe(false);
    expect(passes(cheap, { minListings: 1000 })).toBe(true);
    expect(passes(cheap, { minVolumeChaos: 100_000 })).toBe(false);
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
