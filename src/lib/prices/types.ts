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
  baseType?: string;
}

export interface PriceIndex {
  league: string;
  fetchedAt: Date;
  /** Prix d'un Divine Orb en chaos. */
  divineChaos: number;
  /** Catégories poe.ninja indisponibles (ignorées), ex. "stash:SkillGem". */
  failedCategories: string[];
  entries: Map<string, PriceEntry>;
  /** Recherche exacte, insensible à la casse. */
  get(name: string): PriceEntry | undefined;
}
