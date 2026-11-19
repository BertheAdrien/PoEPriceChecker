import { describe, expect, it } from "vitest";
import { buildWikiRecipes, classify, cleanText, parseWikiRows } from "./wiki";

const recipe = (page: string, id: string, description: string | null, amount = "1") => ({
  page,
  "recipe id": id,
  description,
  "result amount": amount,
  automatic: "0",
});
const part = (page: string, id: string, n: string, name: string, amount: string, notes: string | null = null) => ({
  page,
  "recipe id": id,
  "part id": n,
  "item name": name,
  amount,
  notes,
});

const cards = new Set(["House of Mirrors", "The Gambler", "Dying Anguish"]);

describe("cleanText", () => {
  it("retire le HTML échappé, décode les entités et les liens wiki", () => {
    expect(cleanText("1x &lt;span class=&quot;tc -card&quot;&gt;House of Mirrors&lt;/span&gt;")).toBe(
      "1x House of Mirrors",
    );
    expect(cleanText("Emperor&#039;s Luck")).toBe("Emperor's Luck");
    expect(cleanText("Can be of any [[rarity|Rarity]] [[item]].")).toBe("Can be of any Rarity item.");
    expect(cleanText(null)).toBe("");
  });
});

describe("parseWikiRows", () => {
  it("joint sur (page, recipe id) et ordonne les parts", () => {
    const parsed = parseWikiRows(
      [recipe("Lost Unity", "1", "Vendor recipe"), recipe("Other", "1", null)],
      [
        part("Lost Unity", "1", "2", "The Will of Tul", "1"),
        part("Lost Unity", "1", "1", "The Will of Xoph", "1"),
        part("Other", "1", "1", "Z", "3"),
      ],
    );
    expect(parsed).toHaveLength(2);
    expect(parsed[0].parts.map((p) => p.name)).toEqual(["The Will of Xoph", "The Will of Tul"]);
    expect(parsed[1].parts[0].qty).toBe(3);
  });
});

describe("classify", () => {
  const one = (page: string, desc: string | null, parts: ReturnType<typeof part>[], amount = "1") =>
    parseWikiRows(
      [recipe(page, "1", desc, amount)],
      parts.map((p) => ({ ...p, page })),
    )[0];

  it("vendor_recipe", () => {
    const r = one("Lost Unity", "Vendor recipe", [part("Lost Unity", "1", "1", "The Sundered Will", "1")]);
    expect(classify(r, cards)).toMatchObject({ kind: "vendor_recipe", conditional: false });
  });

  it("div_card : une seule part qui est une carte", () => {
    const r = one("Mirror of Kalandra", "1x Mirror of Kalandra", [
      part("Mirror of Kalandra", "1", "1", "House of Mirrors", "9"),
    ]);
    const c = classify(r, cards);
    expect(c).toMatchObject({ kind: "div_card", conditional: false });
    expect("notes" in c && c.notes).toBeFalsy();
  });

  it("fragment_set : N splinters/shards -> 1 item", () => {
    const r = one("Simulacrum", null, [part("Simulacrum", "1", "1", "Simulacrum Splinter", "300")]);
    expect(classify(r, cards)).toMatchObject({ kind: "fragment_set" });
  });

  it("other par défaut", () => {
    const r = one("Colossal Life Flask", null, [part("x", "1", "1", "Giant Life Flask", "3")]);
    expect(classify(r, cards)).toMatchObject({ kind: "other" });
  });

  it("conditional : corrompu / qualité / niveau / liens", () => {
    const r = one("Divinarius", "Two-implicit corrupted Divinarius", [
      part("x", "1", "1", "Assassin's Gift", "9"),
    ]);
    expect(classify(r, cards)).toMatchObject({ conditional: true });
    const q = one("Combat Focus", "Vendor recipe", [
      part("x", "1", "1", "Elemental Hit", "1", "20% quality."),
    ]);
    expect(classify(q, cards)).toMatchObject({ kind: "vendor_recipe", conditional: true });
  });

  it("écarte aléatoire, prix de vente, parts avec HTML ou or, sans parts", () => {
    const p = [part("x", "1", "1", "The Gambler", "5")];
    expect(classify(one("A", "Random divination card", p), cards)).toEqual({ dropped: "random_output" });
    expect(classify(one("A", "Random divination card set exchange", p), cards)).toEqual({
      dropped: "random_output",
    });
    expect(classify(one("A", "Part of sell price", p), cards)).toEqual({ dropped: "not_conversion" });
    expect(classify(one("A", null, [part("x", "1", "1", "<b>Gold</b>", "5")]), cards)).toEqual({
      dropped: "bad_part",
    });
    expect(classify(one("A", null, [part("x", "1", "1", "Gold", "5")]), cards)).toEqual({
      dropped: "bad_part",
    });
    expect(classify(one("A", null, []), cards)).toEqual({ dropped: "no_parts" });
    expect(classify(one("Map (Tier 5)", "Tier 5 map", p), cards)).toEqual({ dropped: "generic_output" });
  });
});

describe("buildWikiRecipes", () => {
  const rows = {
    recipes: [
      recipe("Lost Unity", "1", "Vendor recipe"),
      recipe("Mirror of Kalandra", "2", "1x Mirror of Kalandra"),
      recipe("Bone Offering", "1", "Empower, Enhance or Enlighten"),
      recipe("Enhance Support", "2", "Empower, Enhance or Enlighten"),
      recipe("Orb of Regret", "1", "10x Orb of Regret", "10"),
    ],
    parts: [
      part("Lost Unity", "1", "1", "The Will of Xoph", "1"),
      part("Lost Unity", "1", "2", "The Sundered Will", "1"),
      part("Mirror of Kalandra", "2", "1", "House of Mirrors", "9"),
      part("Bone Offering", "1", "1", "Gemcutter&#039;s Mercy", "3"),
      part("Enhance Support", "2", "1", "Gemcutter&#039;s Mercy", "3"),
      part("Orb of Regret", "1", "1", "Vinia&#039;s Token", "5"),
    ],
    divCards: ["House of Mirrors", "Vinia's Token"],
    date: "2026-11-19",
  };

  it("produit des recettes triées, sourcées et datées ; écarte les tirages (même entrée -> plusieurs sorties)", () => {
    const { recipes, dropped } = buildWikiRecipes(rows);
    expect(recipes.map((r) => r.id)).toEqual(["lost-unity-1", "mirror-of-kalandra-2", "orb-of-regret-1"]);
    expect(dropped).toEqual({ output_pool: 2 });
    const lu = recipes[0];
    expect(lu.kind).toBe("vendor_recipe");
    expect(lu.verified).toBe("2026-11-19 (wiki)");
    expect(lu.source).toBe("https://www.poewiki.net/wiki/Lost_Unity");
    expect(recipes[2]).toMatchObject({
      kind: "div_card",
      inputs: [{ item: "Vinia's Token", qty: 5 }],
      outputs: [{ item: "Orb of Regret", qty: 10 }],
    });
  });

  it("est déterministe", () => {
    expect(buildWikiRecipes(rows)).toEqual(buildWikiRecipes({ ...rows, recipes: [...rows.recipes].reverse() }));
  });
});
