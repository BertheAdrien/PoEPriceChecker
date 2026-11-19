import type { PriceEntry } from "./types";

/**
 * Lien de recherche trade officiel pour un item du trade classique (stash poe.ninja).
 * Aucun lien pour la currency / les items de l'exchange (Currency Exchange en jeu).
 * Les lignes poe.ninja actuelles n'ont pas de `tradeFilter` : on cherche par nom (+ type de base
 * pour les uniques), en ligne.
 */
export function buildTradeUrl(league: string, e: PriceEntry): string | undefined {
  if (e.source !== "stash") return undefined;
  const unique = e.category.startsWith("Unique");
  const query = unique && e.baseType
    ? { name: e.name, type: e.baseType }
    : { type: e.name };
  const q = { query: { status: { option: "online" }, ...query } };
  return `https://www.pathofexile.com/trade/search/${encodeURIComponent(league)}?q=${encodeURIComponent(JSON.stringify(q))}`;
}
