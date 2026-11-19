import { Suspense } from "react";
import { connection } from "next/server";
import { Dashboard } from "@/components/dashboard";
import { Loading } from "@/components/ui/loading";
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
    <main className="mx-auto w-full max-w-[1360px] px-4 py-7 sm:px-8">
      <Suspense fallback={<Loading />}>
        <Data />
      </Suspense>
    </main>
  );
}
