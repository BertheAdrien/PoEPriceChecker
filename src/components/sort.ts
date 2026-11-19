import type { Opportunity } from "@/lib/engine/types";

export type SortKey = "margin" | "profit" | "cost" | "liquidity" | "trend" | "total";
export type SortDir = "desc" | "asc";

export interface SortableRow {
  /** Opportunité effective (vérifiée si disponible, sinon poe.ninja). */
  eff: Opportunity;
  /** Trend 7 j de l'opportunité poe.ninja. */
  plan?: { totalProfitChaos: number };
}

/** Valeur de tri d'une ligne ; undefined = inconnue (toujours classée en dernier). */
export function sortValue(r: SortableRow, key: SortKey): number | undefined {
  switch (key) {
    case "margin":
      return r.eff.marginPct;
    case "profit":
      return r.eff.profitChaos;
    case "cost":
      return r.eff.costChaos;
    case "liquidity":
      return r.eff.liquidity.minVolumeChaos ?? r.eff.liquidity.minListings;
    case "trend":
      return r.eff.trendPct;
    case "total":
      return r.plan?.totalProfitChaos;
  }
}

export function compareRows(key: SortKey, dir: SortDir) {
  return (a: SortableRow, b: SortableRow): number => {
    const x = sortValue(a, key);
    const y = sortValue(b, key);
    if (x === undefined && y === undefined) return 0;
    if (x === undefined) return 1;
    if (y === undefined) return -1;
    return dir === "desc" ? y - x : x - y;
  };
}

/** Clic sur un en-tête : même colonne = inverse le sens ; autre colonne = décroissant. */
export function nextSort(cur: { key: SortKey; dir: SortDir }, key: SortKey): { key: SortKey; dir: SortDir } {
  return cur.key === key ? { key, dir: cur.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" };
}
