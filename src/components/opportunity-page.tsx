"use client";

import Link from "next/link";
import type { Opportunity } from "@/lib/engine/types";
import type { DashboardPayload } from "@/lib/payload";
import type { TradeLink } from "@/lib/trade/links";
import { fmt } from "./format";
import { OpportunityDetail } from "./opportunity-detail";
import { useMemo } from "react";
import { TradeBadge } from "./trade-badge";
import { isVerifiable, tradeStatus, useTradeVerification } from "./verify";

export type DetailPayload = Pick<DashboardPayload, "league" | "fetchedAt" | "divineChaos" | "vendors" | "trade">;

export function OpportunityPage({
  o,
  runs,
  links,
  payload,
}: {
  o: Opportunity;
  /** Quantités transmises par le tableau en mode budget ; absent → 1 run. */
  runs?: number;
  links: TradeLink[];
  payload: DetailPayload;
}) {
  // Vérifiée automatiquement à l'ouverture (une seule opportunité), sauf si déjà faite dans l'onglet.
  // Même file et même stockage que le tableau : le résultat y apparaît au retour.
  const verifiable = isVerifiable(o, payload);
  const autoIds = useMemo(() => (verifiable ? [o.id] : []), [verifiable, o.id]);
  const { states, verify } = useTradeVerification(autoIds, payload.fetchedAt);
  const status = tradeStatus(states[o.id], verifiable);
  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2">
          <Link href="/" className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-800">
            ← Retour au tableau
          </Link>
          <TradeBadge status={status} />
        </span>
        <span className="text-zinc-500">
          Ligue {payload.league} · données{" "}
          {new Date(payload.fetchedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} · 1 div ={" "}
          {fmt(payload.divineChaos)}c
        </span>
      </nav>
      <OpportunityDetail
        o={o}
        runs={runs ?? 1}
        budgetMode={runs !== undefined}
        payload={payload}
        verification={states[o.id]}
        verifiable={verifiable}
        links={links}
        onVerify={() => verify(o.id)}
      />
    </div>
  );
}
