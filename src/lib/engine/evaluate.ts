import type { PriceIndex } from "../prices/types";
import type { Recipe, RecipeItem } from "../recipes/types";
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from "./config";
import type { ChainStep, EvalResult, Opportunity, OpportunityKind, PricedItem } from "./types";

export interface TradeSpec {
  id: string;
  kind: OpportunityKind;
  inputs: RecipeItem[];
  outputs: RecipeItem[];
  conditional?: boolean;
  unverified?: boolean;
  sources: string[];
  steps?: ChainStep[];
  label?: string;
}

const sideLabel = (items: RecipeItem[]) => items.map((i) => `${i.qty}× ${i.item}`).join(" + ");

type Side =
  | { ok: true; items: PricedItem[] }
  | { ok: false; reason: "missing_price" | "illiquid"; item: string };

/** Prix + liquidité d'une liste d'items ; un prix manquant l'emporte sur l'illiquidité. */
function priceSide(items: RecipeItem[], prices: PriceIndex, config: EngineConfig): Side {
  const out: PricedItem[] = [];
  let illiquid: string | undefined;
  for (const { item, qty } of items) {
    const p = prices.get(item);
    if (!p || !(p.chaos > 0) || !Number.isFinite(p.chaos)) {
      return { ok: false, reason: "missing_price", item };
    }
    const enough =
      p.liquidityKind === "volumeChaos"
        ? p.liquidity >= config.minVolumeChaos
        : p.liquidity >= config.minListings;
    if (!enough) illiquid ??= item;
    out.push({
      item,
      qty,
      unitChaos: p.chaos,
      liquidity: p.liquidity,
      liquidityKind: p.liquidityKind,
    });
  }
  if (illiquid) return { ok: false, reason: "illiquid", item: illiquid };
  return { ok: true, items: out };
}

export function evaluateTrade(
  spec: TradeSpec,
  prices: PriceIndex,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): EvalResult {
  if (spec.inputs.length === 0 || spec.outputs.length === 0) {
    return { ok: false, reason: "missing_price", item: "(vide)" };
  }
  const ins = priceSide(spec.inputs, prices, config);
  const outs = priceSide(spec.outputs, prices, config);
  if (!ins.ok && ins.reason === "missing_price") return ins;
  if (!outs.ok && outs.reason === "missing_price") return outs;
  if (!ins.ok) return ins;
  if (!outs.ok) return outs;

  const cost = ins.items.reduce((s, i) => s + i.qty * i.unitChaos, 0);
  const gross = outs.items.reduce((s, i) => s + i.qty * i.unitChaos, 0);
  const revenue = gross * (1 - config.safetyMargin);
  const profit = revenue - cost;

  const keep = 1 - config.safetyMargin;
  for (const i of ins.items) i.maxBuyChaos = (revenue - (cost - i.qty * i.unitChaos)) / i.qty;
  for (const o of outs.items) {
    const othersNet = (gross - o.qty * o.unitChaos) * keep;
    o.minSellChaos = (cost - othersNet) / (o.qty * keep);
  }

  const all = [...ins.items, ...outs.items];
  const vols = all.filter((i) => i.liquidityKind === "volumeChaos").map((i) => i.liquidity);
  const lists = all.filter((i) => i.liquidityKind === "listings").map((i) => i.liquidity);

  const opportunity: Opportunity = {
    id: spec.id,
    kind: spec.kind,
    label: spec.label ?? `${sideLabel(spec.inputs)} → ${sideLabel(spec.outputs)}`,
    inputs: ins.items,
    outputs: outs.items,
    costChaos: cost,
    revenueChaos: revenue,
    profitChaos: profit,
    profitDivine: profit / prices.divineChaos,
    marginPct: (profit / cost) * 100,
    liquidity: {
      minVolumeChaos: vols.length ? Math.min(...vols) : undefined,
      minListings: lists.length ? Math.min(...lists) : undefined,
    },
    trendPct: prices.get(spec.outputs[0].item)?.trendPct,
    steps: spec.steps,
    conditional: spec.conditional ?? false,
    unverified: spec.unverified ?? false,
    sources: spec.sources,
  };
  return { ok: true, opportunity };
}

export function evaluateRecipe(
  recipe: Recipe,
  prices: PriceIndex,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): EvalResult {
  return evaluateTrade(
    {
      id: recipe.id,
      kind: recipe.kind,
      inputs: recipe.inputs,
      outputs: recipe.outputs,
      conditional: recipe.conditional,
      unverified: recipe.verified === false,
      sources: [recipe.source],
    },
    prices,
    config,
  );
}
