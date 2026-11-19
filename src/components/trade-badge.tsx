import type { TradeStatus } from "./verify";
import { RuneSpinner, Seal } from "./ui/rune";

const BADGES: Record<Exclude<TradeStatus, "none">, { text: string; color: string; title: string }> = {
  pending: {
    text: "prix ninja · à vérifier",
    color: "var(--color-muted)",
    title:
      "Prix poe.ninja (corrompus et non corrompus mélangés pour les uniques). Ouvre la ligne pour vérifier les non corrompus sur le trade.",
  },
  checking: {
    text: "vérif. prix non corrompus…",
    color: "var(--color-frost)",
    title: "Vérification sur le trade officiel en cours ou en file (une requête à la fois, limites de GGG).",
  },
  verified: {
    text: "prix trade ✓",
    color: "var(--color-wax)",
    title: "Prix des exemplaires non corrompus vérifiés sur le trade officiel (médiane des 5 moins chers).",
  },
  no_data: {
    text: "pas d'annonce trade",
    color: "var(--color-flame)",
    title: "Aucune annonce exploitable sur le trade : prix poe.ninja conservés.",
  },
  error: {
    text: "vérif. échouée",
    color: "var(--color-danger)",
    title: "La vérification trade a échoué (limite de débit ou erreur) : prix poe.ninja conservés.",
  },
};

function Icon({ status }: { status: Exclude<TradeStatus, "none"> }) {
  switch (status) {
    case "verified":
      return <Seal size={26} />;
    case "checking":
      return <RuneSpinner />;
    case "pending":
      return <span aria-hidden className="mx-1 size-2.5 rotate-45 border-[1.5px] border-muted" />;
    case "no_data":
      return <span aria-hidden className="mx-0.5 h-0.5 w-3 bg-flame" />;
    case "error":
      return <span aria-hidden className="px-0.5 font-bold text-danger">✕</span>;
  }
}

export function TradeBadge({ status }: { status: TradeStatus }) {
  if (status === "none") return null;
  const b = BADGES[status];
  return (
    <span title={b.title} className="inline-flex items-center gap-2 whitespace-nowrap">
      <Icon status={status} />
      <span className="flavour text-[15px]" style={{ color: b.color }}>
        {b.text}
      </span>
    </span>
  );
}
