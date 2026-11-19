import { describe, expect, it } from "vitest";
import type { Opportunity } from "@/lib/engine/types";
import { compareRows, nextSort, type SortableRow } from "./sort";

const row = (marginPct: number, extra: Partial<Opportunity> = {}): SortableRow => ({
  eff: { marginPct, profitChaos: marginPct, costChaos: 100 - marginPct, liquidity: {}, ...extra } as Opportunity,
});

describe("compareRows", () => {
  it("trie par marge desc / asc", () => {
    const rs = [row(10), row(50), row(30)];
    expect([...rs].sort(compareRows("margin", "desc")).map((r) => r.eff.marginPct)).toEqual([50, 30, 10]);
    expect([...rs].sort(compareRows("margin", "asc")).map((r) => r.eff.marginPct)).toEqual([10, 30, 50]);
  });
  it("valeurs inconnues toujours en dernier", () => {
    const rs = [row(1, { trendPct: undefined }), row(2, { trendPct: 5 }), row(3, { trendPct: -5 })];
    expect([...rs].sort(compareRows("trend", "desc")).map((r) => r.eff.marginPct)).toEqual([2, 3, 1]);
    expect([...rs].sort(compareRows("trend", "asc")).map((r) => r.eff.marginPct)).toEqual([3, 2, 1]);
  });
  it("coût croissant", () => {
    const rs = [row(10), row(50)];
    expect([...rs].sort(compareRows("cost", "asc")).map((r) => r.eff.marginPct)).toEqual([50, 10]);
  });
});

describe("nextSort", () => {
  it("inverse sur la même colonne, desc sur une nouvelle", () => {
    expect(nextSort({ key: "margin", dir: "desc" }, "margin")).toEqual({ key: "margin", dir: "asc" });
    expect(nextSort({ key: "margin", dir: "asc" }, "cost")).toEqual({ key: "cost", dir: "desc" });
  });
});
