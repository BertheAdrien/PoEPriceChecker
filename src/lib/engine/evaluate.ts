import type { PriceIndex } from "../prices/types";
import { corruptedInputPolicy } from "../recipes/policy";
import type { Recipe, RecipeItem } from "../recipes/types";
import { DEFAULT_ENGINE_CONFIG, type EngineConfig } from "./config";
import type { ChainStep, EvalResult, Opportunity, OpportunityKind, PricedItem } from "./types";

export interface TradeSpec {
  id: string;
  kind: OpportunityKind;
  inputs: RecipeItem[];
  outputs: RecipeItem[];
  conditional?: boolean;
  corruptedInputs?: "allowed" | "forbidden";
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

  return {
    ok: true,
    opportunity: assemble(
      {
        id: spec.id,
        kind: spec.kind,
        label: spec.label ?? `${sideLabel(spec.inputs)} → ${sideLabel(spec.outputs)}`,
        conditional: spec.conditional ?? false,
        corruptedInputs: spec.corruptedInputs,
        unverified: spec.unverified ?? false,
        sources: spec.sources,
        steps: spec.steps,
        trendPct: prices.get(spec.outputs[0].item)?.trendPct,
      },
      ins.items,
      outs.items,
      prices.divineChaos,
      config,
    ),
  };
}

type OpportunityMeta = Pick<
  Opportunity,
  "id" | "kind" | "label" | "conditional" | "corruptedInputs" | "unverified" | "sources" | "steps" | "trendPct"
>;

/** Coût, revenu, marge, seuils et liquidité à partir d'items déjà valorisés (logique commune). */
function assemble(
  meta: OpportunityMeta,
  inputs: PricedItem[],
  outputs: PricedItem[],
  divineChaos: number,
  config: EngineConfig,
): Opportunity {
  const cost = inputs.reduce((s, i) => s + i.qty * i.unitChaos, 0);
  const gross = outputs.reduce((s, i) => s + i.qty * i.unitChaos, 0);
  const revenue = gross * (1 - config.safetyMargin);
  const profit = revenue - cost;

  const keep = 1 - config.safetyMargin;
  for (const i of inputs) i.maxBuyChaos = (revenue - (cost - i.qty * i.unitChaos)) / i.qty;
  for (const o of outputs) {
    const othersNet = (gross - o.qty * o.unitChaos) * keep;
    o.minSellChaos = (cost - othersNet) / (o.qty * keep);
  }

  const all = [...inputs, ...outputs];
  const vols = all.filter((i) => i.liquidityKind === "volumeChaos").map((i) => i.liquidity);
  const lists = all.filter((i) => i.liquidityKind === "listings").map((i) => i.liquidity);

  return {
    ...meta,
    inputs,
    outputs,
    costChaos: cost,
    revenueChaos: revenue,
    profitChaos: profit,
    profitDivine: profit / divineChaos,
    marginPct: (profit / cost) * 100,
    liquidity: {
      minVolumeChaos: vols.length ? Math.min(...vols) : undefined,
      minListings: lists.length ? Math.min(...lists) : undefined,
    },
  };
}

/**
 * Ré-évalue une opportunité avec d'autres prix unitaires (nom d'item -> chaos), par ex. des prix
 * vérifiés sur le trade. Même logique de seuil que `evaluateTrade` ; liquidité et métadonnées inchangées.
 * Une surcharge non finie ou <= 0 est ignorée.
 */
export function reevaluateWithOverrides(
  o: Opportunity,
  overrides: ReadonlyMap<string, number>,
  divineChaos: number,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
): Opportunity {
  const reprice = (i: PricedItem): PricedItem => {
    const p = overrides.get(i.item);
    const copy: PricedItem = { ...i };
    delete copy.maxBuyChaos;
    delete copy.minSellChaos;
    if (p !== undefined && Number.isFinite(p) && p > 0) copy.unitChaos = p;
    return copy;
  };
  const { id, kind, label, conditional, corruptedInputs, unverified, sources, steps, trendPct } = o;
  return assemble(
    { id, kind, label, conditional, corruptedInputs, unverified, sources, steps, trendPct },
    o.inputs.map(reprice),
    o.outputs.map(reprice),
    divineChaos,
    config,
  );
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
      corruptedInputs: corruptedInputPolicy(recipe),
      unverified: recipe.verified === false,
      sources: [recipe.source],
    },
    prices,
    config,
  );
}
