import { describe, expect, it } from "vitest";
import { buildTradeUrl } from "./trade";
import type { PriceEntry } from "./types";

const base: PriceEntry = {
  name: "Headhunter", chaos: 1, liquidity: 5, liquidityKind: "listings",
  source: "stash", category: "UniqueAccessory", baseType: "Leather Belt",
};

describe("buildTradeUrl", () => {
  it("uniques : nom + type de base", () => {
    const u = buildTradeUrl("Covens", base)!;
    expect(u.startsWith("https://www.pathofexile.com/trade/search/Covens?q=")).toBe(true);
    const q = JSON.parse(decodeURIComponent(u.split("?q=")[1]));
    expect(q.query).toMatchObject({ name: "Headhunter", type: "Leather Belt" });
  });
  it("pas de lien pour l'exchange", () => {
    expect(buildTradeUrl("Covens", { ...base, source: "exchange" })).toBeUndefined();
  });
});
