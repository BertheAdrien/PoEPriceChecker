import type { PriceEntry } from "../prices/types";
import type { TradeQuery } from "./types";

/** `any` : copies corrompues et non corrompues (le moins cher des deux). */
export type CorruptedFilter = "false" | "any";

/** poe.ninja liste les copies Foulborn (mutated) sous « Foulborn <nom> » : jamais vérifiées. */
export const isFoulborn = (name: string) => name.startsWith("Foulborn ");

/**
 * Requête de recherche trade pour une ligne poe.ninja, ou undefined si elle n'est pas vérifiable
 * (exchange : currency, cartes, fragments… ; Foulborn).
 * Uniques : nom + type de base (nom seul si le type est inconnu) ; autres items du stash : type seul.
 * Toujours : annonces `securable` (achat instantané), non muté. Corruption : `corrupted: "false"` par
 * défaut ; `"any"` (entrée d'une recette qui accepte les objets corrompus) = pas de filtre.
 */
export function buildTradeQuery(e: PriceEntry, corrupted: CorruptedFilter = "false"): TradeQuery | undefined {
  if (e.source !== "stash" || isFoulborn(e.name)) return undefined;
  const unique = e.category.startsWith("Unique");
  const naming: { name?: string; type?: string } = !unique
    ? { type: e.name }
    : e.baseType
      ? { name: e.name, type: e.baseType }
      : { name: e.name };
  return {
    query: {
      status: { option: "securable" },
      ...naming,
      filters: {
        misc_filters: {
          filters: {
            ...(corrupted === "false" ? { corrupted: { option: "false" } } : {}),
            mutated: { option: "false" },
          },
        },
      },
    },
    sort: { price: "asc" },
  };
}

export function buildSearchUrl(league: string, query: TradeQuery): string {
  return `https://www.pathofexile.com/trade/search/${encodeURIComponent(league)}?q=${encodeURIComponent(JSON.stringify(query))}`;
}
