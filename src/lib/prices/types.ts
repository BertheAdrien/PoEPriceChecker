export interface PriceEntry {
  name: string;
  chaos: number;
  /** volumeChaos : volume échangé (en chaos) ; listings : nombre d'annonces. */
  liquidity: number;
  liquidityKind: "volumeChaos" | "listings";
  trendPct?: number;
  source: "exchange" | "stash";
  category: string;
  detailsId?: string;
  icon?: string;
}

export interface PriceIndex {
  league: string;
  fetchedAt: Date;
  /** Prix d'un Divine Orb en chaos. */
  divineChaos: number;
  entries: Map<string, PriceEntry>;
  /** Recherche exacte, insensible à la casse. */
  get(name: string): PriceEntry | undefined;
}
