import { describe, expect, it } from "vitest";
import type { Opportunity } from "../engine/types";
import type { PriceEntry } from "../prices/types";
import { effectiveOpportunity, isOverestimated } from "./effective";
import { buildOpportunityLinks } from "./links";

const entries: Record<string, PriceEntry> = {
  Jewel: { name: "Jewel", baseType: "Crimson Jewel", chaos: 1, liquidity: 9, liquidityKind: "listings", source: "stash", category: "UniqueJewel" },
  Gem: { name: "Gem", chaos: 1, liquidity: 9, liquidityKind: "listings", source: "stash", category: "SkillGem" },
  Orb: { name: "Orb", chaos: 1, liquidity: 9, liquidityKind: "volumeChaos", source: "exchange", category: "Currency" },
};
const pi = (item: string) => ({ item, qty: 1, unitChaos: 1, liquidity: 1, liquidityKind: "listings" as const });
const q = (url: string) => JSON.parse(decodeURIComponent(url.split("?q=")[1]));

describe("buildOpportunityLinks", () => {
  const get = (n: string) => entries[n];
  it("filtres selon la politique de corruption, pas de lien pour l'exchange", () => {
    const o = { inputs: [pi("Gem"), pi("Orb")], outputs: [pi("Jewel")], corruptedInputs: undefined };
    const links = buildOpportunityLinks(o, "Test League", get);
    expect(links.map((l) => l.label)).toEqual(["Achat: Gem", "Vente: Jewel"]);
    expect(links[0].url).toContain("/trade/search/Test%20League?q=");
    expect(q(links[0].url).query.filters.misc_filters.filters).toEqual({ corrupted: { option: "false" }, mutated: { option: "false" } });
    expect(q(links[1].url).query).toMatchObject({ name: "Jewel", type: "Crimson Jewel", status: { option: "securable" } });
  });
  it("entrée corrompue autorisée : pas de filtre corrompu, sortie toujours non corrompue", () => {
    const o = { inputs: [pi("Gem")], outputs: [pi("Gem")], corruptedInputs: "allowed" as const };
    const [a, b] = buildOpportunityLinks(o, "L", get);
    expect(q(a.url).query.filters.misc_filters.filters.corrupted).toBeUndefined();
    expect(q(b.url).query.filters.misc_filters.filters.corrupted).toEqual({ option: "false" });
  });
});

describe("marge effective", () => {
  const base = { id: "x", marginPct: 90, profitChaos: 10 } as Opportunity;
  it("choisit la version vérifiée", () => {
    const v = { ...base, marginPct: 20 } as Opportunity;
    expect(effectiveOpportunity(base, v)).toBe(v);
    expect(effectiveOpportunity(base)).toBe(base);
  });
  it("surestimé si < ninja / 3", () => {
    expect(isOverestimated(base, { ...base, marginPct: 29 })).toBe(true);
    expect(isOverestimated(base, { ...base, marginPct: 31 })).toBe(false);
    expect(isOverestimated(base, undefined)).toBe(false);
  });
});
