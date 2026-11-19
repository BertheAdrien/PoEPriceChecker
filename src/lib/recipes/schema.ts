import { z } from "zod";
import type { Recipe } from "./types";

export const recipeKindSchema = z.enum([
  "vendor_shop",
  "vendor_recipe",
  "div_card",
  "fragment_set",
  "other",
]);

export const recipeItemSchema = z.object({
  item: z.string().min(1),
  qty: z.number().int().positive(),
});

export const recipeSchema = z.object({
  id: z.string().min(1),
  kind: recipeKindSchema,
  inputs: z.array(recipeItemSchema).min(1),
  outputs: z.array(recipeItemSchema).min(1),
  vendor: z.string().optional(),
  source: z.string().min(1),
  verified: z.union([z.string().min(1), z.literal(false)]),
  conditional: z.boolean().optional(),
  corruptedInputs: z.enum(["allowed", "forbidden"]).optional(),
  notes: z.string().optional(),
}) satisfies z.ZodType<Recipe>;

export const recipeListSchema = z.array(recipeSchema).superRefine((list, ctx) => {
  const seen = new Set<string>();
  list.forEach((r, i) => {
    if (seen.has(r.id)) ctx.addIssue({ code: "custom", path: [i, "id"], message: `id dupliqué : ${r.id}` });
    seen.add(r.id);
  });
});
