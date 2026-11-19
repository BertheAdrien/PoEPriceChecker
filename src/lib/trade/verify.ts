import { DEFAULT_ENGINE_CONFIG, reevaluateWithOverrides, type EngineConfig, type Opportunity, type PricedItem } from "../engine";
import type { PriceIndex } from "../prices/types";
import { searchPrice, type TradeDeps } from "./price";
import type { CorruptedFilter } from "./query";
import type { VerifiedItem, VerifyResult } from "./types";

/**
 * Vérifie une opportunité sur le trade officiel : chaque item du stash (hors Foulborn) est repricé
 * avec la médiane des annonces, puis l'opportunité est ré-évaluée. Séquentiel (le limiteur
 * sérialise de toute façon). Les items de l'exchange gardent le prix poe.ninja.
 * Corruption : les sorties sont toujours non corrompues ; les entrées le sont aussi, sauf si la
 * recette accepte les copies corrompues (`corruptedInputs: "allowed"` -> pas de filtre).
 */
export async function verifyOpportunity(
  o: Opportunity,
  index: PriceIndex,
  config: EngineConfig = DEFAULT_ENGINE_CONFIG,
  deps: Partial<TradeDeps> = {},
): Promise<VerifyResult> {
  const overrides = new Map<string, number>();
  const items: VerifiedItem[] = [];
  const inputFilter: CorruptedFilter = o.corruptedInputs === "allowed" ? "any" : "false";

  const side = async (list: PricedItem[], role: "input" | "output", corrupted: CorruptedFilter) => {
    const seen = new Set<string>();
    for (const i of list) {
      if (seen.has(i.item)) continue;
      seen.add(i.item);
      const base = { item: i.item, role, corrupted, ninjaChaos: i.unitChaos };
      const entry = index.get(i.item);
      const pending = entry && searchPrice(entry, index, index.league, deps, corrupted);
      if (!pending) {
        items.push({ ...base, status: "unverifiable" });
        continue;
      }
      const t = await pending;
      if (t.medianChaos === undefined) {
        items.push({ ...base, listings: t.listings, sampled: t.sampled, tradeUrl: t.tradeUrl, status: "no_listings" });
        continue;
      }
      if (!overrides.has(i.item)) overrides.set(i.item, t.medianChaos);
      items.push({
        ...base, tradeChaos: t.medianChaos, listings: t.listings, sampled: t.sampled,
        tradeUrl: t.tradeUrl, status: "verified",
      });
    }
  };
  await side(o.inputs, "input", inputFilter);
  await side(o.outputs, "output", "false");

  return {
    opportunity: reevaluateWithOverrides(o, overrides, index.divineChaos, config),
    items,
    verified: overrides.size > 0,
  };
}
