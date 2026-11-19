import { describe, expect, it } from "vitest";
import { applyOverrides, loadRecipes, loadYamlRecipes, mergeRecipes, parseRecipesYaml } from "./load";
import type { Recipe } from "./types";

describe("data/recipes.yaml", () => {
  const recipes = loadYamlRecipes();

  it("est valide et sans id dupliqué", () => {
    expect(recipes.length).toBeGreaterThan(0);
  });

  it("contient la recette Lost Unity (5 Will)", () => {
    const r = recipes.find((x) => x.id === "lost-unity-vendor-recipe");
    expect(r?.kind).toBe("vendor_recipe");
    expect(r?.inputs).toHaveLength(5);
  });

  it("accepte verified: false", () => {
    expect(recipes.find((x) => x.id === "vendor-transmutation")?.verified).toBe(false);
  });
});

describe("parseRecipesYaml", () => {
  it("rejette un kind inconnu", () => {
    const bad = `- id: x\n  kind: nope\n  inputs: [{ item: A, qty: 1 }]\n  outputs: [{ item: B, qty: 1 }]\n  source: s\n  verified: false\n`;
    expect(() => parseRecipesYaml(bad)).toThrow();
  });

  it("rejette une quantité nulle", () => {
    const bad = `- id: x\n  kind: other\n  inputs: [{ item: A, qty: 0 }]\n  outputs: [{ item: B, qty: 1 }]\n  source: s\n  verified: false\n`;
    expect(() => parseRecipesYaml(bad)).toThrow();
  });

  it("rejette les ids dupliqués", () => {
    const one = `- id: x\n  kind: other\n  inputs: [{ item: A, qty: 1 }]\n  outputs: [{ item: B, qty: 1 }]\n  source: s\n  verified: false\n`;
    expect(() => parseRecipesYaml(one + one)).toThrow();
  });
});

describe("mergeRecipes", () => {
  const mk = (id: string, source: string, out = "B"): Recipe => ({
    id,
    kind: "other",
    inputs: [{ item: "A", qty: 1 }],
    outputs: [{ item: out, qty: 1 }],
    source,
    verified: false,
  });
  it("le YAML gagne sur une collision d'id", () => {
    const merged = mergeRecipes([mk("a", "yaml")], [mk("a", "wiki", "C"), mk("b", "wiki", "D")]);
    expect(merged).toHaveLength(2);
    expect(merged.find((r) => r.id === "a")?.source).toBe("yaml");
  });

  it("écarte une recette wiki identique (entrées/sorties) à une recette YAML", () => {
    const merged = mergeRecipes([mk("y", "yaml")], [mk("w", "wiki")]);
    expect(merged.map((r) => r.id)).toEqual(["y"]);
  });
});

describe("recipe overrides", () => {
  const base = { id: "a", kind: "other" as const, inputs: [{ item: "X", qty: 1 }], outputs: [{ item: "Y", qty: 1 }], source: "s", verified: false as const };
  it("applique corruptedInputs par id", () => {
    const [r] = applyOverrides([base], [{ id: "a", corruptedInputs: "allowed", source: "w", verified: "d" }]);
    expect(r.corruptedInputs).toBe("allowed");
  });
  it("refuse un id inconnu", () => {
    expect(() => applyOverrides([base], [{ id: "zz", source: "w", verified: false }])).toThrow(/inconnue/);
  });
  it("le vrai fichier d'overrides est valide et ses ids existent", () => {
    expect(() => loadRecipes()).not.toThrow();
  });
});
