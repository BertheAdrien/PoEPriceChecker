"use client";

import Link from "next/link";
import type { Opportunity } from "@/lib/engine/types";
import type { DashboardPayload } from "@/lib/payload";
import type { TradeLink } from "@/lib/trade/links";
import { fmt } from "./format";
import { OpportunityDetail } from "./opportunity-detail";
import { useMemo, useState } from "react";
import { TradeBadge } from "./trade-badge";
import { TradeLinksModal } from "./trade-links-modal";
import { Frame } from "./ui/rune";
import { isVerifiable, tradeStatus, useTradeVerification } from "./verify";

export type DetailPayload = Pick<DashboardPayload, "league" | "fetchedAt" | "divineChaos" | "vendors" | "trade" | "categories">;

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
  const [n, setN] = useState(runs ?? 1);
  const [linksOpen, setLinksOpen] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
        <span className="flex flex-wrap items-center gap-4">
          <Link
            href="/"
            className="rune-panel inline-flex items-center gap-2 bg-[#140d09]/85 px-4 py-2.5 font-display tracking-[0.06em] no-underline"
          >
            <Frame />← Retour au tableau
          </Link>
          <TradeBadge status={status} />
          {verifiable && status !== "checking" && (
            <button
              onClick={() => verify(o.id)}
              title="Relance la recherche sur le trade officiel (ignore le cache de 15 min)"
              className="btn-ghost px-3 py-1.5 font-display text-[11px] tracking-wide"
            >
              ↻ Mettre à jour les prix trade
            </button>
          )}
        </span>
        <span className="text-dim">
          Ligue <b className="text-cream">{payload.league}</b> · données{" "}
          {new Date(payload.fetchedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} ·{" "}
          <span className="num">
            1 div = <b className="text-cream">{fmt(payload.divineChaos)}c</b>
          </span>
        </span>
      </nav>
      <OpportunityDetail
        o={o}
        runs={n}
        setRuns={setN}
        budgetMode={runs !== undefined && n === runs}
        payload={payload}
        verification={states[o.id]}
        verifiable={verifiable}
        links={links}
        onVerify={() => verify(o.id)}
        onOpenLinks={() => setLinksOpen(true)}
      />
      {linksOpen && <TradeLinksModal title={o.label} links={links} onClose={() => setLinksOpen(false)} />}
    </div>
  );
}
