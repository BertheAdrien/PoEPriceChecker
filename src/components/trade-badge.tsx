import type { TradeStatus } from "./verify";

const BADGES: Record<Exclude<TradeStatus, "none">, { text: string; cls: string; title: string }> = {
  pending: {
    text: "prix ninja · à vérifier",
    cls: "bg-zinc-700/60 text-zinc-300",
    title:
      "Prix poe.ninja (corrompus et non corrompus mélangés pour les uniques). Ouvre la ligne pour vérifier les non corrompus sur le trade.",
  },
  checking: {
    text: "vérif. prix non corrompus…",
    cls: "animate-pulse bg-sky-500/20 text-sky-300",
    title: "Vérification sur le trade officiel en cours ou en file (une requête à la fois, limites de GGG).",
  },
  verified: {
    text: "prix trade ✓",
    cls: "bg-emerald-500/15 text-emerald-300",
    title: "Prix des exemplaires non corrompus vérifiés sur le trade officiel (médiane des 5 moins chers).",
  },
  no_data: {
    text: "pas d'annonce trade",
    cls: "bg-amber-500/20 text-amber-300",
    title: "Aucune annonce exploitable sur le trade : prix poe.ninja conservés.",
  },
  error: {
    text: "vérif. échouée",
    cls: "bg-red-500/20 text-red-300",
    title: "La vérification trade a échoué (limite de débit ou erreur) : prix poe.ninja conservés.",
  },
};

export function TradeBadge({ status }: { status: TradeStatus }) {
  if (status === "none") return null;
  const b = BADGES[status];
  return (
    <span title={b.title} className={`ml-2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium ${b.cls}`}>
      {b.text}
    </span>
  );
}
