import type { Opportunity, PricedItem } from "@/lib/engine/types";
import type { DashboardPayload } from "@/lib/payload";
import type { TradeLink } from "@/lib/trade/links";
import type { VerifiedItem, VerifyResult } from "@/lib/trade/types";
import { fmt, fmtProfit } from "./format";
import { KIND_LABELS } from "./labels";
import type { VerifyState } from "./verify";

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

function ItemName({ i, links, role }: { i: PricedItem; links: TradeLink[]; role: "input" | "output" }) {
  const url = links.find((l) => l.role === role && l.item === i.item)?.url;
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="text-amber-400 underline">
      {i.item} ↗
    </a>
  ) : (
    <>{i.item}</>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="text-base font-semibold text-zinc-100">{children}</dd>
    </div>
  );
}

function Threshold({ value, bad }: { value?: number; bad: boolean }) {
  if (bad || value === undefined || value <= 0) return <span className="text-red-400">non rentable</span>;
  return <>{fmt(value)}c</>;
}

export function OpportunityDetail({
  o,
  runs,
  budgetMode,
  payload,
  verification,
  verifiable,
  links,
  onVerify,
}: {
  o: Opportunity;
  runs: number;
  budgetMode: boolean;
  payload: Pick<DashboardPayload, "vendors" | "divineChaos">;
  verification?: VerifyState;
  verifiable: boolean;
  links: TradeLink[];
  onVerify: () => void;
}) {
  const unprofitable = o.profitChaos <= 0;
  const th = "px-2 py-1 text-left text-xs uppercase text-zinc-400";
  const vr = verification?.status === "done" && verification.result.verified ? verification.result.opportunity : undefined;
  const eff = vr ?? o;
  return (
    <section className="flex flex-col gap-4 text-sm">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <p className="mb-1 text-xs uppercase text-zinc-500">{KIND_LABELS[o.kind]}</p>
        <h2 className="mb-3 text-lg font-semibold text-zinc-100">{o.label}</h2>
        <dl className="flex flex-wrap gap-x-8 gap-y-2">
          <Stat label={vr ? "Marge (trade)" : "Marge"}>
            <span className={eff.marginPct > 0 ? "text-emerald-400" : "text-red-400"}>
              {eff.marginPct > 0 ? "+" : ""}
              {fmt(eff.marginPct)}%
            </span>
            {vr && <span className="ml-2 text-xs text-zinc-500">ninja {fmt(o.marginPct)}%</span>}
          </Stat>
          <Stat label="Profit / run">{fmtProfit(eff.profitChaos, payload.divineChaos)}</Stat>
          <Stat label="Coût / run">{fmt(eff.costChaos)}c</Stat>
          {runs > 1 && <Stat label={`Profit (${runs} runs)`}>{fmtProfit(eff.profitChaos * runs, payload.divineChaos)}</Stat>}
        </dl>
        {(o.conditional || o.unverified) && (
          <p className="mt-3 text-xs text-amber-300">
            {o.conditional && "Opportunité conditionnelle. "}
            {o.unverified && "Recette non vérifiée en jeu [?]."}
          </p>
        )}
      </div>
      <div className="rounded-lg border border-amber-500/40 bg-zinc-900 p-4">
      <h3 className="mb-2 font-semibold">Liste de courses</h3>
      <p className="mb-3 text-zinc-400">
        Où convertir : <span className="text-zinc-200">{where(o, payload.vendors)}</span>
        {" · "}Quantités pour {runs} run{runs > 1 ? "s" : ""}
        {budgetMode ? " (selon le budget)" : ""}.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem]">
          <thead>
            <tr>
              <th className={th}>Acheter</th>
              <th className={th}>Qté</th>
              <th className={th}>Prix actuel</th>
              <th className={th}>Prix d&apos;achat max</th>
            </tr>
          </thead>
          <tbody>
            {o.inputs.map((i) => (
              <tr key={i.item} className="border-t border-zinc-800">
                <td className="px-2 py-1">
                  <ItemName i={i} links={links} role="input" />
                  {links.some((l) => l.role === "input" && l.item === i.item) && (
                    <span className="ml-2 text-[10px] text-zinc-500">
                      {o.corruptedInputs === "allowed" ? "corrompu OK" : "non corrompu requis"}
                    </span>
                  )}
                </td>
                <td className="px-2 py-1">{i.qty * runs}</td>
                <td className="px-2 py-1">{fmt(i.unitChaos)}c</td>
                <td className="px-2 py-1"><Threshold value={i.maxBuyChaos} bad={unprofitable} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="mt-3 w-full min-w-[32rem]">
          <thead>
            <tr>
              <th className={th}>Vendre</th>
              <th className={th}>Qté</th>
              <th className={th}>Prix actuel</th>
              <th className={th}>Prix de vente min</th>
            </tr>
          </thead>
          <tbody>
            {o.outputs.map((i) => (
              <tr key={i.item} className="border-t border-zinc-800">
                <td className="px-2 py-1"><ItemName i={i} links={links} role="output" /></td>
                <td className="px-2 py-1">{i.qty * runs}</td>
                <td className="px-2 py-1">{fmt(i.unitChaos)}c</td>
                <td className="px-2 py-1"><Threshold value={i.minSellChaos} bad={unprofitable} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {verifiable && (
        <div className="mt-4 border-t border-zinc-800 pt-3">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <button
              onClick={onVerify}
              disabled={verification?.status === "loading"}
              className="rounded border border-amber-500/60 px-2 py-0.5 text-amber-300 hover:bg-zinc-800 disabled:opacity-50"
            >
              {verification?.status === "loading" ? "Vérification…" : "Vérifier sur le trade"}
            </button>
            <span className="text-xs text-zinc-500">
              Médiane des 5 annonces securable les moins chères, hors Foulborn (file séquentielle : quelques secondes).
            </span>
          </div>
          {verification?.status === "error" && <p className="text-red-400">Échec : {verification.message}</p>}
          {verification?.status === "done" && (
            <VerifiedTable r={verification.result} divineChaos={payload.divineChaos} />
          )}
        </div>
      )}
      <p className="mt-3 text-xs text-zinc-500">
        Prix seuils : au-delà, le profit tombe à 0 (les autres prix restant fixes). Currency : à acheter chez Faustus
        (Currency Exchange en jeu), pas de lien trade.
      </p>
      </div>
    </section>
  );
}

function VerifiedTable({ r, divineChaos }: { r: VerifyResult; divineChaos: number }) {
  const th = "px-2 py-1 text-left text-xs uppercase text-zinc-400";
  const v = r.opportunity;
  const row = (i: VerifiedItem) => (
    <tr key={`${i.role}-${i.item}`} className="border-t border-zinc-800">
      <td className="px-2 py-1">{i.item}</td>
      <td className="px-2 py-1 text-zinc-400">
        {i.role === "input" ? "achat" : "vente"}
        {i.status !== "unverifiable" && ` · ${i.corrupted === "any" ? "corrompu OK" : "non corrompu"}`}
      </td>
      <td className="px-2 py-1">{fmt(i.ninjaChaos)}c</td>
      <td className="px-2 py-1">
        {i.tradeChaos !== undefined ? (
          <span className={i.tradeChaos > i.ninjaChaos * 1.2 ? "text-red-400" : undefined}>{fmt(i.tradeChaos)}c</span>
        ) : i.status === "no_listings" ? (
          <span className="text-amber-400">aucune annonce</span>
        ) : (
          <span className="text-zinc-500">exchange (poe.ninja)</span>
        )}
      </td>
      <td className="px-2 py-1">{i.listings !== undefined ? `${i.listings} (${i.sampled} utilisées)` : "–"}</td>
      <td className="px-2 py-1">
        {i.tradeUrl && (
          <a href={i.tradeUrl} target="_blank" rel="noreferrer" className="text-amber-400 underline">
            trade ↗
          </a>
        )}
      </td>
    </tr>
  );
  return (
    <div className="overflow-x-auto">
      <p className="mb-2">
        {r.verified ? (
          <>
            Marge vérifiée :{" "}
            <b className={v.profitChaos > 0 ? "text-emerald-400" : "text-red-400"}>
              {v.marginPct > 0 ? "+" : ""}
              {fmt(v.marginPct)}% ({fmtProfit(v.profitChaos, divineChaos)})
            </b>
            {v.profitChaos <= 0 && (
              <span className="ml-2 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-300">faux positif</span>
            )}
          </>
        ) : (
          <span className="text-amber-400">Aucun prix trade exploitable : prix poe.ninja conservés.</span>
        )}
      </p>
      <table className="w-full min-w-[40rem]">
        <thead>
          <tr>
            <th className={th}>Item</th>
            <th className={th}>Rôle</th>
            <th className={th}>poe.ninja</th>
            <th className={th}>Trade</th>
            <th className={th}>Annonces</th>
            <th className={th}>Lien</th>
          </tr>
        </thead>
        <tbody>{r.items.map(row)}</tbody>
      </table>
    </div>
  );
}
