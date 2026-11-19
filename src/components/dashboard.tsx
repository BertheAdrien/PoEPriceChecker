"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Opportunity } from "@/lib/engine/types";
import type { DashboardPayload } from "@/lib/payload";
import { FILTER_KIND_LABELS, opportunityHref } from "./labels";
import { readSession, writeSession } from "./session";
import { TradeLinksModal } from "./trade-links-modal";
import { AUTO_VERIFY_COUNT, isVerifiable, tradeStatus, useTradeVerification, type TradeStatus } from "./verify";
import { TradeBadge } from "./trade-badge";
import { fmt, fmtSigned } from "./format";
import { filterKind, num, passesPrice, passesStatic, planFor, type Filters } from "./filters";
import { compareRows, nextSort, SORT_KEYS, type SortDir, type SortKey } from "./sort";
import { isOverestimated } from "@/lib/trade/effective";
import { Corners, FalseStamp, heatColor, ItemPill, Panel, RankRune, RuneSpinner, Sparkline } from "./ui/rune";

/** Incrémenter quand les champs changent : un état mémorisé d'une ancienne version est ignoré. */
const UI_VERSION = 2;

/** Durée du cache des prix côté serveur (cf. `src/lib/prices/build.ts`). */
const PRICE_TTL_MS = 15 * 60 * 1000;

interface UiState {
  version: number;
  kind: string;
  minMargin: string;
  minProfit: string;
  showConditional: boolean;
  budget: string;
  unit: "c" | "div";
  sort: { key: SortKey; dir: SortDir };
  scrollY: number;
}

const DEFAULTS = { kind: "all", minMargin: "0", minProfit: "0", showConditional: false, budget: "" };

const COLS = "grid-cols-[44px_170px_minmax(0,1fr)_120px_90px_104px_210px]";

const fieldCls =
  "num w-28 border-0 border-b border-[#8a5a2a] bg-transparent px-1 py-2 text-[15px] text-cream placeholder:text-faint focus:border-flame focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 font-display text-[11px] tracking-[0.1em] text-muted">
      {label}
      {children}
    </label>
  );
}

function SortHeader({
  k,
  label,
  sort,
  setSort,
  right,
}: {
  k: SortKey;
  label: string;
  sort: { key: SortKey; dir: SortDir };
  setSort: (s: { key: SortKey; dir: SortDir }) => void;
  right?: boolean;
}) {
  const active = sort.key === k;
  return (
    <button
      onClick={() => setSort(nextSort(sort, k))}
      aria-label={`Trier par ${label}`}
      aria-pressed={active}
      className={`whitespace-nowrap tracking-[0.12em] hover:text-cream ${right ? "text-right" : "text-left"} ${active ? "text-peach" : ""}`}
    >
      {label}
      {/* Flèche toujours présente (invisible si inactive) : pas de saut de largeur. */}
      <span className={`ml-1 inline-block w-2 text-[0.65rem] ${active ? "" : "invisible"}`} aria-hidden>
        {active && sort.dir === "asc" ? "▴" : "▾"}
      </span>
    </button>
  );
}

/** Minutes avant l'expiration du cache des prix ; null avant l'hydratation (pas de décalage serveur/client). */
function useMinutesLeft(fetchedAt: string): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  if (now === null) return null;
  return Math.ceil((new Date(fetchedAt).getTime() + PRICE_TTL_MS - now) / 60_000);
}

function Metric({ label, children, note }: { label: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div
      className="rune-panel tilt px-5 py-4"
      style={{ background: "radial-gradient(120% 90% at 50% 125%, rgb(255 110 30 / 0.24), transparent 60%), linear-gradient(180deg, #1a120c, #0f0a07)" }}
    >
      <svg aria-hidden className="rune-frame">
        <rect className="base" width="100%" height="100%" />
        <rect className="full" pathLength={100} width="100%" height="100%" />
      </svg>
      <Corners />
      <p className="font-display text-xs tracking-[0.14em] text-muted">{label}</p>
      <div className="num mt-1.5 mb-0.5 text-3xl font-semibold text-cream">{children}</div>
      {note && <div className="flavour text-base leading-snug text-dim">{note}</div>}
    </div>
  );
}

const PIP: Record<TradeStatus, string> = {
  verified: "bg-gradient-to-r from-ember to-[#ffd27a] shadow-[0_0_6px_rgb(255_140_50/0.6)]",
  no_data: "bg-flame/40",
  error: "bg-danger/70",
  checking: "bg-frost",
  pending: "bg-[#2a1a10]",
  none: "bg-[#2a1a10]",
};

export function Dashboard({ payload }: { payload: DashboardPayload }) {
  const { divineChaos } = payload;
  const [kind, setKind] = useState<string>(DEFAULTS.kind);
  const [minMargin, setMinMargin] = useState(DEFAULTS.minMargin);
  const [minProfit, setMinProfit] = useState(DEFAULTS.minProfit);
  const [showConditional, setShowConditional] = useState(DEFAULTS.showConditional);
  const [budget, setBudget] = useState(DEFAULTS.budget);
  const [unit, setUnit] = useState<"c" | "div">("c");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "margin", dir: "desc" });
  const router = useRouter();

  // Filtres, tri et défilement retrouvés au retour d'une page d'opportunité (même onglet).
  const restored = useRef(false);
  useEffect(() => {
    const ui = readSession<UiState>("dashboard");
    restored.current = true;
    if (!ui || ui.version !== UI_VERSION) return;
    /* eslint-disable react-hooks/set-state-in-effect -- sessionStorage n'existe qu'après l'hydratation */
    setKind(ui.kind);
    setMinMargin(ui.minMargin);
    setMinProfit(ui.minProfit);
    setShowConditional(ui.showConditional);
    setBudget(ui.budget);
    setUnit(ui.unit);
    if (ui.sort && SORT_KEYS.includes(ui.sort.key)) setSort(ui.sort);
    /* eslint-enable react-hooks/set-state-in-effect */
    requestAnimationFrame(() => window.scrollTo(0, ui.scrollY));
  }, []);
  useEffect(() => {
    if (!restored.current) return;
    const ui: Omit<UiState, "scrollY"> = {
      version: UI_VERSION, kind, minMargin, minProfit, showConditional, budget, unit, sort,
    };
    writeSession("dashboard", { ...ui, scrollY: readSession<UiState>("dashboard")?.scrollY ?? 0 });
  }, [kind, minMargin, minProfit, showConditional, budget, unit, sort]);

  const resetFilters = () => {
    setKind(DEFAULTS.kind);
    setMinMargin(DEFAULTS.minMargin);
    setMinProfit(DEFAULTS.minProfit);
    setShowConditional(DEFAULTS.showConditional);
    setBudget(DEFAULTS.budget);
  };

  /** Clic simple : navigation dans l'onglet (défilement mémorisé) ; Ctrl/Cmd/Maj/molette : comportement natif. */
  const onOpen = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const ui = readSession<UiState>("dashboard");
    if (ui) writeSession("dashboard", { ...ui, scrollY: window.scrollY });
    router.push(url);
  };

  const budgetChaos = useMemo(() => {
    const n = num(budget);
    if (!(n > 0)) return undefined;
    return unit === "div" ? n * divineChaos : n;
  }, [budget, unit, divineChaos]);

  const filters: Filters = useMemo(
    () => ({
      kind,
      showConditional,
      minMarginPct: num(minMargin),
      minProfit: num(minProfit),
      budgetChaos,
    }),
    [kind, showConditional, minMargin, minProfit, budgetChaos],
  );

  // Candidats filtrés sur les prix poe.ninja, triés par marge ninja : stable pendant les vérifications
  // (sert à choisir les autoIds sans effet de cascade quand une vérification masque une ligne).
  const ninjaRows = useMemo(
    () =>
      payload.opportunities
        .filter((o) => passesStatic(o, filters, payload.categories))
        .filter((o) => passesPrice(o, planFor(o, filters.budgetChaos), filters))
        .sort((a, b) => b.marginPct - a.marginPct),
    [payload.opportunities, payload.categories, filters],
  );

  const autoIds = useMemo(
    () => ninjaRows.filter((o) => isVerifiable(o, payload)).slice(0, AUTO_VERIFY_COUNT).map((o) => o.id),
    [ninjaRows, payload],
  );
  const { states: verif } = useTradeVerification(autoIds, payload.fetchedAt);

  // Lignes affichées : filtres de prix (marge, profit, budget) appliqués aux valeurs effectives
  // (trade vérifié si disponible, sinon ninja) → un faux positif vérifié disparaît, un sous-estimé apparaît.
  const rows = useMemo(() => {
    return payload.opportunities
      .filter((o) => passesStatic(o, filters, payload.categories))
      .map((o) => {
        const v = verif[o.id];
        const vr = v?.status === "done" && v.result.verified ? v.result.opportunity : undefined;
        const eff = vr ?? o;
        const plan = planFor(eff, filters.budgetChaos);
        return { o, plan, vr, eff, loading: v?.status === "loading", trade: tradeStatus(v, isVerifiable(o, payload)) };
      })
      .filter((r) => passesPrice(r.eff, r.plan, filters))
      .sort(compareRows(sort.key, sort.dir));
  }, [payload, filters, verif, sort]);

  // Les navigateurs bloquent les onglets au-delà du premier par clic : on affiche une fenêtre de liens.
  const [linksFor, setLinksFor] = useState<string | null>(null);
  const linksRow = linksFor ? payload.opportunities.find((o) => o.id === linksFor) : undefined;

  // Compteurs par type (avec la règle des conditionnelles, sans les filtres de prix).
  const kindCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of payload.opportunities) {
      if (!passesStatic(o, { ...filters, kind: "all" })) continue;
      const k = filterKind(o, payload.categories);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  }, [payload.opportunities, payload.categories, filters]);
  const total = [...kindCounts.values()].reduce((a, b) => a + b, 0);

  // Métriques d'en-tête
  const autoStatuses = autoIds.map((id) => tradeStatus(verif[id], true));
  const finished = autoStatuses.filter((s) => s === "verified" || s === "no_data" || s === "error").length;
  const best = useMemo(() => {
    let top: { o: Opportunity; vr: Opportunity } | undefined;
    for (const o of payload.opportunities) {
      const v = verif[o.id];
      if (v?.status !== "done" || !v.result.verified) continue;
      const vr = v.result.opportunity;
      if (vr.profitChaos > 0 && (!top || vr.marginPct > top.vr.marginPct)) top = { o, vr };
    }
    return top;
  }, [payload.opportunities, verif]);
  const minutesLeft = useMinutesLeft(payload.fetchedAt);
  const fetchedTime = new Date(payload.fetchedAt).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });
  const fetchedFull = new Date(payload.fetchedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

  const s = payload.skipped;
  const c = payload.chainSkipped;
  const chainSkips = c.missing_price + c.illiquid;
  const chip = "rune-panel inline-flex items-center gap-2 bg-[#140d09]/85 px-4 py-2.5 text-[13px] text-muted";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <svg width="62" height="62" viewBox="0 0 66 66" aria-hidden>
            <path className="rune-draw" pathLength={100} d="M33 3 61 18v30L33 63 5 48V18z" fill="none" stroke="#ffb347" strokeWidth="1.6" style={{ filter: "drop-shadow(0 0 5px #ff7a2a)" }} />
            <path className="rune-draw" pathLength={100} d="M33 14v38M20 24l26 18M46 24 20 42" fill="none" stroke="#ffe08a" strokeWidth="1.6" strokeLinecap="round" style={{ animationDelay: "0.6s" }} />
            <circle className="pulse-glow" cx="33" cy="33" r="5" fill="#fff0b8" style={{ filter: "drop-shadow(0 0 8px #ff7a2a)" }} />
          </svg>
          <div>
            <h1 className="font-display text-[32px] leading-tight font-black tracking-[0.09em] text-cream [text-shadow:0_0_20px_rgb(255_120_40/0.45)]">
              PoE Price Checker
            </h1>
            <svg width="360" height="10" viewBox="0 0 360 10" aria-hidden className="mt-1 block max-w-full">
              <path className="rune-draw" pathLength={100} d="M0 5h150l5-4 5 8 5-8 5 8 5-4h195" fill="none" stroke="#ff9a4a" strokeWidth="1.4" style={{ animationDelay: "1s" }} />
            </svg>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <span className={chip}>
            <svg className="rune-frame" aria-hidden><rect className="base" width="100%" height="100%" /><rect className="full" pathLength={100} width="100%" height="100%" /></svg>
            Ligue <b className="text-cream">{payload.league}</b> softcore
          </span>
          <span className={chip}>
            <svg className="rune-frame" aria-hidden><rect className="base" width="100%" height="100%" /><rect className="full" pathLength={100} width="100%" height="100%" /></svg>
            <span className="num text-cream">1 div = {fmt(divineChaos)}c</span>
          </span>
          <span className={chip} title={`Données poe.ninja du ${fetchedFull}`}>
            <svg className="rune-frame" aria-hidden><rect className="base" width="100%" height="100%" /><rect className="full" pathLength={100} width="100%" height="100%" /></svg>
            poe.ninja {fetchedTime}
            {minutesLeft !== null &&
              (minutesLeft > 0 ? (
                <>
                  {" · "}
                  <b className="num text-cream">{minutesLeft} min</b> avant rafraîchissement
                </>
              ) : (
                " · rafraîchi au prochain chargement"
              ))}
          </span>
        </div>
      </header>

      {payload.failedCategories.length > 0 && (
        <div className="flex items-start gap-3 bg-gradient-to-r from-flame/15 to-flame/[0.03] px-4 py-3 shadow-[inset_3px_0_0_var(--color-flame)]">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="shrink-0">
            <path d="M10 2 19 18H1z" fill="none" stroke="#ffb347" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M10 8v4M10 14.5v.5" stroke="#ffb347" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span className="text-peach">Catégories indisponibles : {payload.failedCategories.join(", ")}</span>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Opportunités"
          note={
            <>
              ignorées : {s.missing_price} sans prix · {s.illiquid} illiquides
              {chainSkips > 0 && ` · chaînes : ${c.missing_price} sans prix, ${c.illiquid} illiquides`}
            </>
          }
        >
          {payload.opportunities.length}
        </Metric>
        <Metric
          label="Meilleure marge vérifiée"
          note={best ? `${best.o.outputs.map((i) => i.item).join(" + ")} · ninja +${fmt(best.o.marginPct)} %` : "en attente du trade"}
        >
          {best ? <span className="text-molten">+{fmt(best.vr.marginPct)} %</span> : <span className="text-faint">—</span>}
        </Metric>
        <Metric label="Vérification trade">
          {finished}
          <span className="text-lg text-faint"> / {autoIds.length}</span>
          <div className="mt-2 mb-0.5 grid grid-cols-10 gap-1" aria-hidden>
            {Array.from({ length: AUTO_VERIFY_COUNT }, (_, i) => (
              <span key={i} className={`h-1.5 ${PIP[autoStatuses[i] ?? "none"]}`} />
            ))}
          </div>
        </Metric>
        <Metric label="Marge de sécurité" note="déduite du prix de revente">
          {payload.safetyMarginPct} %
        </Metric>
      </section>

      <Panel className="flex flex-wrap items-end gap-4 bg-[#120c08]/90 px-5 py-4">
        <div className="flex basis-full flex-wrap gap-2">
          {[["all", total] as const, ...[...kindCounts.entries()]].map(([k, n]) => {
            const on = kind === k;
            return (
              <button
                key={k}
                onClick={() => setKind(k)}
                aria-pressed={on}
                className={`border px-3.5 py-2 font-display text-xs tracking-[0.06em] transition ${
                  on
                    ? "border-[#ff9a4a] bg-gradient-to-b from-ember/25 to-ember/5 text-peach shadow-[0_0_18px_rgb(255_122_42/0.3)]"
                    : "border-[#3a2414] text-[#d8c6ae] hover:border-[#8a5a2a]"
                }`}
              >
                {k === "all" ? "All" : (FILTER_KIND_LABELS[k] ?? k)} <span className="num ml-1 opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
        <Field label="Marge min (%)">
          <input className={fieldCls} inputMode="decimal" value={minMargin} onChange={(e) => setMinMargin(e.target.value)} />
        </Field>
        <Field label="Profit min (c / run)">
          <input className={fieldCls} inputMode="decimal" value={minProfit} onChange={(e) => setMinProfit(e.target.value)} />
        </Field>
        <Field label="Budget (mode budget)">
          <span className="flex items-end gap-2">
            <input
              className={fieldCls}
              inputMode="decimal"
              placeholder="illimité"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
            <span className="flex border border-edge" role="group" aria-label="Unité du budget">
              {(["c", "div"] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  aria-pressed={unit === u}
                  className={`num px-3 py-1.5 text-xs ${unit === u ? "bg-ember/25 text-peach" : "text-dim hover:text-cream"}`}
                >
                  {u}
                </button>
              ))}
            </span>
          </span>
        </Field>
        <label className="flex items-center gap-2.5 py-2 text-[13px] text-[#d8c6ae]">
          <input
            type="checkbox"
            className="size-4 accent-ember"
            checked={showConditional}
            onChange={(e) => setShowConditional(e.target.checked)}
          />
          Afficher les conditionnelles
        </label>
        <span className="flavour ml-auto text-[17px] text-muted">
          <b className="num text-sm not-italic text-cream">{rows.length}</b> opportunités
        </span>
      </Panel>

      <Panel corners rich className="bg-[#0e0906]/95">
        <div className="overflow-x-auto">
          <div className="min-w-[68rem] px-1.5 py-2">
            <div className={`grid ${COLS} gap-4 border-b border-[#3a2414] px-5 py-3.5 font-display text-[11px] text-muted`}>
              <span />
              <SortHeader k="margin" label="Marge" sort={sort} setSort={setSort} />
              <span className="tracking-[0.12em]">Recette</span>
              <SortHeader k="profit" label="Profit / run" sort={sort} setSort={setSort} right />
              <SortHeader k="cost" label="Coût" sort={sort} setSort={setSort} right />
              <SortHeader k="trend" label="7 j" sort={sort} setSort={setSort} right />
              <span className="tracking-[0.12em]">Trade</span>
            </div>

            {rows.map(({ o, plan, vr, eff, loading, trade }, idx) => {
              const links = payload.tradeLinks[o.id] ?? [];
              // Quantités de la liste de courses : celles du plan en mode budget, sinon 1 run.
              const runs = budgetChaos !== undefined ? Math.max(1, plan.runs) : undefined;
              const url = opportunityHref(o.id, runs);
              const pos = eff.marginPct > 0;
              const heat = heatColor(eff.marginPct);
              const hot = eff.marginPct >= 150;
              const profit = fmtSigned(eff.profitChaos, divineChaos);
              const between = o.steps && o.steps.length > 1 ? o.steps.slice(0, -1).map((st) => st.to) : [];
              return (
                <div key={o.id} className={`fire-row grid ${COLS} items-center gap-4 border-b border-edge-soft px-5 py-3.5`}>
                  <RankRune rank={idx + 1} lit={idx < 3 && pos} />

                  <div className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`num text-[21px] font-semibold ${hot ? "text-molten" : ""}`}
                        style={hot ? undefined : { color: pos ? heat : "var(--color-danger)" }}
                      >
                        {pos ? "+" : ""}
                        {fmt(eff.marginPct)} %
                      </span>
                      {loading && <RuneSpinner size={13} />}
                    </div>
                    {vr && <span className="num text-[11px] text-faint line-through">ninja +{fmt(o.marginPct)} %</span>}
                    <div className="mt-0.5 h-1 bg-edge-soft">
                      <div
                        className={`h-full ${pos ? "bar-molten" : "bg-danger"}`}
                        style={{ width: `${pos ? Math.max(4, Math.min(100, Math.sqrt(eff.marginPct / 250) * 100)) : 3}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-col gap-1.5">
                    {/* Lien étiré sur toute la ligne : clic = liste de courses (Ctrl+clic / molette = nouvel onglet). */}
                    <a
                      href={url}
                      onClick={(e) => onOpen(e, url)}
                      aria-label={`Liste de courses : ${o.label}`}
                      title="Ouvrir la liste de courses (Ctrl+clic ou clic molette : nouvel onglet)"
                      className="flex flex-wrap items-center gap-1.5 after:absolute after:inset-0 after:content-['']"
                    >
                      {o.inputs.map((i, n) => (
                        <span key={i.item} className="contents">
                          {n > 0 && <span className="font-display text-[#8a6a46]">&amp;</span>}
                          <ItemPill name={i.item} qty={i.qty} category={payload.categories[i.item]} />
                        </span>
                      ))}
                      {between.map((name) => (
                        <span key={name} className="contents">
                          <Arrow />
                          <ItemPill name={name} category={payload.categories[name]} />
                        </span>
                      ))}
                      <Arrow />
                      {o.outputs.map((i) => (
                        <ItemPill key={i.item} name={i.item} qty={i.qty} category={payload.categories[i.item]} />
                      ))}
                    </a>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="flavour text-[15px] text-dim">
                        {FILTER_KIND_LABELS[filterKind(o, payload.categories)]}
                      </span>
                      {o.conditional && (
                        <span className="border border-[#e2b866]/35 bg-[#e2b866]/10 px-2 py-px text-[#e2b866]">conditionnel</span>
                      )}
                      {o.unverified && (
                        <span className="border border-frost/30 bg-frost/10 px-2 py-px text-frost">[?] non vérifié</span>
                      )}
                      {vr && vr.profitChaos <= 0 && <FalseStamp />}
                      {isOverestimated(o, vr) && (
                        <span className="border border-[#ff8c50]/35 bg-[#ff8c50]/10 px-2 py-px text-[#ffb38a]">surestimé</span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`num text-[15px] font-semibold ${eff.profitChaos > 0 ? "text-cream" : "text-danger"}`}>
                      {profit.main}
                    </div>
                    {profit.sub && <div className="num text-[11px] text-faint">{profit.sub}</div>}
                    {vr && <div className="num text-[11px] text-faint">ninja {fmtSigned(o.profitChaos, divineChaos).main}</div>}
                  </div>

                  <div className="num text-right text-[#d8c6ae]">{fmt(o.costChaos)}c</div>

                  <div className="flex flex-col items-end gap-0.5" title="Prix du premier item vendu sur 7 jours (poe.ninja)">
                    {o.trendSeries && <Sparkline series={o.trendSeries} />}
                    <span
                      className={`num text-right ${o.trendSeries ? "text-[11px]" : "text-[13px]"} ${o.trendPct === undefined ? "text-faint" : o.trendPct < 0 ? "text-[#d9805f]" : "text-[#d8c6ae]"}`}
                    >
                      {o.trendPct === undefined ? "–" : `${o.trendPct > 0 ? "+" : ""}${fmt(o.trendPct)} %`}
                    </span>
                  </div>

                  <div className="relative z-10 flex flex-col items-start gap-1.5">
                    <TradeBadge status={trade} />
                    {/* Un seul bouton ; le détail des liens par item est dans la liste de courses. */}
                    {links.length > 0 && (
                      <button
                        onClick={() => setLinksFor(o.id)}
                        title={links.map((l) => l.label).join("\n")}
                        className="btn-ghost px-2.5 py-1 font-display text-[11px] tracking-wide"
                      >
                        Liens trade ↗
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {rows.length === 0 && (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <svg width="90" height="80" viewBox="0 0 90 80" aria-hidden>
                  <path d="M45 18c3 6-2 8 1 13" fill="none" stroke="#4a5868" strokeWidth="1.5" strokeLinecap="round" opacity=".8" />
                  <path d="M38 10c2 5-2 7 0 11M52 8c2 5-2 7 0 11" fill="none" stroke="#4a5868" strokeWidth="1.2" strokeLinecap="round" opacity=".5" />
                  <path d="M14 40h62l-6 22H20z" fill="#140d09" stroke="#6b4422" />
                  <path d="M22 40c4-4 10-3 14 0s10-4 14 0 10-3 14 0" fill="none" stroke="#3a2a22" strokeWidth="2" />
                  <path d="M30 62l-6 14M60 62l6 14M45 62v14" stroke="#6b4422" strokeWidth="2" />
                </svg>
                <span className="font-display text-lg text-cream">Aucune opportunité avec ces filtres.</span>
                <span className="flavour text-[17px] text-dim">
                  La forge est froide : baisse la marge min ou le profit min, ou retire le budget.
                </span>
                <button onClick={resetFilters} className="btn-ghost mt-1 px-4 py-2.5 font-display tracking-wide">
                  Réinitialiser les filtres
                </button>
              </div>
            )}
          </div>
        </div>
      </Panel>

      <p className="flavour text-center text-base text-faint">
        Clic sur une ligne : liste de courses · Ctrl+clic ou molette : nouvel onglet · les prix trade vérifiés remplacent
        poe.ninja dès qu&apos;ils arrivent.
      </p>

      {linksRow && (
        <TradeLinksModal
          title={linksRow.label}
          links={payload.tradeLinks[linksRow.id] ?? []}
          onClose={() => setLinksFor(null)}
        />
      )}
    </div>
  );
}

function Arrow() {
  return (
    <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden className="shrink-0">
      <path d="M1 6h21M17 1.5 23 6l-6 4.5" fill="none" stroke="#ff7a2a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
