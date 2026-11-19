import type { Opportunity } from "../engine/types";

export interface TradeOption {
  option: string;
}

export interface TradeQuery {
  query: {
    status: TradeOption;
    name?: string;
    type?: string;
    filters: { misc_filters: { filters: { corrupted?: TradeOption; mutated: TradeOption } } };
  };
  sort: { price: "asc" };
}

export interface ListingPrice {
  amount: number;
  currency: string;
}

export interface TradePrice {
  /** Médiane (chaos) des annonces les moins chères convertibles ; undefined si aucune. */
  medianChaos?: number;
  /** Nombre total d'annonces correspondant à la recherche. */
  listings: number;
  /** Nombre d'annonces utilisées pour la médiane. */
  sampled: number;
  tradeUrl: string;
}

export type VerifiedItemStatus = "verified" | "no_listings" | "unverifiable";

export interface VerifiedItem {
  item: string;
  role: "input" | "output";
  /** Filtre de corruption utilisé : "false" = non corrompu seulement ; "any" = les deux. */
  corrupted: "false" | "any";
  ninjaChaos: number;
  tradeChaos?: number;
  listings?: number;
  sampled?: number;
  tradeUrl?: string;
  status: VerifiedItemStatus;
}

export interface VerifyResult {
  /** Opportunité ré-évaluée avec les prix du trade (identique si rien n'a pu être vérifié). */
  opportunity: Opportunity;
  items: VerifiedItem[];
  /** Au moins un item a un prix trade. */
  verified: boolean;
}
