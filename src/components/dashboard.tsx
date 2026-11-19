"use client";

import { useMemo, useState } from "react";
import { planBudget } from "@/lib/engine/budget";
import type { Opportunity, OpportunityKind } from "@/lib/engine/types";
import type { DashboardPayload } from "@/lib/payload";
import { OpportunityDetail } from "./opportunity-detail";
import { AUTO_VERIFY_COUNT, isVerifiable, useTradeVerification } from "./verify";
import { fmt, fmtProfit } from "./format";

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
  const [minProfit, setMinProfit] = useState("1");
  const [showConditional, setShowConditional] = useState(false);
  const [budget, setBudget] = useState("");
  const [unit, setUnit] = useState<"c" | "div">("c");
  const [selected, setSelected] = useState<string | null>(null);

  const budgetChaos = useMemo(() => {
    const n = parseFloat(budget.replace(",", "."));
    if (!(n > 0)) return undefined;
    return unit === "div" ? n * divineChaos : n;
  }, [budget, unit, divineChaos]);

  const rows = useMemo(() => {
    const mm = parseFloat(minMargin) || 0;
    const ml = parseFloat(minLiq) || 0;
    const mp = parseFloat(minProfit) || 0;
    return payload.opportunities
      .filter((o) => showConditional || !o.conditional)
      .filter((o) => kind === "all" || o.kind === kind)
      .filter((o) => o.marginPct >= mm && o.profitChaos >= mp)
      .filter((o) => {
        const l = o.liquidity;
        return (
          (l.minVolumeChaos === undefined || l.minVolumeChaos >= ml) &&
          (l.minListings === undefined || l.minListings >= ml)
        );
      })
      .map((o) => ({ o, plan: budgetChaos !== undefined ? planBudget(o, budgetChaos) : undefined }))
      .filter((r) => !r.plan || r.plan.affordable)
      .sort((a, b) => b.o.marginPct - a.o.marginPct);
  }, [payload.opportunities, kind, minMargin, minLiq, minProfit, showConditional, budgetChaos]);

  const autoIds = useMemo(
    () => rows.filter((r) => isVerifiable(r.o, payload)).slice(0, AUTO_VERIFY_COUNT).map((r) => r.o.id),
    [rows, payload],
  );
  const { states: verif, verify } = useTradeVerification(autoIds);

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
        <Field label="Profit min / run (c)">
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
              <th className="px-3 py-2 text-right">Marge</th>
              <th className="px-3 py-2 text-right">Profit</th>
              <th className="px-3 py-2 text-right">Coût</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Opportunité</th>
              <th className="px-3 py-2 text-right">Liquidité</th>
              <th className="px-3 py-2 text-right">7 j</th>
              <th className="px-3 py-2 text-right">Trade</th>
              {budgetChaos !== undefined && <th className="px-3 py-2 text-right">Runs</th>}
              {budgetChaos !== undefined && <th className="px-3 py-2 text-right">Profit total</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ o, plan }) => {
              const v = verif[o.id];
              const vr = v?.status === "done" && v.result.verified ? v.result.opportunity : undefined;
              return (
              <tr
                key={o.id}
                onClick={() => setSelected(o.id === selected ? null : o.id)}
                className={`cursor-pointer border-t border-zinc-800 hover:bg-zinc-800/60 ${o.id === selected ? "bg-zinc-800/80" : ""}`}
              >
                <td className="px-3 py-2 text-right font-semibold text-emerald-400">+{fmt(o.marginPct)}%</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{fmtProfit(o.profitChaos, divineChaos)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{fmt(o.costChaos)}c</td>
                <td className="whitespace-nowrap px-3 py-2 text-zinc-400">{KIND_LABELS[o.kind]}</td>
                <td className="px-3 py-2">
                  {o.label}
                  {o.conditional && <Badge cls="bg-amber-500/20 text-amber-300">conditionnel</Badge>}
                  {o.unverified && <Badge cls="bg-sky-500/20 text-sky-300">[?] non vérifié</Badge>}
                  {vr && vr.profitChaos <= 0 && <Badge cls="bg-red-500/20 text-red-300">faux positif</Badge>}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right text-zinc-400">{liqText(o)}</td>
                <td className={`px-3 py-2 text-right ${(o.trendPct ?? 0) < 0 ? "text-red-400" : "text-zinc-300"}`}>
                  {o.trendPct === undefined ? "–" : `${o.trendPct > 0 ? "+" : ""}${fmt(o.trendPct)}%`}
                </td>
                <td
                  className={`whitespace-nowrap px-3 py-2 text-right font-semibold ${vr ? (vr.marginPct > 0 ? "text-emerald-400" : "text-red-400") : "text-zinc-500"}`}
                  title={v?.status === "error" ? v.message : undefined}
                >
                  {v?.status === "loading" ? "…" : v?.status === "error" ? "!" : vr ? `${vr.marginPct > 0 ? "+" : ""}${fmt(vr.marginPct)}%` : "—"}
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
          verifiable={isVerifiable(selectedRow.o, payload)}
          onVerify={() => verify(selectedRow.o.id)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
