import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { OpportunityPage, type DetailPayload } from "@/components/opportunity-page";
import { buildPayload } from "@/lib/payload";

// /opportunite?id=<id>&runs=<n> : liste de courses d'une opportunité (même index de prix, en cache 15 min).
async function Data({ searchParams }: { searchParams: PageProps<"/opportunite">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const id = typeof sp.id === "string" ? sp.id : "";
  const runsParam = typeof sp.runs === "string" ? Number.parseInt(sp.runs, 10) : NaN;
  const runs = runsParam >= 1 ? runsParam : undefined;

  const payload = await buildPayload();
  const o = payload.opportunities.find((x) => x.id === id);
  if (!o) {
    return (
      <div className="flex flex-col items-start gap-3 text-sm text-zinc-300">
        <p>
          Opportunité introuvable dans les données actuelles (prix rafraîchis, ou elle n&apos;est plus rentable).
        </p>
        <Link href="/" className="rounded border border-zinc-700 px-2 py-1 hover:bg-zinc-800">
          ← Retour au tableau
        </Link>
      </div>
    );
  }

  // Seulement ce dont la page a besoin (le payload complet pèse plusieurs centaines de Ko).
  const items = new Set([...o.inputs, ...o.outputs].map((i) => i.item));
  const detail: DetailPayload = {
    league: payload.league,
    fetchedAt: payload.fetchedAt,
    divineChaos: payload.divineChaos,
    vendors: payload.vendors[o.id] ? { [o.id]: payload.vendors[o.id] } : {},
    trade: Object.fromEntries(Object.entries(payload.trade).filter(([name]) => items.has(name))),
  };
  return <OpportunityPage o={o} runs={runs} links={payload.tradeLinks[o.id] ?? []} payload={detail} />;
}

export default function Page({ searchParams }: PageProps<"/opportunite">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-6">
      <h1 className="mb-4 text-xl font-semibold">PoE Price Checker</h1>
      <Suspense fallback={<p className="animate-pulse text-zinc-400">Chargement…</p>}>
        <Data searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
