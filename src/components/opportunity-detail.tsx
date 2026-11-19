"use client";

import { useState } from "react";
import type { Opportunity, PricedItem } from "@/lib/engine/types";
import type { DashboardPayload } from "@/lib/payload";
import type { TradeLink } from "@/lib/trade/links";
import type { VerifiedItem, VerifyResult } from "@/lib/trade/types";
import { fmt, fmtAmount, fmtSigned } from "./format";
import { KIND_LABELS } from "./labels";
import type { VerifyState } from "./verify";
import { Divider, FalseStamp, itemColor, Panel, RuneSpinner } from "./ui/rune";

function where(o: Opportunity, vendors: Record<string, string>): string {
  if (o.steps?.length) {
    return o.steps.map((s) => `${s.vendor ?? "PNJ"} : ${s.qtyIn}× ${s.from} → ${s.qtyOut}× ${s.to}`).join(" ; ");
  }
  switch (o.kind) {
    case "vendor_shop":
      return vendors[o.id] ?? "boutique PNJ";
    case "vendor_recipe":
      return "vendeur (recette)";
    case "div_card":
    case "fragment_set":
      return "clic droit / stack";
    default:
      return vendors[o.id] ?? "voir la recette";
  }
}

function ItemName({ i, links, role, category }: { i: PricedItem; links: TradeLink[]; role: "input" | "output"; category?: string }) {
  const url = links.find((l) => l.role === role && l.item === i.item)?.url;
  const color = itemColor(category);
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="font-medium hover:underline" style={{ color }}>
      {i.item} ↗
    </a>
  ) : (
    <span className="font-medium" style={{ color }}>
      {i.item}
    </span>
  );
}

function Stat({ label, children, sub, hot }: { label: string; children: React.ReactNode; sub?: React.ReactNode; hot?: boolean }) {
  return (
    <div>
      <dt className="font-display text-xs tracking-[0.12em] text-muted">{label}</dt>
      <dd className={`num mt-1.5 text-[32px] leading-tight font-semibold ${hot ? "text-molten" : "text-cream"}`}>{children}</dd>
      {sub && <dd className="num mt-0.5 text-xs text-faint">{sub}</dd>}
    </div>
  );
}

/** Jauge de seuil : zone rentable (braise) et prix actuel (repère blanc), sur une échelle propre à la ligne. */
function Gauge({ current, limit, sell }: { current: number; limit: number; sell: boolean }) {
  const max = Math.max(current, limit) * 1.15;
  const a = sell ? (limit / max) * 100 : 0;
  const b = sell ? 100 : (limit / max) * 100;
  return (
    <span className="relative h-2 flex-1 bg-edge-soft" aria-hidden>
      <span
        className="absolute inset-y-0 bg-gradient-to-r from-ember/35 to-flame/75 shadow-[0_0_8px_rgb(255_120_40/0.4)]"
        style={{ left: `${a}%`, width: `${b - a}%` }}
      />
      <span
        className="absolute -top-1 h-4 w-[3px] bg-white shadow-[0_0_8px_#fff]"
        style={{ left: `calc(${(current / max) * 100}% - 1px)` }}
      />
    </span>
  );
}

function Threshold({ current, value, bad, sell, dc }: { current: number; value?: number; bad: boolean; sell: boolean; dc: number }) {
  if (bad || value === undefined || value <= 0) return <span className="text-danger">non rentable</span>;
  return (
    <span className="flex items-center gap-3">
      <Gauge current={current} limit={value} sell={sell} />
      <span className="num min-w-[4.5rem] text-right text-peach">{fmtAmount(value, dc).main}</span>
    </span>
  );
}

/** Prix unitaire effectif ; prix poe.ninja en sous-texte s'il diffère (prix trade vérifié). */
function Price({ item, unit, ninja, dc }: { item: string; unit: number; ninja: (item: string) => number | undefined; dc: number }) {
  const n = ninja(item);
  const differs = n !== undefined && Math.abs(n - unit) > 0.005 * Math.max(n, unit);
  return (
    <span className="flex flex-col items-end">
      <span className="num text-cream">{fmtAmount(unit, dc).main}</span>
      {differs && n !== undefined && <span className="num text-[11px] text-faint">ninja {fmtAmount(n, dc).main}</span>}
    </span>
  );
}

/**
 * Bandeau au-dessus de la liste de courses quand les prix affichés ne sont pas (encore) ceux du trade :
 * vérification en cours, échouée, ou sans annonce. Évite de prendre un prix poe.ninja pour un prix vérifié.
 */
function PriceSourceNotice({ verification, onVerify }: { verification?: VerifyState; onVerify: () => void }) {
  const loading = verification?.status === "loading";
  const unavailable = verification?.status === "unavailable";
  const text = loading
    ? "Vérification trade en cours : prix poe.ninja affichés en attendant."
    : unavailable
      ? "Vérification trade indisponible sur ce serveur (le trade officiel le refuse) : prix poe.ninja affichés. Vérifie avec les liens trade, ou utilise l'appli en local."
      : verification?.status === "error"
      ? `Vérification trade échouée (${verification.message}) : prix poe.ninja affichés, à prendre avec prudence.`
      : verification?.status === "done"
        ? "Aucune annonce exploitable sur le trade : prix poe.ninja affichés."
        : "Prix poe.ninja, pas encore vérifiés sur le trade.";
  return (
    <p
      role="status"
      className={`mt-4 flex flex-wrap items-center gap-3 px-4 py-3 ${
        verification?.status === "error"
          ? "bg-danger/10 text-[#ffb3a8] shadow-[inset_3px_0_0_#ff6b5a]"
          : "bg-flame/[0.07] text-[#e8d6b8] shadow-[inset_3px_0_0_#c8a35a]"
      }`}
    >
      {loading && <RuneSpinner size={14} />}
      <span className="flex-1">{text}</span>
      {!loading && !unavailable && (
        <button onClick={onVerify} className="btn-ghost px-3 py-1.5 font-display text-[11px] tracking-wide">
          ↻ Réessayer
        </button>
      )}
    </p>
  );
}

const TH = "font-display text-[11px] tracking-[0.12em] text-muted";
const SHOP_COLS = "grid-cols-[minmax(0,1.5fr)_70px_110px_minmax(0,1.3fr)]";

export function OpportunityDetail({
  o,
  runs,
  setRuns,
  budgetMode,
  payload,
  verification,
  verifiable,
  links,
  onVerify,
  onOpenLinks,
}: {
  o: Opportunity;
  runs: number;
  setRuns: (n: number) => void;
  budgetMode: boolean;
  payload: Pick<DashboardPayload, "vendors" | "divineChaos" | "categories">;
  verification?: VerifyState;
  verifiable: boolean;
  links: TradeLink[];
  onVerify: () => void;
  onOpenLinks: () => void;
}) {
  // Saisie en cours du nombre de runs (null = afficher la valeur courante) : un champ vide ou « 0 »
  // reste affiché pendant la frappe, sans changer les quantités ; il revient à la valeur valide en sortie.
  const [runsDraft, setRunsDraft] = useState<string | null>(null);
  const vr = verification?.status === "done" && verification.result.verified ? verification.result.opportunity : undefined;
  // Liste de courses aux prix effectifs (trade vérifié si dispo) : prix, quantités et seuils recalculés.
  const eff = vr ?? o;
  const unprofitable = eff.profitChaos <= 0;
  // Prix poe.ninja d'un item, affiché en sous-texte quand le prix trade diffère.
  const ninjaPrice = (item: string) => (vr ? [...o.inputs, ...o.outputs].find((x) => x.item === item)?.unitChaos : undefined);
  const dc = payload.divineChaos;
  const perRun = fmtSigned(eff.profitChaos, dc);
  const totalRuns = fmtSigned(eff.profitChaos * runs, dc);
  const cost = fmtAmount(eff.costChaos, dc);
  const stepBtn =
    "size-11 border border-edge-strong bg-[#1a110b] text-xl text-cream transition hover:shadow-[0_0_22px_rgb(255_120_40/0.45)] disabled:opacity-40";
  return (
    <section className="flex flex-col gap-6">
      <Panel
        corners
        rich
        className="px-8 py-7"
        style={{ background: "radial-gradient(90% 120% at 50% -20%, rgb(255 110 30 / 0.18), transparent 60%), linear-gradient(180deg, #1a120c, #0f0a07)" }}
      >
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-1.5">
            <p className="font-display text-xs tracking-[0.3em] text-muted uppercase">{KIND_LABELS[o.kind]}</p>
            <h2 className="font-display text-[40px] leading-tight font-bold text-unique [text-shadow:0_0_26px_rgb(255_120_40/0.45)]">
              {o.outputs.map((i) => i.item).join(" + ")}
            </h2>
            <p className="flavour text-[19px] text-muted">{o.label}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-display text-xs tracking-[0.14em] text-muted">Runs</span>
            <button
              className={stepBtn}
              onClick={() => {
                setRunsDraft(null);
                setRuns(Math.max(1, runs - 1));
              }}
              disabled={runs <= 1}
              aria-label="Un run de moins"
            >
              −
            </button>
            <input
              aria-label="Nombre de runs"
              inputMode="numeric"
              value={runsDraft ?? String(runs)}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 5);
                setRunsDraft(v);
                const n = Number.parseInt(v, 10);
                if (n >= 1) setRuns(n);
              }}
              onBlur={() => setRunsDraft(null)}
              onFocus={(e) => e.target.select()}
              className="num h-11 w-20 border-0 border-b border-[#8a5a2a] bg-transparent text-center text-[28px] font-semibold text-peach focus:border-flame focus:outline-none"
            />
            <button
              className={stepBtn}
              onClick={() => {
                setRunsDraft(null);
                setRuns(runs + 1);
              }}
              aria-label="Un run de plus"
            >
              +
            </button>
          </div>
        </div>
        <Divider className="my-5" />
        <dl className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          <Stat label={vr ? "Marge (trade)" : "Marge"} hot={eff.marginPct >= 150} sub={vr && `ninja ${fmt(o.marginPct)} %`}>
            <span className={eff.marginPct >= 150 ? undefined : eff.marginPct > 0 ? "text-flame" : "text-danger"}>
              {eff.marginPct > 0 ? "+" : ""}
              {fmt(eff.marginPct)} %
            </span>
          </Stat>
          <Stat label="Profit / run" sub={perRun.sub}>
            <span className={eff.profitChaos > 0 ? undefined : "text-danger"}>{perRun.main}</span>
          </Stat>
          <Stat label="Coût / run" sub={cost.sub}>
            {cost.main}
          </Stat>
          <Stat label={`Profit (${runs} run${runs > 1 ? "s" : ""})`} sub={totalRuns.sub}>
            <span className={eff.profitChaos > 0 ? "text-glow [text-shadow:0_0_16px_rgb(255_170_70/0.5)]" : "text-danger"}>
              {totalRuns.main}
            </span>
          </Stat>
        </dl>
        {(o.conditional || o.unverified) && (
          <p className="mt-5 flex items-start gap-3 bg-flame/[0.07] px-4 py-3 text-[#e8d6b8] shadow-[inset_3px_0_0_#c8a35a]">
            <span className="font-display text-[#e2b866]">!</span>
            <span>
              {o.conditional && "Opportunité conditionnelle. "}
              {o.unverified && "Recette non vérifiée en jeu [?]."}
            </span>
          </p>
        )}
      </Panel>

      <Panel corners className="bg-[#100a07]/95 px-7 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-[22px] font-bold tracking-[0.08em] text-cream">Liste de courses</h3>
            <p className="mt-1.5 text-dim">
              Où convertir : <span className="text-cream">{where(o, payload.vendors)}</span>
              {" · "}Quantités pour {runs} run{runs > 1 ? "s" : ""}
              {budgetMode ? " (selon le budget)" : ""}.
            </p>
          </div>
          {links.length > 0 && (
            <button onClick={onOpenLinks} className="btn-fire px-5 py-3 font-display font-bold tracking-wide">
              Liens trade ↗
            </button>
          )}
        </div>

        {verifiable && !vr && <PriceSourceNotice verification={verification} onVerify={onVerify} />}

        <div className="mt-5 overflow-x-auto">
          <div className="flex min-w-[46rem] flex-col">
            <div className={`grid ${SHOP_COLS} gap-4 border-b border-[#3a2414] px-1 py-2.5 ${TH}`}>
              <span>Acheter</span>
              <span className="text-right">Qté</span>
              <span className="text-right">Prix actuel</span>
              <span>Prix d&apos;achat max</span>
            </div>
            {eff.inputs.map((i) => (
              <div key={i.item} className={`fire-row grid ${SHOP_COLS} items-center gap-4 border-b border-edge-soft px-1 py-3.5`}>
                <span className="flex flex-wrap items-baseline gap-2.5">
                  <ItemName i={i} links={links} role="input" category={payload.categories[i.item]} />
                  {links.some((l) => l.role === "input" && l.item === i.item) && (
                    <span className="text-[11px] text-faint">
                      {o.corruptedInputs === "allowed" ? "corrompu OK" : "non corrompu requis"}
                    </span>
                  )}
                </span>
                <span className="num text-right text-cream">{i.qty * runs}</span>
                <Price item={i.item} unit={i.unitChaos} ninja={ninjaPrice} dc={dc} />
                <Threshold current={i.unitChaos} value={i.maxBuyChaos} bad={unprofitable} sell={false} dc={dc} />
              </div>
            ))}
            <div className={`grid ${SHOP_COLS} gap-4 border-b border-[#3a2414] px-1 pt-6 pb-2.5 ${TH}`}>
              <span>Vendre</span>
              <span className="text-right">Qté</span>
              <span className="text-right">Prix actuel</span>
              <span>Prix de vente min</span>
            </div>
            {eff.outputs.map((i) => (
              <div key={i.item} className={`fire-row grid ${SHOP_COLS} items-center gap-4 border-b border-edge-soft px-1 py-3.5`}>
                <span>
                  <ItemName i={i} links={links} role="output" category={payload.categories[i.item]} />
                </span>
                <span className="num text-right text-cream">{i.qty * runs}</span>
                <Price item={i.item} unit={i.unitChaos} ninja={ninjaPrice} dc={dc} />
                <Threshold current={i.unitChaos} value={i.minSellChaos} bad={unprofitable} sell dc={dc} />
              </div>
            ))}
          </div>
        </div>
        <p className="mt-4 text-xs text-faint">
          Barre : zone rentable en braise, prix actuel en blanc. Prix seuils : au-delà, le profit tombe à 0 (les autres prix
          restant fixes). Currency : à acheter chez Faustus (Currency Exchange en jeu), pas de lien trade.
        </p>
      </Panel>

      {verifiable && (
        <Panel corners className="bg-[#100a07]/95 px-7 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-[22px] font-bold tracking-[0.08em] text-cream">Vérification trade</h3>
              <p className="mt-1.5 text-dim">
                Médiane des 5 annonces securable les moins chères, hors Foulborn (file séquentielle : quelques secondes).
              </p>
            </div>
            <button
              onClick={onVerify}
              disabled={verification?.status === "loading"}
              className="btn-ghost inline-flex items-center gap-2 px-5 py-3 font-display text-sm tracking-wide disabled:border-edge disabled:text-faint"
            >
              {verification?.status === "loading" && <RuneSpinner size={14} />}
              {verification?.status === "loading"
                ? "Vérification…"
                : verification?.status === "done"
                  ? "Revérifier sur le trade"
                  : "Vérifier sur le trade"}
            </button>
          </div>
          {verification?.status === "error" && (
            <p className="mt-4 flex items-start gap-3 bg-danger/10 px-4 py-3 text-[#ffb3a8] shadow-[inset_3px_0_0_#ff6b5a]">
              Échec : {verification.message}
            </p>
          )}
          {verification?.status === "done" && <VerifiedTable r={verification.result} divineChaos={dc} categories={payload.categories} />}
        </Panel>
      )}
    </section>
  );
}

const VERIF_COLS = "grid-cols-[minmax(0,1.4fr)_170px_100px_150px_130px_70px]";

function VerifiedTable({ r, divineChaos, categories }: { r: VerifyResult; divineChaos: number; categories: Record<string, string> }) {
  const v = r.opportunity;
  const row = (i: VerifiedItem) => (
    <div key={`${i.role}-${i.item}`} className={`fire-row grid ${VERIF_COLS} items-center gap-3.5 border-b border-edge-soft px-1 py-3`}>
      <span style={{ color: itemColor(categories[i.item]) }}>{i.item}</span>
      <span className="text-dim">
        {i.role === "input" ? "achat" : "vente"}
        {i.status !== "unverifiable" && ` · ${i.corrupted === "any" ? "corrompu OK" : "non corrompu"}`}
      </span>
      <span className="num text-right text-dim">{fmtAmount(i.ninjaChaos, divineChaos).main}</span>
      <span className="num text-right">
        {i.tradeChaos !== undefined ? (
          <span className={i.tradeChaos > i.ninjaChaos * 1.2 ? "text-danger" : "text-cream"}>{fmtAmount(i.tradeChaos, divineChaos).main}</span>
        ) : i.status === "no_listings" ? (
          <span className="text-flame">aucune annonce</span>
        ) : (
          <span className="text-faint">exchange (poe.ninja)</span>
        )}
      </span>
      <span className="num text-right text-dim">{i.listings !== undefined ? `${i.listings} (${i.sampled} utilisées)` : "–"}</span>
      <span>
        {i.tradeUrl && (
          <a href={i.tradeUrl} target="_blank" rel="noreferrer">
            trade ↗
          </a>
        )}
      </span>
    </div>
  );
  const profit = fmtSigned(v.profitChaos, divineChaos);
  return (
    <div className="mt-5">
      <p className="mb-2 flex flex-wrap items-center gap-3 text-[15px]">
        {r.verified ? (
          <>
            Marge vérifiée :{" "}
            <b className={`num text-lg ${v.profitChaos > 0 ? "text-molten" : "text-danger"}`}>
              {v.marginPct > 0 ? "+" : ""}
              {fmt(v.marginPct)} % ({profit.main})
            </b>
            {v.profitChaos <= 0 && <FalseStamp />}
          </>
        ) : (
          <span className="text-flame">Aucun prix trade exploitable : prix poe.ninja conservés.</span>
        )}
      </p>
      <div className="overflow-x-auto">
        <div className="min-w-[52rem]">
          <div className={`grid ${VERIF_COLS} gap-3.5 border-b border-[#3a2414] px-1 py-2.5 ${TH}`}>
            <span>Item</span>
            <span>Rôle</span>
            <span className="text-right">poe.ninja</span>
            <span className="text-right">Trade</span>
            <span className="text-right">Annonces</span>
            <span>Lien</span>
          </div>
          {r.items.map(row)}
        </div>
      </div>
    </div>
  );
}
