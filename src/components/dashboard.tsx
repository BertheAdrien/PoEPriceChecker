"use client";

import { useMemo, useState } from "react";
import { liquidityRunCap, planBudget } from "@/lib/engine/budget";
import type { Opportunity, OpportunityKind } from "@/lib/engine/types";
import type { DashboardPayload } from "@/lib/payload";
import { OpportunityDetail } from "./opportunity-detail";
import { TradeLinksModal } from "./trade-links-modal";
import { AUTO_VERIFY_COUNT, isVerifiable, useTradeVerification } from "./verify";
import { fmt, fmtProfit } from "./format";
import { compareRows, nextSort, type SortDir, type SortKey } from "./sort";
import { isOverestimated } from "@/lib/trade/effective";

const KIND_LABELS: Record<OpportunityKind, string> = {
  vendor_shop: "Boutique PNJ",
  vendor_recipe: "Recette vendeur",
  div_card: "Carte de divination",
  fragment_set: "Fragments",
  vendor_chain: "Chaîne PNJ",
  other: "Autre",
};

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

function liqText(o: Opportunity): string {
  const l = o.liquidity;
  return (
    [
      l.minVolumeChaos !== undefined ? `vol ${fmt(l.minVolumeChaos)}c` : "",
      l.minListings !== undefined ? `${l.minListings} ann.` : "",
    ]
      .filter(Boolean)
      .join(" / ") || "–"
  );
}

export function Dashboard({ payload }: { payload: DashboardPayload }) {
  const { divineChaos } = payload;
  const [kind, setKind] = useState<string>("all");
  const [minMargin, setMinMargin] = useState("0");
  const [minLiq, setMinLiq] = useState("0");
  const [minProfit, setMinProfit] = useState("5");
  const [showConditional, setShowConditional] = useState(false);
  const [budget, setBudget] = useState("");
  const [unit, setUnit] = useState<"c" | "div">("c");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "margin", dir: "desc" });
  const [selected, setSelected] = useState<string | null>(null);

  const budgetChaos = useMemo(() => {
    const n = parseFloat(budget.replace(",", "."));
    if (!(n > 0)) return undefined;
    return unit === "div" ? n * divineChaos : n;
  }, [budget, unit, divineChaos]);

  // Ensemble filtré, trié par marge poe.ninja : stable pendant les vérifications (sert aux autoIds).
  const ninjaRows = useMemo(() => {
    const mm = parseFloat(minMargin) || 0;
    const ml = parseFloat(minLiq) || 0;
    const mp = parseFloat(minProfit) || 0;
    return payload.opportunities
      .filter((o) => showConditional || !o.conditional)
      .filter((o) => kind === "all" || o.kind === kind)
      .filter((o) => o.marginPct >= mm)
      .filter((o) => {
        const l = o.liquidity;
        return (
          (l.minVolumeChaos === undefined || l.minVolumeChaos >= ml) &&
          (l.minListings === undefined || l.minListings >= ml)
        );
      })
      .map((o) => ({ o, plan: budgetChaos !== undefined ? planBudget(o, budgetChaos) : undefined }))
      .filter((r) => !r.plan || r.plan.affordable)
      // Profit total réalisable : avec budget = runs du plan ; sans budget = runs plafonnés par la liquidité.
      // (Un filtre par run masquait toute la currency bon marché, ex. 4 Fusing → 1 Scouring = 0,16c/run.)
      .filter(({ o, plan }) => (plan ? plan.totalProfitChaos : o.profitChaos * liquidityRunCap(o)) >= mp)
      .sort((a, b) => b.o.marginPct - a.o.marginPct);
  }, [payload.opportunities, kind, minMargin, minLiq, minProfit, showConditional, budgetChaos]);

  const autoIds = useMemo(
    () => ninjaRows.filter((r) => isVerifiable(r.o, payload)).slice(0, AUTO_VERIFY_COUNT).map((r) => r.o.id),
    [ninjaRows, payload],
  );
  const { states: verif, verify } = useTradeVerification(autoIds);

  // Même ensemble, tri par marge effective (vérifiée si disponible) ; plan de budget sur l'effectif.
  const rows = useMemo(() => {
    return ninjaRows
      .map((r) => {
        const v = verif[r.o.id];
        const vr = v?.status === "done" && v.result.verified ? v.result.opportunity : undefined;
        const eff = vr ?? r.o;
        const plan = vr && budgetChaos !== undefined ? planBudget(vr, budgetChaos) : r.plan;
        return { o: r.o, plan, vr, eff, loading: v?.status === "loading" };
      })
      .sort(compareRows(sort.key, sort.dir));
  }, [ninjaRows, verif, budgetChaos, sort]);

  // Les navigateurs bloquent les onglets au-delà du premier par clic : on affiche une fenêtre de liens.
  const [linksFor, setLinksFor] = useState<string | null>(null);
  const openAll = (id: string) => setLinksFor(id);
  const linksRow = linksFor ? payload.opportunities.find((o) => o.id === linksFor) : undefined;

  const selectedRow = selected ? rows.find((r) => r.o.id === selected) : undefined;
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

      <section className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 sm:grid-cols-4 lg:grid-cols-7">
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
        <Field label="Profit total min (c)">
          <input className={inputCls} inputMode="decimal" value={minProfit} onChange={(e) => setMinProfit(e.target.value)} />
        </Field>
        <Field label="Liquidité min">
          <input className={inputCls} inputMode="decimal" value={minLiq} onChange={(e) => setMinLiq(e.target.value)} />
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
        <table className="w-full min-w-[60rem] text-left text-sm">
          <thead className="bg-zinc-900 text-xs uppercase text-zinc-400">
            <tr>
              <SortTh k="margin" label="Marge" sort={sort} setSort={setSort} right />
              <SortTh k="profit" label="Profit" sort={sort} setSort={setSort} right />
              <SortTh k="cost" label="Coût" sort={sort} setSort={setSort} right />
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Opportunité</th>
              <SortTh k="liquidity" label="Liquidité" sort={sort} setSort={setSort} right />
              <SortTh k="trend" label="7 j" sort={sort} setSort={setSort} right />
              <th className="whitespace-nowrap px-3 py-2">Trade</th>
              {budgetChaos !== undefined && <th className="px-3 py-2 text-right">Runs</th>}
              {budgetChaos !== undefined && <SortTh k="total" label="Profit total" sort={sort} setSort={setSort} right />}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ o, plan, vr, eff, loading }) => {
              const links = payload.tradeLinks[o.id] ?? [];
              return (
              <tr
                key={o.id}
                onClick={() => setSelected(o.id === selected ? null : o.id)}
                className={`cursor-pointer border-t border-zinc-800 hover:bg-zinc-800/60 ${o.id === selected ? "bg-zinc-800/80" : ""}`}
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
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-400">{liqText(o)}</td>
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
                {plan && <td className="px-3 py-2 text-right">{plan.runs}</td>}
                {plan && (
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {fmtProfit(plan.totalProfitChaos, divineChaos)}
                  </td>
                )}
              </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-zinc-500">
                  Aucune opportunité avec ces filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedRow && (
        <OpportunityDetail
          o={selectedRow.o}
          runs={selectedRow.plan ? Math.max(1, selectedRow.plan.runs) : 1}
          budgetMode={selectedRow.plan !== undefined}
          payload={payload}
          verification={verif[selectedRow.o.id]}
          links={payload.tradeLinks[selectedRow.o.id] ?? []}
          verifiable={isVerifiable(selectedRow.o, payload)}
          onVerify={() => verify(selectedRow.o.id)}
          onClose={() => setSelected(null)}
        />
      )}

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
