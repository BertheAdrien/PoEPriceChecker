import { Suspense } from "react";
import { connection } from "next/server";
import { Dashboard } from "@/components/dashboard";
import { buildPayload } from "@/lib/payload";

// Avec cacheComponents, les données dynamiques doivent vivre sous <Suspense> ; connection()
// force le rendu à la requête (le cache 15 min est celui de buildPriceIndex, en mémoire).
async function Data() {
  await connection();
  const payload = await buildPayload();
  return <Dashboard payload={payload} />;
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6">
      <h1 className="mb-4 text-xl font-semibold">PoE Price Checker</h1>
      <Suspense
        fallback={<p className="animate-pulse text-zinc-400">Chargement des prix poe.ninja…</p>}
      >
        <Data />
      </Suspense>
    </main>
  );
}
