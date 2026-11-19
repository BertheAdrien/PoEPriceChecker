import type { Opportunity, PricedItem } from "@/lib/engine/types";
import type { DashboardPayload } from "@/lib/payload";
import { fmt } from "./format";

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

function ItemName({ i, trade }: { i: PricedItem; trade: Record<string, string> }) {
  const url = trade[i.item];
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="text-amber-400 underline">
      {i.item} ↗
    </a>
  ) : (
    <>{i.item}</>
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
  onClose,
}: {
  o: Opportunity;
  runs: number;
  budgetMode: boolean;
  payload: DashboardPayload;
  onClose: () => void;
}) {
  const unprofitable = o.profitChaos <= 0;
  const th = "px-2 py-1 text-left text-xs uppercase text-zinc-400";
  return (
    <section className="rounded-lg border border-amber-500/40 bg-zinc-900 p-4 text-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="font-semibold">Liste de courses : {o.label}</h2>
        <button onClick={onClose} className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-300 hover:bg-zinc-800">
          Fermer
        </button>
      </div>
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
                <td className="px-2 py-1"><ItemName i={i} trade={payload.trade} /></td>
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
                <td className="px-2 py-1"><ItemName i={i} trade={payload.trade} /></td>
                <td className="px-2 py-1">{i.qty * runs}</td>
                <td className="px-2 py-1">{fmt(i.unitChaos)}c</td>
                <td className="px-2 py-1"><Threshold value={i.minSellChaos} bad={unprofitable} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Prix seuils : au-delà, le profit tombe à 0 (les autres prix restant fixes). Currency : à acheter chez Faustus
        (Currency Exchange en jeu), pas de lien trade.
      </p>
    </section>
  );
}
