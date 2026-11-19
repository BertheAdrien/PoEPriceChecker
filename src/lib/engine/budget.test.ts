import { describe, expect, it } from "vitest";
import { liquidityRunCap, planBudget } from "./budget";
import type { PricedItem } from "./types";

const ex = (qty: number, unitChaos: number, liquidity: number): PricedItem => ({
  item: "a", qty, unitChaos, liquidity, liquidityKind: "volumeChaos",
});
const st = (qty: number, liquidity: number): PricedItem => ({
  item: "b", qty, unitChaos: 10, liquidity, liquidityKind: "listings",
});

describe("liquidityRunCap", () => {
  it("exchange : 10 % du volume en chaos / prix / qty", () => {
    // 10% de 1000c = 100c ; /2c = 50 unités ; /5 par run = 10 runs
    expect(liquidityRunCap({ inputs: [ex(5, 2, 1000)] })).toBe(10);
  });
  it("stash : annonces / qty", () => {
    expect(liquidityRunCap({ inputs: [st(3, 10)] })).toBe(3);
  });
  it("minimum sur les entrées", () => {
    expect(liquidityRunCap({ inputs: [ex(1, 1, 10_000), st(2, 4)] })).toBe(2);
  });
});

describe("planBudget", () => {
  const o = { inputs: [ex(1, 10, 100_000)], costChaos: 10, profitChaos: 2 };
  it("masque si coût > budget", () => {
    expect(planBudget(o, 9).affordable).toBe(false);
  });
  it("runs = min(budget/coût, cap)", () => {
    expect(planBudget(o, 55)).toEqual({ affordable: true, runs: 5, totalProfitChaos: 10 });
    expect(planBudget({ ...o, inputs: [st(1, 2)] }, 1000).runs).toBe(2);
  });
});
