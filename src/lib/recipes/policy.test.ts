import { describe, expect, it } from "vitest";
import { recipeSchema } from "./schema";
import { corruptedInputPolicy } from "./policy";

describe("corruptedInputPolicy", () => {
  it("défaut selon le kind", () => {
    expect(corruptedInputPolicy({ kind: "vendor_recipe" })).toBe("allowed");
    expect(corruptedInputPolicy({ kind: "other" })).toBe("forbidden");
    for (const kind of ["div_card", "fragment_set", "vendor_shop"] as const) {
      expect(corruptedInputPolicy({ kind })).toBe("forbidden");
    }
  });
  it("la surcharge explicite l'emporte", () => {
    expect(corruptedInputPolicy({ kind: "other", corruptedInputs: "allowed" })).toBe("allowed");
    expect(corruptedInputPolicy({ kind: "vendor_recipe", corruptedInputs: "forbidden" })).toBe("forbidden");
  });
  it("le schéma accepte / rejette le champ", () => {
    const base = {
      id: "x", kind: "other", inputs: [{ item: "A", qty: 1 }], outputs: [{ item: "B", qty: 1 }],
      source: "s", verified: false,
    };
    expect(recipeSchema.parse({ ...base, corruptedInputs: "allowed" }).corruptedInputs).toBe("allowed");
    expect(recipeSchema.parse(base).corruptedInputs).toBeUndefined();
    expect(() => recipeSchema.parse({ ...base, corruptedInputs: "maybe" })).toThrow();
  });
});
