import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { OpportunityPage, type DetailPayload } from "@/components/opportunity-page";
import { Loading } from "@/components/ui/loading";
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
      <div className="flex flex-col items-start gap-4">
        <p className="flavour text-lg text-muted">
          Opportunité introuvable dans les données actuelles (prix rafraîchis, ou elle n&apos;est plus rentable).
        </p>
        <Link href="/" className="btn-ghost px-4 py-2.5 font-display tracking-wide no-underline">
          ← Retour au tableau
        </Link>
      </div>
    );
  }

  // Seulement ce dont la page a besoin (le payload complet pèse plusieurs centaines de Ko).
  const items = new Set([...o.inputs, ...o.outputs].map((i) => i.item));
  const pick = (rec: Record<string, string>) => Object.fromEntries(Object.entries(rec).filter(([name]) => items.has(name)));
  const detail: DetailPayload = {
    league: payload.league,
    fetchedAt: payload.fetchedAt,
    divineChaos: payload.divineChaos,
    vendors: payload.vendors[o.id] ? { [o.id]: payload.vendors[o.id] } : {},
    trade: pick(payload.trade),
    categories: pick(payload.categories),
  };
  return <OpportunityPage o={o} runs={runs} links={payload.tradeLinks[o.id] ?? []} payload={detail} />;
}

export default function Page({ searchParams }: PageProps<"/opportunite">) {
  return (
    <main className="mx-auto w-full max-w-[1240px] px-4 py-7 sm:px-8">
      <Suspense fallback={<Loading label="Chargement de la liste de courses…" rows={3} />}>
        <Data searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
