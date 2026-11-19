import type { Opportunity, PricedItem } from "../engine/types";
import type { PriceEntry } from "../prices/types";
import { buildSearchUrl, buildTradeQuery, type CorruptedFilter } from "./query";

export interface TradeLink {
  role: "input" | "output";
  item: string;
  /** "Achat: X" / "Vente: Y". */
  label: string;
  url: string;
}

/**
 * Liens de recherche trade filtrés (mêmes requêtes que la vérification) pour chaque item du stash
 * d'une opportunité. Entrées : pas de filtre corrompu si la recette l'accepte ; sorties : toujours
 * non corrompues. Aucun lien pour l'exchange (currency, cartes, fragments…) ni Foulborn.
 */
export function buildOpportunityLinks(
  o: Pick<Opportunity, "inputs" | "outputs" | "corruptedInputs">,
  league: string,
  get: (name: string) => PriceEntry | undefined,
): TradeLink[] {
  const links: TradeLink[] = [];
  const side = (list: PricedItem[], role: "input" | "output", corrupted: CorruptedFilter) => {
    const seen = new Set<string>();
    for (const i of list) {
      if (seen.has(i.item)) continue;
      seen.add(i.item);
      const e = get(i.item);
      const q = e && buildTradeQuery(e, corrupted);
      if (!q) continue;
      links.push({
        role,
        item: i.item,
        label: `${role === "input" ? "Achat" : "Vente"}: ${i.item}`,
        url: buildSearchUrl(league, q),
      });
    }
  };
  side(o.inputs, "input", o.corruptedInputs === "allowed" ? "any" : "false");
  side(o.outputs, "output", "false");
  return links;
}
