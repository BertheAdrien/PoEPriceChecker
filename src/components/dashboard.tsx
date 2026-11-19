"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { DashboardPayload } from "@/lib/payload";
import { KIND_LABELS, opportunityHref } from "./labels";
import { readSession, writeSession } from "./session";
import { TradeLinksModal } from "./trade-links-modal";
import { AUTO_VERIFY_COUNT, isVerifiable, tradeStatus, useTradeVerification } from "./verify";
import { TradeBadge } from "./trade-badge";
import { fmt, fmtProfit } from "./format";
import { num, passesPrice, passesStatic, planFor, type Filters } from "./filters";
import { compareRows, nextSort, SORT_KEYS, type SortDir, type SortKey } from "./sort";
import { isOverestimated } from "@/lib/trade/effective";

/** Incrémenter quand les champs changent : un état mémorisé d'une ancienne version est ignoré. */
const UI_VERSION = 2;

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

const inputCls =
  "w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-400">
      {label}
      {children}
    </label>
  );
}

function Badge({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{children}</span>;
}

function SortTh({
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
    <th
      className={`cursor-pointer select-none whitespace-nowrap px-3 py-2 hover:text-zinc-200 ${right ? "text-right" : ""} ${active ? "text-amber-300" : ""}`}
      onClick={() => setSort(nextSort(sort, k))}
      aria-sort={active ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}
    >
      {label}
      {/* Flèche toujours présente (invisible si inactive) : pas de saut de largeur ni de retour à la ligne. */}
      <span className={`ml-1 inline-block w-2 text-[0.65rem] ${active ? "" : "invisible"}`} aria-hidden>
        {active && sort.dir === "asc" ? "▲" : "▼"}
      </span>
    </th>
  );
}

function Loading() {
  return (
    <span className="ml-1 text-[10px] font-normal text-zinc-500" title="Vérification trade en cours">
      …
    </span>
  );
}

export function Dashboard({ payload }: { payload: DashboardPayload }) {
  const { divineChaos } = payload;
  const [kind, setKind] = useState<string>("all");
  const [minMargin, setMinMargin] = useState("0");
  const [minProfit, setMinProfit] = useState("0");
  const [showConditional, setShowConditional] = useState(false);
  const [budget, setBudget] = useState("");
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

  const open = (id: string, runs: number | undefined, newTab: boolean) => {
    const url = opportunityHref(id, runs);
    if (newTab) {
      window.open(url, "_blank", "noopener");
      return;
    }
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
        .filter((o) => passesStatic(o, filters))
        .filter((o) => passesPrice(o, planFor(o, filters.budgetChaos), filters))
        .sort((a, b) => b.marginPct - a.marginPct),
    [payload.opportunities, filters],
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
      .filter((o) => passesStatic(o, filters))
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
  const openAll = (id: string) => setLinksFor(id);
  const linksRow = linksFor ? payload.opportunities.find((o) => o.id === linksFor) : undefined;

  const kinds = useMemo(() => [...new Set(payload.opportunities.map((o) => o.kind))], [payload.opportunities]);
  const s = payload.skipped;
  const c = payload.chainSkipped;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300">
        <span>
          Ligue <b className="text-zinc-100">{payload.league}</b>
        </span>
        <span>Données {new Date(payload.fetchedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</span>
        <span>
          1 div = <b className="text-zinc-100">{fmt(divineChaos)}c</b>
        </span>
        <span>Marge de sécurité {payload.safetyMarginPct}%</span>
        <span className="text-zinc-500">
          Ignorés : {s.missing_price} sans prix, {s.illiquid} illiquides · chaînes : {c.missing_price} sans prix,{" "}
          {c.illiquid} illiquides
        </span>
        {payload.failedCategories.length > 0 && (
          <span className="basis-full text-xs text-amber-400">
            Catégories indisponibles : {payload.failedCategories.join(", ")}
          </span>
        )}
      </header>

      <section className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 sm:grid-cols-4 lg:grid-cols-6">
        <Field label="Type">
          <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="all">Tous</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Marge min (%)">
          <input className={inputCls} inputMode="decimal" value={minMargin} onChange={(e) => setMinMargin(e.target.value)} />
        </Field>
        <Field label="Profit min (c / run)">
          <input className={inputCls} inputMode="decimal" value={minProfit} onChange={(e) => setMinProfit(e.target.value)} />
        </Field>
        <Field label="Budget (mode budget)">
          <div className="flex gap-1">
            <input
              className={inputCls}
              inputMode="decimal"
              placeholder="illimité"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
            <select
              className={inputCls + " !w-auto"}
              value={unit}
              onChange={(e) => setUnit(e.target.value as "c" | "div")}
            >
              <option value="c">c</option>
              <option value="div">div</option>
            </select>
          </div>
        </Field>
        <label className="col-span-2 flex items-center gap-2 self-end text-sm text-zinc-300 sm:col-span-1">
          <input type="checkbox" checked={showConditional} onChange={(e) => setShowConditional(e.target.checked)} />
          Afficher les conditionnelles
        </label>
        <div className="self-end text-sm text-zinc-500">{rows.length} opportunités</div>
      </section>

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="bg-zinc-900 text-xs uppercase text-zinc-400">
            <tr>
              <SortTh k="margin" label="Marge" sort={sort} setSort={setSort} right />
              <SortTh k="profit" label="Profit" sort={sort} setSort={setSort} right />
              <SortTh k="cost" label="Coût" sort={sort} setSort={setSort} right />
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Opportunité</th>
              <SortTh k="trend" label="7 j" sort={sort} setSort={setSort} right />
              <th className="whitespace-nowrap px-3 py-2">Trade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ o, plan, vr, eff, loading, trade }) => {
              const links = payload.tradeLinks[o.id] ?? [];
              // Quantités de la liste de courses : celles du plan en mode budget, sinon 1 run.
              const runs = budgetChaos !== undefined ? Math.max(1, plan.runs) : undefined;
              return (
              <tr
                key={o.id}
                onClick={(e) => open(o.id, runs, e.ctrlKey || e.metaKey)}
                onAuxClick={(e) => e.button === 1 && open(o.id, runs, true)}
                title="Ouvrir la liste de courses (Ctrl+clic ou clic molette : nouvel onglet)"
                className="cursor-pointer border-t border-zinc-800 hover:bg-zinc-800/60"
              >
                <td className="px-3 py-2 text-right">
                  <div className={`font-semibold ${eff.marginPct > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {eff.marginPct > 0 ? "+" : ""}
                    {fmt(eff.marginPct)}%{loading && <Loading />}
                  </div>
                  {vr && <div className="text-[10px] font-normal text-zinc-500">ninja +{fmt(o.marginPct)}%</div>}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <div>
                    {fmtProfit(eff.profitChaos, divineChaos)}
                    {loading && <Loading />}
                  </div>
                  {vr && <div className="text-[10px] text-zinc-500">ninja {fmtProfit(o.profitChaos, divineChaos)}</div>}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{fmt(o.costChaos)}c</td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-400">{KIND_LABELS[o.kind]}</td>
                <td className="px-3 py-2">
                  {o.label}
                  {o.conditional && <Badge cls="bg-amber-500/20 text-amber-300">conditionnel</Badge>}
                  {o.unverified && <Badge cls="bg-sky-500/20 text-sky-300">[?] non vérifié</Badge>}
                  {vr && vr.profitChaos <= 0 && <Badge cls="bg-red-500/20 text-red-300">faux positif</Badge>}
                  {isOverestimated(o, vr) && <Badge cls="bg-orange-500/20 text-orange-300">surestimé</Badge>}
                  <TradeBadge status={trade} />
                </td>
                <td className={`px-3 py-2 text-right ${(o.trendPct ?? 0) < 0 ? "text-red-400" : "text-zinc-300"}`}>
                  {o.trendPct === undefined ? "–" : `${o.trendPct > 0 ? "+" : ""}${fmt(o.trendPct)}%`}
                </td>
                <td className="px-3 py-2">
                  {/* Un seul bouton ; le détail des liens par item est dans la liste de courses. */}
                  {links.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openAll(o.id);
                      }}
                      title={links.map((l) => l.label).join("\n")}
                      className="whitespace-nowrap rounded border border-amber-500/60 px-1.5 py-0.5 text-[11px] text-amber-300 hover:bg-zinc-800"
                    >
                      Liens trade ↗
                    </button>
                  )}
                </td>
              </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                  Aucune opportunité avec ces filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
